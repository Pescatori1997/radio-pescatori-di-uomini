"""Tests for the image optimization feature (iteration 42).

Verifies:
  * Public list/detail endpoints rewrite inline base64 images into
    lightweight `/api/img/...?v=<hash>` URLs (external http/https URLs stay).
  * The /api/img endpoint serves real image bytes with correct content-type
    and long-lived caching headers (backend-side; note ingress may override).
  * Whitelist / not-found paths return 404.
  * The ?v= content hash changes when the underlying base64 changes → cache bust.
  * Admin endpoints still return the FULL base64 (editors need to re-save w/o
    corrupting the doc).
  * Regression: /api/me/achievements still returns earned_count=6 for demo user.
"""
import os
import base64
import io
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
LOCAL_URL = "http://localhost:8001"

# Known real seed doc containing a base64 image (image field).
NEWS_ID_WITH_B64 = "news_572a9652d8a3"
MEDITATION_ID_WITH_B64 = "med_50209f73871c"

DEMO_USER = ("bacheca_demo@test.it", "Test1234!")
ADMIN_USER = ("pescatoridiuomini@outlook.it", "AdminTestPwd1!")


# --------- helpers ---------
@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


@pytest.fixture(scope="module")
def demo_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_USER[0], "password": DEMO_USER[1]})
    if r.status_code != 200:
        pytest.skip(f"demo login failed: {r.status_code}")
    return r.json().get("token") or r.json().get("session_token")


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_USER[0], "password": ADMIN_USER[1]})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code}")
    return r.json().get("token") or r.json().get("session_token")


# --------- lighten on public list endpoints ---------
class TestPublicListsLightened:
    @pytest.mark.parametrize("path,fields", [
        ("/api/news", ["image"]),
        ("/api/podcasts", ["artwork"]),
        ("/api/meditations", ["thumbnail"]),
        ("/api/crew", ["portrait"]),
        ("/api/programs", ["images", "presenters"]),
        ("/api/reading-plans", ["cover"]),
        ("/api/contents?section=predicazioni", ["thumbnail"]),
        ("/api/showcase", ["image"]),
    ])
    def test_no_base64_in_lists(self, s, path, fields):
        r = s.get(f"{BASE_URL}{path}")
        assert r.status_code == 200, f"{path} status {r.status_code}"
        docs = r.json()
        assert isinstance(docs, list)
        for d in docs:
            for f in fields:
                v = d.get(f)
                if isinstance(v, str):
                    assert not v.startswith("data:image/"), f"{path} still has base64 in field '{f}' on {d.get('id')}"
                    # if rewritten, must be relative /api/img/...
                    if v and not v.startswith("http"):
                        assert v.startswith("/api/img/"), f"{path} '{f}' unexpected value: {v[:80]}"
                if isinstance(v, list):  # programs images / presenters
                    for item in v:
                        if isinstance(item, str) and item.startswith("data:image/"):
                            pytest.fail(f"{path} list field {f} still has base64")
                        if isinstance(item, dict) and isinstance(item.get("image"), str):
                            assert not item["image"].startswith("data:image/"), \
                                f"{path} presenter image still base64"

    def test_news_target_item_has_img_url(self, s):
        r = s.get(f"{BASE_URL}/api/news")
        assert r.status_code == 200
        target = next((x for x in r.json() if x["id"] == NEWS_ID_WITH_B64), None)
        assert target is not None, "seed news not found"
        assert isinstance(target["image"], str)
        assert target["image"].startswith("/api/img/news/") and "?v=" in target["image"], \
            f"unexpected image url: {target['image']}"

    def test_external_urls_preserved(self, s):
        r = s.get(f"{BASE_URL}/api/news")
        externals = [x["image"] for x in r.json() if isinstance(x.get("image"), str) and x["image"].startswith("http")]
        assert externals, "expected at least one external URL preserved"
        for u in externals:
            assert u.startswith("http"), f"external mangled: {u}"


# --------- /api/img endpoint ---------
class TestImgEndpoint:
    def test_serve_real_bytes_with_v(self, s):
        # first grab the url from list
        r = s.get(f"{BASE_URL}/api/news")
        url_rel = next(x["image"] for x in r.json() if x["id"] == NEWS_ID_WITH_B64)
        r2 = s.get(f"{BASE_URL}{url_rel}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/"), r2.headers
        assert len(r2.content) > 5000, f"body too small: {len(r2.content)}"

    def test_serve_without_v(self, s):
        # image must still serve even without ?v (v is only for cache-busting)
        r = s.get(f"{BASE_URL}/api/img/news/{NEWS_ID_WITH_B64}/image")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 5000

    def test_cache_control_header_backend_side(self):
        """The backend sets the immutable/long cache header directly. Public
        ingress may override it — the test hits localhost to prove the app is
        emitting the correct header, which is what browsers see when the
        ingress is transparent."""
        r = requests.get(f"{LOCAL_URL}/api/img/news/{NEWS_ID_WITH_B64}/image?v=abc123")
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "")
        assert "max-age=31536000" in cc and "immutable" in cc, f"backend cache-control: {cc}"

    def test_404_unknown_collection(self, s):
        r = s.get(f"{BASE_URL}/api/img/foobar/xxx/yyy")
        assert r.status_code == 404

    def test_404_unknown_doc(self, s):
        r = s.get(f"{BASE_URL}/api/img/podcasts/id_inesistente/artwork")
        assert r.status_code == 404

    def test_404_field_not_whitelisted(self, s):
        r = s.get(f"{BASE_URL}/api/img/news/{NEWS_ID_WITH_B64}/nonesisto")
        assert r.status_code == 404


# --------- cache-bust: ?v changes when base64 changes ---------
class TestCacheBust:
    def test_v_changes_after_content_update(self, s):
        """Read the news' image URL, mutate the underlying base64 in Mongo,
        re-read the list, and assert the ?v= differs; then restore."""
        # capture current v
        docs = s.get(f"{BASE_URL}/api/news").json()
        item = next(x for x in docs if x["id"] == NEWS_ID_WITH_B64)
        original_url = item["image"]
        original_v = original_url.split("?v=")[1].split("&")[0]

        async def _mutate_and_restore():
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client["test_database"]
            doc = await db.news.find_one({"id": NEWS_ID_WITH_B64})
            original_b64 = doc.get("image")
            assert isinstance(original_b64, str) and original_b64.startswith("data:image/"), \
                "expected stored base64 image"
            # tweak: append a byte -> hash changes
            tweaked = original_b64 + "A"
            await db.news.update_one({"id": NEWS_ID_WITH_B64}, {"$set": {"image": tweaked}})
            try:
                docs2 = requests.get(f"{BASE_URL}/api/news").json()
                item2 = next(x for x in docs2 if x["id"] == NEWS_ID_WITH_B64)
                new_v = item2["image"].split("?v=")[1].split("&")[0]
                assert new_v != original_v, f"?v did not change: {original_v} vs {new_v}"
            finally:
                await db.news.update_one({"id": NEWS_ID_WITH_B64}, {"$set": {"image": original_b64}})
            client.close()

        asyncio.new_event_loop().run_until_complete(_mutate_and_restore())

        # sanity: after restore v is back
        docs3 = s.get(f"{BASE_URL}/api/news").json()
        item3 = next(x for x in docs3 if x["id"] == NEWS_ID_WITH_B64)
        restored_v = item3["image"].split("?v=")[1].split("&")[0]
        assert restored_v == original_v


# --------- admin endpoints still return full base64 ---------
class TestAdminReturnsFullBase64:
    def _admin_headers(self, token):
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_admin_news_get_returns_base64(self, s, admin_token):
        # /api/admin/news is list-only (no GET by id) — fetch list and check target.
        r = s.get(f"{BASE_URL}/api/admin/news", headers=self._admin_headers(admin_token))
        assert r.status_code == 200, r.text
        docs = r.json()
        item = next((x for x in docs if x["id"] == NEWS_ID_WITH_B64), None)
        assert item is not None, "target news not in admin list"
        assert isinstance(item.get("image"), str) and item["image"].startswith("data:image/"), \
            f"admin news list must return raw base64, got: {str(item.get('image'))[:80]}"

    def test_admin_meditation_get_returns_base64(self, s, admin_token):
        r = s.get(f"{BASE_URL}/api/admin/meditations/{MEDITATION_ID_WITH_B64}",
                  headers=self._admin_headers(admin_token))
        if r.status_code == 404:
            r = s.get(f"{BASE_URL}/api/admin/meditations", headers=self._admin_headers(admin_token))
            assert r.status_code == 200
            item = next((x for x in r.json() if x["id"] == MEDITATION_ID_WITH_B64), None)
            assert item is not None
            thumb = item.get("thumbnail")
            if thumb:
                assert thumb.startswith("data:image/"), f"admin meditation list must return raw base64: {str(thumb)[:80]}"
            return
        assert r.status_code == 200, r.text
        thumb = r.json().get("thumbnail")
        if thumb:
            assert thumb.startswith("data:image/"), f"admin meditation must return raw base64: {str(thumb)[:80]}"

    @pytest.mark.parametrize("coll,url,image_field", [
        ("podcasts", "/api/admin/podcasts", "artwork"),
        ("crew", "/api/admin/crew", "portrait"),
        ("reading-plans", "/api/admin/reading-plans", "cover"),
        ("contents", "/api/admin/contents?section=predicazioni", "thumbnail"),
    ])
    def test_admin_list_returns_base64_when_present(self, s, admin_token, coll, url, image_field):
        r = s.get(f"{BASE_URL}{url}", headers=self._admin_headers(admin_token))
        if r.status_code == 404:
            pytest.skip(f"{url} not implemented")
        assert r.status_code == 200, f"{coll}: {r.status_code} {r.text[:200]}"
        body = r.json()
        docs = body if isinstance(body, list) else body.get("items", [])
        for d in docs:
            v = d.get(image_field)
            if isinstance(v, str) and v:
                assert not v.startswith("/api/img/"), \
                    f"admin {coll} was lightened → editor will save the URL and lose the base64: {v[:80]}"


# --------- regression: achievements demo user ---------
class TestAchievementsRegression:
    def test_demo_achievements_earned_6(self, s, demo_token):
        r = s.get(f"{BASE_URL}/api/me/achievements",
                  headers={"Authorization": f"Bearer {demo_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("earned_count") == 6, f"expected 6, got {data.get('earned_count')}: {data}"
