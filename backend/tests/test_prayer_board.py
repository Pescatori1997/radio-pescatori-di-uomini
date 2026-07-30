"""
Backend tests for the Prayer Board (Bacheca) feature.
Covers: create board/private prayers, admin moderation (list filters, publish, delete),
public board listing, 'Sto pregando' idempotency per client_id, authz.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PWD = "AdminTestPwd1!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("user", {}).get("role") == "administrator"
    return data["token"]


@pytest.fixture(scope="module")
def user_token(s):
    email = f"TEST_prayerboard_{int(time.time())}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!", "name": "TEST Luigi"}, timeout=30)
    assert r.status_code == 200, f"user register failed: {r.status_code} {r.text}"
    return r.json()["token"], email


@pytest.fixture(scope="module")
def created_ids():
    """Track ids for cleanup at end of module."""
    return []


@pytest.fixture(scope="module", autouse=True)
def _cleanup(created_ids, admin_token, s):
    yield
    for pid in created_ids:
        try:
            s.delete(f"{API}/admin/prayers/{pid}", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        except Exception:
            pass


# ---------- helpers ----------
def _find_pending(admin_token, s, text_marker):
    r = s.get(f"{API}/admin/prayers", params={"filter": "pending"},
              headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    for d in r.json():
        if text_marker in (d.get("text") or ""):
            return d
    return None


# ---------- tests ----------
class TestPrayerBoardCreate:
    def test_board_public_prayer_not_visible_until_approved(self, s, admin_token, created_ids):
        text = f"TEST_board_show_{int(time.time())} - Prega per la mia famiglia"
        # Anonymous submission (no auth) — board visibility with show_name True
        r = s.post(f"{API}/prayer-requests",
                   json={"text": text, "visibility": "board", "show_name": True, "name": "Luigi"},
                   timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Public board must NOT contain it (pending)
        rb = s.get(f"{API}/prayer-board", timeout=15)
        assert rb.status_code == 200
        assert isinstance(rb.json(), list)
        assert not any(text in (x.get("text") or "") for x in rb.json()), "pending request leaked to board"

        # Track for cleanup
        doc = _find_pending(admin_token, s, text)
        assert doc is not None, "pending doc missing in admin pending filter"
        created_ids.append(doc["id"])
        # Author fields must be null since submitted anonymously (no bearer)
        assert doc.get("visibility") == "board"
        assert doc.get("show_name") is True
        assert doc.get("published") in (False, None)

    def test_private_prayer_with_auth_captures_author(self, s, admin_token, user_token, created_ids):
        token, email = user_token
        text = f"TEST_private_{int(time.time())} - Preghiera privata"
        r = s.post(f"{API}/prayer-requests",
                   json={"text": text, "visibility": "private"},
                   headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200, r.text

        # Under admin filter=private, must be present with author info
        r2 = s.get(f"{API}/admin/prayers", params={"filter": "private"},
                   headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r2.status_code == 200
        match = next((d for d in r2.json() if text in (d.get("text") or "")), None)
        assert match is not None, "private prayer not in admin filter=private"
        assert (match.get("author_email") or "").lower() == email.lower()
        assert match.get("author_name")
        assert match.get("visibility") != "board"
        created_ids.append(match["id"])

        # And it must not appear on the public board even if flagged (safety)
        rb = s.get(f"{API}/prayer-board", timeout=15)
        assert rb.status_code == 200
        assert not any(text in (x.get("text") or "") for x in rb.json())


class TestPrayerBoardModeration:
    def test_admin_approve_publishes_and_shows_name(self, s, admin_token, created_ids):
        text = f"TEST_moderate_named_{int(time.time())}"
        r = s.post(f"{API}/prayer-requests",
                   json={"text": text, "visibility": "board", "show_name": True, "name": "Luigi"},
                   timeout=15)
        assert r.status_code == 200
        doc = _find_pending(admin_token, s, text)
        assert doc is not None
        pid = doc["id"]
        created_ids.append(pid)

        # Admin list should include it under pending with author info fields present
        assert "author_id" in doc  # key exists even if null

        # Publish
        rp = s.patch(f"{API}/admin/prayers/{pid}",
                     json={"published": True},
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rp.status_code == 200, rp.text

        # It must appear on public board with display_name Luigi
        rb = s.get(f"{API}/prayer-board", timeout=15)
        assert rb.status_code == 200
        item = next((x for x in rb.json() if x["id"] == pid), None)
        assert item is not None, "published prayer missing from board"
        assert item.get("display_name") == "Luigi"
        assert item.get("praying_count") == 0

    def test_admin_approve_anonymous_shows_anonimo(self, s, admin_token, created_ids):
        text = f"TEST_moderate_anon_{int(time.time())}"
        r = s.post(f"{API}/prayer-requests",
                   json={"text": text, "visibility": "board", "show_name": False, "name": "Segreto"},
                   timeout=15)
        assert r.status_code == 200
        doc = _find_pending(admin_token, s, text)
        assert doc is not None
        pid = doc["id"]
        created_ids.append(pid)

        rp = s.patch(f"{API}/admin/prayers/{pid}",
                     json={"published": True},
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rp.status_code == 200

        rb = s.get(f"{API}/prayer-board", timeout=15)
        item = next((x for x in rb.json() if x["id"] == pid), None)
        assert item is not None
        assert item.get("display_name") == "Anonimo"


class TestPrayFor:
    @pytest.fixture(scope="class")
    def published_pid(self, s, admin_token, created_ids):
        text = f"TEST_pray_counter_{int(time.time())}"
        r = s.post(f"{API}/prayer-requests",
                   json={"text": text, "visibility": "board", "show_name": True, "name": "Luigi"}, timeout=15)
        assert r.status_code == 200
        doc = _find_pending(admin_token, s, text)
        assert doc
        pid = doc["id"]
        created_ids.append(pid)
        rp = s.patch(f"{API}/admin/prayers/{pid}", json={"published": True},
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rp.status_code == 200
        return pid

    def test_pray_increments_and_dedupes(self, s, published_pid):
        pid = published_pid
        # dev-A once
        r1 = s.post(f"{API}/prayer-board/{pid}/pray", json={"client_id": "dev-A"}, timeout=15)
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1.get("praying_count") == 1
        assert not d1.get("already")

        # dev-A repeat -> already:true, count unchanged
        r2 = s.post(f"{API}/prayer-board/{pid}/pray", json={"client_id": "dev-A"}, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("already") is True
        assert d2.get("praying_count") == 1

        # dev-B -> count 2
        r3 = s.post(f"{API}/prayer-board/{pid}/pray", json={"client_id": "dev-B"}, timeout=15)
        assert r3.status_code == 200
        assert r3.json().get("praying_count") == 2

        # GET board with client_id=dev-A -> prayed True on that item
        rb = s.get(f"{API}/prayer-board", params={"client_id": "dev-A"}, timeout=15)
        item = next((x for x in rb.json() if x["id"] == pid), None)
        assert item is not None
        assert item.get("prayed") is True
        assert item.get("praying_count") == 2

        # GET board with client_id=dev-C -> prayed False
        rb2 = s.get(f"{API}/prayer-board", params={"client_id": "dev-C"}, timeout=15)
        item2 = next((x for x in rb2.json() if x["id"] == pid), None)
        assert item2.get("prayed") is False


class TestAuthz:
    def test_admin_prayers_requires_auth(self, s):
        r = s.get(f"{API}/admin/prayers", timeout=15)
        assert r.status_code == 401

    def test_admin_prayers_forbidden_for_normal_user(self, s, user_token):
        token, _ = user_token
        r = s.get(f"{API}/admin/prayers", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 403


class TestDeleteAndRegression:
    def test_delete_removes_prayer_and_marks(self, s, admin_token):
        text = f"TEST_delete_flow_{int(time.time())}"
        r = s.post(f"{API}/prayer-requests",
                   json={"text": text, "visibility": "board", "show_name": True, "name": "Luigi"}, timeout=15)
        assert r.status_code == 200
        doc = _find_pending(admin_token, s, text)
        assert doc
        pid = doc["id"]
        # publish and pray
        s.patch(f"{API}/admin/prayers/{pid}", json={"published": True},
                headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        s.post(f"{API}/prayer-board/{pid}/pray", json={"client_id": "dev-DEL"}, timeout=15)

        # Delete
        rd = s.delete(f"{API}/admin/prayers/{pid}",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rd.status_code == 200

        # Board must no longer contain it
        rb = s.get(f"{API}/prayer-board", params={"client_id": "dev-DEL"}, timeout=15)
        assert not any(x["id"] == pid for x in rb.json())

        # Praying for it now should 404
        rp = s.post(f"{API}/prayer-board/{pid}/pray", json={"client_id": "dev-DEL2"}, timeout=15)
        assert rp.status_code == 404

    def test_regression_board_endpoint_and_legacy_submit(self, s):
        # No params
        r = s.get(f"{API}/prayer-board", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

        # Legacy private prayer without visibility param — should still work
        r2 = s.post(f"{API}/prayer-requests",
                    json={"text": f"TEST_legacy_{int(time.time())}", "name": "Anon"},
                    timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("ok") is True
