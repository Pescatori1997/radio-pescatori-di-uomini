"""
Iteration 6 tests: NEW admin endpoints (Prayers, Messages/Testimonies, Programs,
Radio, Settings, Users) + HTTP 201 for POST /admin/podcasts and /admin/news.

Uses the seeded admin token ADMINTESTTOKEN123 (see conftest.py) for admin auth.
Registers a fresh non-admin test user each session for 403 checks.
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"

ADMIN_H = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


# ---------- shared fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def user_token(api):
    """Register a fresh non-admin user and return its bearer token."""
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Test1234!", "name": "TEST User"
    })
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _user_h(t):
    return {"Authorization": f"Bearer {t}"}


# =========================================================
# AUTH GUARD: 401 without token, 403 for non-admin user
# =========================================================
NEW_ADMIN_GET_ENDPOINTS = [
    "/api/admin/prayers",
    "/api/admin/messages",
    "/api/admin/programs",
    "/api/admin/radio",
    "/api/admin/settings",
    "/api/admin/users",
]


class TestAuthGuard:
    @pytest.mark.parametrize("path", NEW_ADMIN_GET_ENDPOINTS)
    def test_401_without_token(self, api, path):
        r = api.get(f"{BASE_URL}{path}")
        assert r.status_code == 401, f"{path} -> {r.status_code}: {r.text}"

    @pytest.mark.parametrize("path", NEW_ADMIN_GET_ENDPOINTS)
    def test_403_non_admin(self, api, path, user_token):
        r = api.get(f"{BASE_URL}{path}", headers=_user_h(user_token))
        assert r.status_code == 403, f"{path} -> {r.status_code}: {r.text}"

    @pytest.mark.parametrize("path", NEW_ADMIN_GET_ENDPOINTS)
    def test_200_admin(self, api, path):
        r = api.get(f"{BASE_URL}{path}", headers=ADMIN_H)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text}"


# =========================================================
# ADMIN: PRAYERS
# =========================================================
class TestAdminPrayers:
    def test_prayer_full_lifecycle(self, api):
        # 1) create via public endpoint
        r = api.post(f"{BASE_URL}/api/prayer-requests",
                     json={"text": "TEST_prayer content", "name": "TEST Anna", "anonymous": False})
        assert r.status_code == 200

        # 2) list new-status prayers and find ours
        r = api.get(f"{BASE_URL}/api/admin/prayers?status=new&search=TEST_prayer",
                    headers=ADMIN_H)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        target = next((x for x in items if x.get("text") == "TEST_prayer content"), None)
        assert target is not None, "created prayer not returned in admin list"
        assert target.get("status") == "new"
        pid = target["id"]

        # 3) GET by id
        r = api.get(f"{BASE_URL}/api/admin/prayers/{pid}", headers=ADMIN_H)
        assert r.status_code == 200
        assert r.json()["id"] == pid

        # 4) invalid status => 400
        r = api.patch(f"{BASE_URL}/api/admin/prayers/{pid}",
                      json={"status": "banana"}, headers=ADMIN_H)
        assert r.status_code == 400

        # 5) valid patch: status + admin_notes; verify persistence via GET
        for st in ("in_progress", "prayed", "archived"):
            r = api.patch(f"{BASE_URL}/api/admin/prayers/{pid}",
                          json={"status": st, "admin_notes": f"note-{st}"}, headers=ADMIN_H)
            assert r.status_code == 200
            r = api.get(f"{BASE_URL}/api/admin/prayers/{pid}", headers=ADMIN_H)
            data = r.json()
            assert data["status"] == st
            assert data["admin_notes"] == f"note-{st}"

        # 6) status filter matches archived
        r = api.get(f"{BASE_URL}/api/admin/prayers?status=archived", headers=ADMIN_H)
        assert r.status_code == 200
        assert any(x["id"] == pid for x in r.json())

        # 7) delete + verify 404
        r = api.delete(f"{BASE_URL}/api/admin/prayers/{pid}", headers=ADMIN_H)
        assert r.status_code == 200
        r = api.get(f"{BASE_URL}/api/admin/prayers/{pid}", headers=ADMIN_H)
        assert r.status_code == 404


# =========================================================
# ADMIN: MESSAGES / TESTIMONIES + Public Testimonies
# =========================================================
class TestAdminMessagesAndTestimonies:
    def test_messages_and_testimonies_workflow(self, api):
        # create one 'message' and two 'testimony'
        r1 = api.post(f"{BASE_URL}/api/messages", json={
            "text": "TEST_msg content", "name": "TEST User", "type": "message"})
        assert r1.status_code == 200
        r2 = api.post(f"{BASE_URL}/api/messages", json={
            "text": "TEST_testimony PUBLISHED content", "name": "TEST User", "type": "testimony"})
        assert r2.status_code == 200
        r3 = api.post(f"{BASE_URL}/api/messages", json={
            "text": "TEST_testimony HIDDEN content", "name": "TEST Hidden", "type": "testimony"})
        assert r3.status_code == 200

        # list with search
        r = api.get(f"{BASE_URL}/api/admin/messages?search=TEST_", headers=ADMIN_H)
        assert r.status_code == 200
        items = r.json()
        msg = next(x for x in items if x["text"] == "TEST_msg content")
        pub = next(x for x in items if x["text"] == "TEST_testimony PUBLISHED content")
        hid = next(x for x in items if x["text"] == "TEST_testimony HIDDEN content")
        assert msg["type"] == "message" and msg["status"] == "new"
        assert pub["type"] == "testimony" and pub["status"] == "new"

        # filter by type=testimony
        r = api.get(f"{BASE_URL}/api/admin/messages?type=testimony&search=TEST_",
                    headers=ADMIN_H)
        assert r.status_code == 200
        assert all(x["type"] == "testimony" for x in r.json())

        # filter by status=new
        r = api.get(f"{BASE_URL}/api/admin/messages?status=new&search=TEST_",
                    headers=ADMIN_H)
        assert r.status_code == 200
        assert all(x["status"] == "new" for x in r.json())

        # GET by id
        r = api.get(f"{BASE_URL}/api/admin/messages/{pub['id']}", headers=ADMIN_H)
        assert r.status_code == 200 and r.json()["id"] == pub["id"]

        # invalid status => 400
        r = api.patch(f"{BASE_URL}/api/admin/messages/{pub['id']}",
                      json={"status": "foo"}, headers=ADMIN_H)
        assert r.status_code == 400

        # PATCH: publish + edit text/admin_notes -> published_at populated
        r = api.patch(f"{BASE_URL}/api/admin/messages/{pub['id']}", json={
            "status": "published",
            "admin_notes": "notes-published",
            "text": "TEST_testimony PUBLISHED content edited",
            "name": "TEST User Edited",
        }, headers=ADMIN_H)
        assert r.status_code == 200
        r = api.get(f"{BASE_URL}/api/admin/messages/{pub['id']}", headers=ADMIN_H)
        d = r.json()
        assert d["status"] == "published"
        assert d.get("published_at"), "published_at should be set when status=published"
        assert d["text"] == "TEST_testimony PUBLISHED content edited"
        assert d["name"] == "TEST User Edited"
        assert d["admin_notes"] == "notes-published"

        # set hidden testimony to reviewed (should NOT appear publicly)
        r = api.patch(f"{BASE_URL}/api/admin/messages/{hid['id']}", json={
            "status": "reviewed", "admin_notes": "hidden-notes"}, headers=ADMIN_H)
        assert r.status_code == 200

        # public /api/testimonies: shows published, hides other, no admin_notes
        r = api.get(f"{BASE_URL}/api/testimonies")
        assert r.status_code == 200
        pubs = r.json()
        assert any(x["id"] == pub["id"] for x in pubs), "published testimony not exposed publicly"
        assert not any(x["id"] == hid["id"] for x in pubs), "non-published testimony leaked publicly"
        for x in pubs:
            assert "admin_notes" not in x, "admin_notes must not appear in public testimonies"
            assert x.get("type") == "testimony"
            assert x.get("status") == "published"

        # cleanup: delete all three
        for _id in (msg["id"], pub["id"], hid["id"]):
            r = api.delete(f"{BASE_URL}/api/admin/messages/{_id}", headers=ADMIN_H)
            assert r.status_code == 200
        r = api.get(f"{BASE_URL}/api/admin/messages/{pub['id']}", headers=ADMIN_H)
        assert r.status_code == 404


# =========================================================
# ADMIN: PROGRAMS (Palinsesto) + HTTP 201
# =========================================================
class TestAdminPrograms:
    def test_program_crud_and_201(self, api):
        r = api.post(f"{BASE_URL}/api/admin/programs", headers=ADMIN_H, json={
            "name": "TEST_Program", "time": "09:00", "day": "Lunedì",
            "host": "TEST Host", "description": "TEST desc"
        })
        assert r.status_code == 201, f"expected 201, got {r.status_code}: {r.text}"
        pid = r.json()["id"]

        r = api.get(f"{BASE_URL}/api/admin/programs", headers=ADMIN_H)
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())

        r = api.patch(f"{BASE_URL}/api/admin/programs/{pid}", headers=ADMIN_H, json={
            "name": "TEST_Program Edited", "time": "10:30"
        })
        assert r.status_code == 200

        r = api.get(f"{BASE_URL}/api/admin/programs", headers=ADMIN_H)
        prog = next(p for p in r.json() if p["id"] == pid)
        assert prog["name"] == "TEST_Program Edited"
        assert prog["time"] == "10:30"

        r = api.delete(f"{BASE_URL}/api/admin/programs/{pid}", headers=ADMIN_H)
        assert r.status_code == 200

        r = api.get(f"{BASE_URL}/api/admin/programs", headers=ADMIN_H)
        assert not any(p["id"] == pid for p in r.json())


# =========================================================
# ADMIN: RADIO SETTINGS + public /live/status
# =========================================================
class TestAdminRadio:
    def test_radio_get_and_update_persists(self, api):
        # snapshot current state
        r0 = api.get(f"{BASE_URL}/api/admin/radio", headers=ADMIN_H)
        assert r0.status_code == 200
        original = r0.json()

        new_stream = "https://ice1.somafm.com/christmas-128-mp3?TEST=1"
        payload = {
            "station_name": "TEST Pescatori",
            "stream_url": new_stream,
            "backup_url": "https://backup.example.com/stream",
            "metadata_url": "https://meta.example.com/now",
            "is_live": False,
            "title": "TEST Title",
            "artist": "TEST Artist",
            "artwork": "https://example.com/art.jpg",
        }
        r = api.put(f"{BASE_URL}/api/admin/radio", headers=ADMIN_H, json=payload)
        assert r.status_code == 200
        for k, v in payload.items():
            assert r.json().get(k) == v

        # re-GET reflects changes
        r = api.get(f"{BASE_URL}/api/admin/radio", headers=ADMIN_H)
        assert r.status_code == 200
        for k, v in payload.items():
            assert r.json().get(k) == v

        # public live status reflects updated fields
        r = api.get(f"{BASE_URL}/api/live/status")
        assert r.status_code == 200
        pub = r.json()
        assert pub.get("stream_url") == new_stream
        assert pub.get("is_live") is False
        assert pub.get("title") == "TEST Title"

        # restore original (best-effort)
        restore = {k: original.get(k) for k in payload.keys() if k in original}
        if restore:
            api.put(f"{BASE_URL}/api/admin/radio", headers=ADMIN_H, json=restore)


# =========================================================
# ADMIN: GENERAL SETTINGS + public /settings
# =========================================================
class TestAdminSettings:
    def test_settings_get_update_persist_and_public(self, api):
        r0 = api.get(f"{BASE_URL}/api/admin/settings", headers=ADMIN_H)
        assert r0.status_code == 200
        original = r0.json()

        payload = {
            "contact_email": "TEST_contact@example.com",
            "contact_phone": "+39 000 0000000",
            "address": "TEST Via Roma 1",
            "facebook": "https://facebook.com/testpdu",
            "instagram": "https://instagram.com/testpdu",
            "youtube": "https://youtube.com/@testpdu",
            "whatsapp": "+39 000 0000001",
            "about_short": "TEST about short blurb",
        }
        r = api.put(f"{BASE_URL}/api/admin/settings", headers=ADMIN_H, json=payload)
        assert r.status_code == 200
        for k, v in payload.items():
            assert r.json().get(k) == v

        r = api.get(f"{BASE_URL}/api/admin/settings", headers=ADMIN_H)
        for k, v in payload.items():
            assert r.json().get(k) == v

        # public settings mirrors admin
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        pub = r.json()
        for k, v in payload.items():
            assert pub.get(k) == v

        # restore original
        restore = {k: original.get(k, "") for k in payload.keys()}
        api.put(f"{BASE_URL}/api/admin/settings", headers=ADMIN_H, json=restore)


# =========================================================
# ADMIN: USERS
# =========================================================
class TestAdminUsers:
    def test_users_list_and_delete_rules(self, api):
        # create a fresh normal user
        email = f"TEST_del_{uuid.uuid4().hex[:8]}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"email": email, "password": "Test1234!", "name": "TEST DEL"})
        assert r.status_code == 200
        new_uid = r.json()["user"]["user_id"]

        # list users (search filter + is_admin flag present)
        r = api.get(f"{BASE_URL}/api/admin/users?search=TEST_del_", headers=ADMIN_H)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        # all items should have is_admin key
        for u in items:
            assert "is_admin" in u
            assert "password" not in u

        # find admin user via search
        r = api.get(f"{BASE_URL}/api/admin/users?search=pescatoridiuomini", headers=ADMIN_H)
        assert r.status_code == 200
        admin_row = next((u for u in r.json()
                          if (u.get("email") or "").lower() == "pescatoridiuomini@outlook.it"),
                         None)
        assert admin_row is not None, "admin user missing from search"
        assert admin_row["is_admin"] is True

        # cannot delete an admin user -> 400
        r = api.delete(f"{BASE_URL}/api/admin/users/{admin_row['user_id']}",
                       headers=ADMIN_H)
        assert r.status_code == 400

        # can delete a normal user -> 200
        r = api.delete(f"{BASE_URL}/api/admin/users/{new_uid}", headers=ADMIN_H)
        assert r.status_code == 200

        # confirm gone
        r = api.get(f"{BASE_URL}/api/admin/users?search={email}", headers=ADMIN_H)
        assert not any(u["user_id"] == new_uid for u in r.json())


# =========================================================
# HTTP 201 for existing CMS creates
# =========================================================
class TestHTTP201:
    def test_post_podcasts_returns_201(self, api):
        r = api.post(f"{BASE_URL}/api/admin/podcasts", headers=ADMIN_H, json={
            "title": "TEST_201_podcast", "published": False, "featured": False
        })
        assert r.status_code == 201, f"got {r.status_code}: {r.text}"
        pid = r.json().get("id")
        assert pid
        # cleanup
        api.delete(f"{BASE_URL}/api/admin/podcasts/{pid}", headers=ADMIN_H)

    def test_post_news_returns_201(self, api):
        r = api.post(f"{BASE_URL}/api/admin/news", headers=ADMIN_H, json={
            "title": "TEST_201_news", "published": False, "featured": False
        })
        assert r.status_code == 201, f"got {r.status_code}: {r.text}"
        nid = r.json().get("id")
        assert nid
        api.delete(f"{BASE_URL}/api/admin/news/{nid}", headers=ADMIN_H)
