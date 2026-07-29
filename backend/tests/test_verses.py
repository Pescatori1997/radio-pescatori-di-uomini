"""Tests for Versetto del Giorno (Verse of the Day) — GET /api/verse/*
and admin CRUD /api/admin/verses.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PWD = "AdminTestPwd1!"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(client):
    r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token") or data.get("token")
    assert token, f"no token in login response: {data}"
    role = (data.get("user") or {}).get("role")
    assert role == "administrator", f"expected administrator role, got {role}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Public: /verse/today ----------
class TestVerseToday:
    def test_today_returns_verse_with_expected_fields(self, client):
        r = client.get(f"{API}/verse/today")
        assert r.status_code == 200, r.text
        v = r.json()
        for k in ("id", "text", "reference", "book", "chapter", "verse"):
            assert k in v, f"missing field {k} in verse doc: {v.keys()}"
        assert isinstance(v["text"], str) and v["text"]
        assert isinstance(v["reference"], str) and v["reference"]

    def test_today_deterministic_same_day(self, client):
        a = client.get(f"{API}/verse/today").json()
        b = client.get(f"{API}/verse/today").json()
        assert a["id"] == b["id"], "verse/today must be deterministic across calls on same day"


# ---------- Public: /verse/{id} ----------
class TestVerseById:
    def test_get_by_id_ok(self, client):
        today = client.get(f"{API}/verse/today").json()
        r = client.get(f"{API}/verse/{today['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == today["id"]

    def test_get_by_id_404(self, client):
        r = client.get(f"{API}/verse/verse_does_not_exist_xyz")
        assert r.status_code == 404


# ---------- Admin listing / search ----------
class TestAdminList:
    def test_no_token_returns_401(self, client):
        r = client.get(f"{API}/admin/verses")
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_list_includes_seeded_124(self, client, admin_headers):
        r = client.get(f"{API}/admin/verses", headers=admin_headers)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        assert len(docs) >= 124, f"expected >=124 seeded verses, got {len(docs)}"
        # sanity: docs have required fields
        d0 = docs[0]
        for k in ("id", "text", "reference"):
            assert k in d0

    def test_search_by_reference(self, client, admin_headers):
        r = client.get(f"{API}/admin/verses", headers=admin_headers, params={"search": "Giovanni"})
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) > 0
        for d in docs:
            hay = (d.get("reference", "") + " " + d.get("text", "")).lower()
            assert "giovanni" in hay

    def test_search_by_text_substring(self, client, admin_headers):
        # 'pastore' appears in Salmi 23:1 seed
        r = client.get(f"{API}/admin/verses", headers=admin_headers, params={"search": "pastore"})
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 1
        assert any("pastore" in d.get("text", "").lower() for d in docs)


# ---------- Admin CRUD ----------
class TestAdminCRUD:
    created_ids = []

    def test_create_verse(self, client, admin_headers):
        payload = {
            "text": "TEST_ verse text for automated testing",
            "reference": "TEST_Ref 1:1",
            "book": "TEST_Book",
            "chapter": 1,
            "verse": 1,
            "active": True,
        }
        r = client.post(f"{API}/admin/verses", headers=admin_headers, json=payload)
        assert r.status_code == 201, f"{r.status_code} {r.text}"
        j = r.json()
        assert j.get("ok") is True
        assert j.get("id")
        TestAdminCRUD.created_ids.append(j["id"])

        # appears in admin list
        lst = client.get(f"{API}/admin/verses", headers=admin_headers).json()
        assert any(d["id"] == j["id"] for d in lst)

        # public GET by id works
        g = client.get(f"{API}/verse/{j['id']}")
        assert g.status_code == 200
        assert g.json()["text"] == payload["text"]

    def test_create_no_token_401(self, client):
        r = client.post(f"{API}/admin/verses", json={"text": "x", "reference": "y"})
        assert r.status_code == 401

    def test_patch_updates_text(self, client, admin_headers):
        vid = TestAdminCRUD.created_ids[0]
        new_text = "TEST_ updated verse text"
        r = client.patch(f"{API}/admin/verses/{vid}", headers=admin_headers, json={"text": new_text})
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # verify persisted
        g = client.get(f"{API}/verse/{vid}").json()
        assert g["text"] == new_text

    def test_patch_no_token_401(self, client):
        vid = TestAdminCRUD.created_ids[0]
        r = client.patch(f"{API}/admin/verses/{vid}", json={"text": "hack"})
        assert r.status_code == 401

    def test_patch_unknown_id_404(self, client, admin_headers):
        r = client.patch(f"{API}/admin/verses/verse_missing_zzz", headers=admin_headers, json={"text": "x"})
        assert r.status_code == 404

    def test_inactive_excluded_from_today(self, client, admin_headers):
        """Set every currently-active seeded verse to inactive except one TEST verse we control.
        Faster approach: create a new active TEST verse, deactivate all others, verify verse/today
        returns the TEST one; then restore.
        """
        # Create the "only active" test verse
        payload = {
            "text": "TEST_ only-active verse for today rotation check",
            "reference": "TEST_Only 1:1",
            "book": "TEST_Only",
            "chapter": 1,
            "verse": 1,
            "active": True,
        }
        r = client.post(f"{API}/admin/verses", headers=admin_headers, json=payload)
        assert r.status_code == 201
        only_id = r.json()["id"]
        TestAdminCRUD.created_ids.append(only_id)

        # Deactivate everything except only_id
        all_docs = client.get(f"{API}/admin/verses", headers=admin_headers).json()
        deactivated = []
        for d in all_docs:
            if d["id"] != only_id and d.get("active", True) is not False:
                rr = client.patch(
                    f"{API}/admin/verses/{d['id']}", headers=admin_headers, json={"active": False}
                )
                assert rr.status_code == 200
                deactivated.append(d["id"])

        try:
            today = client.get(f"{API}/verse/today")
            assert today.status_code == 200
            assert today.json()["id"] == only_id, (
                f"expected today = only active verse, got {today.json()['id']}"
            )

            # Now also flip only_id inactive and verify it's excluded (should pick something else
            # or 404 if none active). We'll re-activate one first, then flip only_id off.
            # Reactivate ONE original verse to serve as the "other" active one.
            other_id = deactivated[0]
            rr = client.patch(
                f"{API}/admin/verses/{other_id}", headers=admin_headers, json={"active": True}
            )
            assert rr.status_code == 200
            # Deactivate only_id
            rr = client.patch(
                f"{API}/admin/verses/{only_id}", headers=admin_headers, json={"active": False}
            )
            assert rr.status_code == 200
            today2 = client.get(f"{API}/verse/today")
            assert today2.status_code == 200
            assert today2.json()["id"] == other_id, (
                f"inactive verse must be excluded; got {today2.json()['id']}"
            )
        finally:
            # Restore: reactivate everything we deactivated
            for did in deactivated:
                client.patch(f"{API}/admin/verses/{did}", headers=admin_headers, json={"active": True})
            # Ensure only_id is inactive so it never surfaces publicly after cleanup delete
            client.patch(f"{API}/admin/verses/{only_id}", headers=admin_headers, json={"active": False})

    def test_delete_no_token_401(self, client):
        r = client.delete(f"{API}/admin/verses/{TestAdminCRUD.created_ids[0]}")
        assert r.status_code == 401

    def test_zzz_cleanup_delete_test_verses(self, client, admin_headers):
        """Delete all TEST_-prefixed verses we created (do NOT touch seeded ones)."""
        # Delete our tracked ids
        for vid in TestAdminCRUD.created_ids:
            r = client.delete(f"{API}/admin/verses/{vid}", headers=admin_headers)
            assert r.status_code == 200
            # verify gone
            g = client.get(f"{API}/verse/{vid}")
            assert g.status_code == 404
        # Extra safety net: purge any lingering TEST_ verses
        lst = client.get(f"{API}/admin/verses", headers=admin_headers).json()
        for d in lst:
            if str(d.get("reference", "")).startswith("TEST_") or str(d.get("book", "")).startswith("TEST_"):
                client.delete(f"{API}/admin/verses/{d['id']}", headers=admin_headers)
