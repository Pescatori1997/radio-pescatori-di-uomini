"""Backend tests for Meditazioni multi-format media (iteration 24).

Covers:
- Admin auth via /api/auth/login (email/password → Bearer token)
- Chunked upload lifecycle (init / chunk / complete) for PDF + MP3
- /api/media/{id} streaming: full 200, Range 206 Content-Range/Length, ?download=1
- Provider detection: youtube/vimeo/spotify/tiktok/instagram/facebook (content_type=embed)
- Uploaded-media meditation: content_type == media_type, provider == 'upload'
- PATCH replaces media_id → old GridFS file gone (404 on old /api/media/{id})
- DELETE meditation removes GridFS file
- Public list excludes drafts + scheduled (future publish_date); GET single still returns
- Auth guards on /api/admin/uploads/* and /api/admin/meditations (POST/PATCH/DELETE)
- Backward compat: legacy meditation with only video_url returns content_type/provider
"""
import os
import struct
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://evangelic-stream.preview.emergentagent.com"
).rstrip("/")

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PASSWORD = "AdminTestPwd1!"

# Minimal valid PDF (well-formed enough for a browser)
MIN_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \n"
    b"0000000010 00000 n \n0000000053 00000 n \n0000000100 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF\n"
)

# Minimal-ish MP3 (ID3v2 header + one silent frame). Content doesn't need to actually decode.
def _min_mp3() -> bytes:
    id3 = b"ID3\x04\x00\x00\x00\x00\x00\x00"
    # 1 MPEG-1 Layer 3 frame header (0xFFFB90..) + padding
    frame = b"\xFF\xFB\x90\x44" + b"\x00" * 400
    return id3 + frame * 3


MIN_MP3 = _min_mp3()


@pytest.fixture(scope="module")
def admin_token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, "no token returned"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def created_ids(admin_headers):
    ids: list[str] = []
    yield ids
    for mid in ids:
        try:
            requests.delete(
                f"{BASE_URL}/api/admin/meditations/{mid}",
                headers=admin_headers, timeout=15,
            )
        except Exception:
            pass


@pytest.fixture(scope="module")
def uploaded_media_ids(admin_headers):
    """Track GridFS media_ids uploaded outside of meditations for cleanup safety."""
    ids: list[str] = []
    yield ids
    # No public delete for media, but the meditations DELETE also frees them.


# ---------- Helpers ----------
def _chunked_upload(admin_headers: dict, blob: bytes, filename: str, mime: str) -> dict:
    """Run init → chunk (single chunk) → complete. Returns complete response body."""
    r = requests.post(
        f"{BASE_URL}/api/admin/uploads/init",
        headers=admin_headers,
        json={"filename": filename, "mime": mime},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    up = r.json()["upload_id"]

    # Raw binary chunk body
    r2 = requests.put(
        f"{BASE_URL}/api/admin/uploads/{up}/chunk",
        headers={**admin_headers, "Content-Type": "application/octet-stream"},
        data=blob,
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json().get("size") == len(blob)

    r3 = requests.post(
        f"{BASE_URL}/api/admin/uploads/{up}/complete",
        headers=admin_headers,
        timeout=60,
    )
    assert r3.status_code == 200, r3.text
    body = r3.json()
    assert body.get("media_id")
    return body


# ---------- Auth guards ----------
class TestAuthGuards:
    def test_upload_init_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/uploads/init",
            json={"filename": "x.pdf", "mime": "application/pdf"},
            timeout=10,
        )
        assert r.status_code in (401, 403), r.text

    def test_upload_chunk_requires_auth(self):
        r = requests.put(
            f"{BASE_URL}/api/admin/uploads/deadbeef/chunk",
            data=b"abc",
            timeout=10,
        )
        assert r.status_code in (401, 403), r.text

    def test_upload_complete_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/uploads/deadbeef/complete",
            timeout=10,
        )
        assert r.status_code in (401, 403), r.text

    def test_admin_meditation_post_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/meditations",
            json={"title": "TEST_x"},
            timeout=10,
        )
        assert r.status_code in (401, 403), r.text

    def test_admin_meditation_patch_requires_auth(self):
        r = requests.patch(
            f"{BASE_URL}/api/admin/meditations/med_nonexistent",
            json={"title": "TEST_x"},
            timeout=10,
        )
        assert r.status_code in (401, 403), r.text

    def test_admin_meditation_delete_requires_auth(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/meditations/med_nonexistent",
            timeout=10,
        )
        assert r.status_code in (401, 403), r.text


# ---------- Chunked upload + streaming ----------
class TestChunkedUploadAndStreaming:
    def test_pdf_upload_and_stream(self, admin_headers, uploaded_media_ids):
        info = _chunked_upload(admin_headers, MIN_PDF, "TEST_doc.pdf", "application/pdf")
        assert info["media_type"] == "pdf"
        assert info["media_mime"] == "application/pdf"
        assert info["size"] == len(MIN_PDF)
        mid = info["media_id"]
        uploaded_media_ids.append(mid)

        # Full GET → 200, correct Content-Type & size
        r = requests.get(f"{BASE_URL}/api/media/{mid}", timeout=20)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.headers.get("accept-ranges") == "bytes"
        assert int(r.headers.get("content-length", "0")) == len(MIN_PDF)
        assert r.content == MIN_PDF

        # Range 0-99 → 206 with Content-Range and Content-Length=100
        rr = requests.get(
            f"{BASE_URL}/api/media/{mid}",
            headers={"Range": "bytes=0-99"},
            timeout=20,
        )
        assert rr.status_code == 206, rr.text
        assert rr.headers.get("content-range") == f"bytes 0-99/{len(MIN_PDF)}"
        assert rr.headers.get("content-length") == "100"
        assert rr.headers.get("accept-ranges") == "bytes"
        assert len(rr.content) == 100
        assert rr.content == MIN_PDF[:100]

        # ?download=1 → attachment disposition
        rd = requests.get(f"{BASE_URL}/api/media/{mid}?download=1", timeout=20)
        assert rd.status_code == 200
        disp = rd.headers.get("content-disposition", "")
        assert "attachment" in disp.lower()
        assert "TEST_doc.pdf" in disp

    def test_mp3_upload_and_media_type_audio(self, admin_headers, uploaded_media_ids):
        info = _chunked_upload(admin_headers, MIN_MP3, "TEST_clip.mp3", "audio/mpeg")
        assert info["media_type"] == "audio"
        assert info["media_mime"] == "audio/mpeg"
        assert info["size"] == len(MIN_MP3)
        mid = info["media_id"]
        uploaded_media_ids.append(mid)

        r = requests.get(f"{BASE_URL}/api/media/{mid}", timeout=20)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/mpeg")
        assert r.content == MIN_MP3

    def test_media_404_for_bad_id(self):
        r = requests.get(f"{BASE_URL}/api/media/000000000000000000000000", timeout=10)
        assert r.status_code == 404


# ---------- Provider / content_type detection ----------
class TestProviderDetection:
    @pytest.mark.parametrize("url,provider", [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"),
        ("https://youtu.be/dQw4w9WgXcQ", "youtube"),
        ("https://vimeo.com/76979871", "vimeo"),
        ("https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ", "spotify"),
        ("https://www.tiktok.com/@user/video/1234", "tiktok"),
        ("https://www.instagram.com/reel/abc/", "instagram"),
        ("https://www.facebook.com/watch?v=1234", "facebook"),
    ])
    def test_embed_provider_detected(self, admin_headers, created_ids, url, provider):
        title = f"TEST_med_prov_{provider}_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/admin/meditations",
            headers=admin_headers,
            json={"title": title, "video_url": url, "published": True},
            timeout=15,
        )
        assert r.status_code == 201, r.text
        mid = r.json()["id"]
        created_ids.append(mid)

        rg = requests.get(f"{BASE_URL}/api/meditations/{mid}", timeout=10)
        assert rg.status_code == 200
        doc = rg.json()
        assert doc.get("content_type") == "embed", doc
        assert doc.get("provider") == provider, doc


# ---------- Uploaded-media meditation ----------
class TestUploadedMediaMeditation:
    def test_meditation_with_media_id(self, admin_headers, created_ids, uploaded_media_ids):
        info = _chunked_upload(admin_headers, MIN_PDF, "TEST_up.pdf", "application/pdf")
        mid_media = info["media_id"]
        uploaded_media_ids.append(mid_media)

        r = requests.post(
            f"{BASE_URL}/api/admin/meditations",
            headers=admin_headers,
            json={
                "title": f"TEST_med_upload_{uuid.uuid4().hex[:6]}",
                "media_id": mid_media,
                "media_type": info["media_type"],
                "media_mime": info["media_mime"],
                "media_filename": info["media_filename"],
                "published": True,
            },
            timeout=15,
        )
        assert r.status_code == 201, r.text
        mid = r.json()["id"]
        created_ids.append(mid)

        rg = requests.get(f"{BASE_URL}/api/meditations/{mid}", timeout=10)
        assert rg.status_code == 200
        doc = rg.json()
        assert doc.get("content_type") == info["media_type"] == "pdf"
        assert doc.get("provider") == "upload"
        assert doc.get("media_id") == mid_media

    def test_patch_replaces_media_deletes_old_gridfs(self, admin_headers, created_ids):
        # Upload first PDF
        info1 = _chunked_upload(admin_headers, MIN_PDF, "TEST_v1.pdf", "application/pdf")
        old_media_id = info1["media_id"]
        # Create meditation with first media
        rc = requests.post(
            f"{BASE_URL}/api/admin/meditations",
            headers=admin_headers,
            json={
                "title": f"TEST_med_replace_{uuid.uuid4().hex[:6]}",
                "media_id": old_media_id,
                "media_type": info1["media_type"],
                "media_mime": info1["media_mime"],
                "media_filename": info1["media_filename"],
                "published": False,
            },
            timeout=15,
        )
        assert rc.status_code == 201, rc.text
        mid = rc.json()["id"]
        created_ids.append(mid)

        # Old media should currently exist
        assert requests.get(f"{BASE_URL}/api/media/{old_media_id}", timeout=10).status_code == 200

        # Upload replacement (MP3)
        info2 = _chunked_upload(admin_headers, MIN_MP3, "TEST_v2.mp3", "audio/mpeg")
        new_media_id = info2["media_id"]

        rp = requests.patch(
            f"{BASE_URL}/api/admin/meditations/{mid}",
            headers=admin_headers,
            json={
                "media_id": new_media_id,
                "media_type": info2["media_type"],
                "media_mime": info2["media_mime"],
                "media_filename": info2["media_filename"],
            },
            timeout=15,
        )
        assert rp.status_code == 200, rp.text

        # Old GridFS file must be gone (404)
        rold = requests.get(f"{BASE_URL}/api/media/{old_media_id}", timeout=10)
        assert rold.status_code == 404, f"expected 404 for old media, got {rold.status_code}"

        # New GridFS file should still be reachable
        rnew = requests.get(f"{BASE_URL}/api/media/{new_media_id}", timeout=10)
        assert rnew.status_code == 200

        # GET meditation reflects new media
        rg = requests.get(f"{BASE_URL}/api/meditations/{mid}", timeout=10)
        assert rg.status_code == 200
        assert rg.json().get("media_id") == new_media_id
        assert rg.json().get("content_type") == "audio"

    def test_delete_meditation_removes_gridfs(self, admin_headers):
        info = _chunked_upload(admin_headers, MIN_PDF, "TEST_del.pdf", "application/pdf")
        media_id = info["media_id"]
        rc = requests.post(
            f"{BASE_URL}/api/admin/meditations",
            headers=admin_headers,
            json={
                "title": f"TEST_med_del_{uuid.uuid4().hex[:6]}",
                "media_id": media_id,
                "media_type": info["media_type"],
                "media_mime": info["media_mime"],
                "media_filename": info["media_filename"],
                "published": True,
            },
            timeout=15,
        )
        assert rc.status_code == 201
        mid = rc.json()["id"]

        # Delete meditation
        rd = requests.delete(f"{BASE_URL}/api/admin/meditations/{mid}",
                             headers=admin_headers, timeout=15)
        assert rd.status_code == 200

        # Media should be 404
        rm = requests.get(f"{BASE_URL}/api/media/{media_id}", timeout=10)
        assert rm.status_code == 404, f"expected 404, got {rm.status_code}"


# ---------- Public list draft/scheduled filtering ----------
class TestPublicVisibility:
    def test_draft_hidden_scheduled_hidden_published_shown(self, admin_headers, created_ids):
        # Draft
        title_draft = f"TEST_med_draft_{uuid.uuid4().hex[:6]}"
        rd = requests.post(
            f"{BASE_URL}/api/admin/meditations", headers=admin_headers,
            json={"title": title_draft, "published": False,
                  "video_url": "https://youtu.be/xxx"},
            timeout=15,
        )
        assert rd.status_code == 201
        draft_id = rd.json()["id"]; created_ids.append(draft_id)

        # Scheduled (future)
        title_sched = f"TEST_med_sched_{uuid.uuid4().hex[:6]}"
        future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        rs = requests.post(
            f"{BASE_URL}/api/admin/meditations", headers=admin_headers,
            json={"title": title_sched, "published": True, "publish_date": future,
                  "video_url": "https://youtu.be/xxx"},
            timeout=15,
        )
        assert rs.status_code == 201
        sched_id = rs.json()["id"]; created_ids.append(sched_id)

        # Published now
        title_pub = f"TEST_med_pub_{uuid.uuid4().hex[:6]}"
        rp = requests.post(
            f"{BASE_URL}/api/admin/meditations", headers=admin_headers,
            json={"title": title_pub, "published": True,
                  "video_url": "https://youtu.be/dQw4w9WgXcQ"},
            timeout=15,
        )
        assert rp.status_code == 201
        pub_id = rp.json()["id"]; created_ids.append(pub_id)

        # Public listing
        rlist = requests.get(f"{BASE_URL}/api/meditations", timeout=15)
        assert rlist.status_code == 200
        listed = {d["id"] for d in rlist.json()}
        assert pub_id in listed
        assert draft_id not in listed
        assert sched_id not in listed

        # But GET single still returns them
        for xid in (draft_id, sched_id):
            r_single = requests.get(f"{BASE_URL}/api/meditations/{xid}", timeout=10)
            assert r_single.status_code == 200, xid

    def test_categories_endpoint(self, admin_headers, created_ids):
        cat = f"TEST_CAT_{uuid.uuid4().hex[:6]}"
        rc = requests.post(
            f"{BASE_URL}/api/admin/meditations", headers=admin_headers,
            json={"title": f"TEST_cat_{uuid.uuid4().hex[:6]}",
                  "category": cat, "published": True,
                  "video_url": "https://youtu.be/xxx"},
            timeout=15,
        )
        assert rc.status_code == 201
        created_ids.append(rc.json()["id"])
        rr = requests.get(f"{BASE_URL}/api/meditations/categories", timeout=10)
        assert rr.status_code == 200
        assert cat in rr.json()


# ---------- Backward compatibility ----------
class TestBackwardCompat:
    def test_legacy_video_url_only_returns_content_type(self, admin_headers, created_ids):
        title = f"TEST_med_legacy_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/admin/meditations",
            headers=admin_headers,
            json={"title": title, "published": True,
                  "video_url": "https://www.youtube.com/watch?v=abcdef"},
            timeout=15,
        )
        assert r.status_code == 201
        mid = r.json()["id"]
        created_ids.append(mid)

        rg = requests.get(f"{BASE_URL}/api/meditations/{mid}", timeout=10)
        assert rg.status_code == 200
        doc = rg.json()
        # No media_id set → decorator computes provider+content_type from video_url
        assert doc.get("content_type") == "embed"
        assert doc.get("provider") == "youtube"
