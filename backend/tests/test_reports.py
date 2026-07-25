"""Tests for the Segnalazioni / Feedback feature (/api/reports and /api/admin/reports/*).

Covers:
- Guest submission (no auth)
- Authenticated submission (user_id/name/email captured)
- Validation: empty title, empty description, invalid category, oversized attachment (413)
- Admin list with filters (status, category, search) + sort (asc/desc)
- Admin unread-count endpoint
- Admin GET single: full payload (with base64) + auto mark read + 404
- Admin PATCH status: valid transitions + invalid status + 404
- Admin DELETE
- Admin stats includes 'reports' and 'reports_new'
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_TOKEN = "ADMINTESTTOKEN123"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}


# ---------- helpers ----------
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_token(http):
    """Return a bearer token for a public user (registers TEST_ user)."""
    email = f"TEST_reports_{uuid.uuid4().hex[:8]}@pescatoridiuomini.it"
    r = http.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!", "name": "TEST Reports User"})
    assert r.status_code == 200, r.text
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="module")
def created_report_ids():
    return []


def _create_report(http, payload, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return http.post(f"{API}/reports", json=payload, headers=headers)


# ---------- POST /api/reports ----------
class TestCreateReport:
    def test_guest_submission(self, http, created_report_ids):
        payload = {"category": "bug", "title": "TEST_guest_bug", "description": "Guest report description"}
        r = _create_report(http, payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "id" in body and body["id"].startswith("rep_")
        created_report_ids.append(body["id"])

        # Verify via admin GET that user fields are null
        g = requests.get(f"{API}/admin/reports/{body['id']}", headers=ADMIN_HEADERS)
        assert g.status_code == 200, g.text
        doc = g.json()
        assert doc["user_id"] is None
        assert doc["user_name"] is None
        assert doc["user_email"] is None
        assert doc["status"] == "new"
        assert doc["category"] == "bug"

    def test_authenticated_submission_captures_user(self, http, user_token, created_report_ids):
        token, user = user_token
        payload = {"category": "suggestion", "title": "TEST_auth_sugg", "description": "Auth user suggestion"}
        r = _create_report(http, payload, token=token)
        assert r.status_code == 201, r.text
        rid = r.json()["id"]
        created_report_ids.append(rid)

        g = requests.get(f"{API}/admin/reports/{rid}", headers=ADMIN_HEADERS)
        assert g.status_code == 200
        doc = g.json()
        assert doc["user_id"] == user["user_id"]
        assert doc["user_email"] == user["email"]
        assert doc["user_name"] == user["name"]

    def test_empty_title_400(self, http):
        r = _create_report(http, {"category": "bug", "title": "   ", "description": "desc"})
        assert r.status_code == 400
        assert "titolo" in r.text.lower()

    def test_empty_description_400(self, http):
        r = _create_report(http, {"category": "bug", "title": "TEST_only_title", "description": ""})
        assert r.status_code == 400
        assert "descrizione" in r.text.lower()

    def test_invalid_category_400(self, http):
        r = _create_report(http, {"category": "not-a-category", "title": "TEST_bad_cat", "description": "d"})
        assert r.status_code == 400
        assert "categoria" in r.text.lower()

    def test_oversized_attachment_413(self, http):
        big = "A" * 12_000_001
        payload = {"category": "bug", "title": "TEST_big", "description": "d", "screenshot": big}
        r = _create_report(http, payload)
        assert r.status_code == 413, f"expected 413 got {r.status_code}: {r.text[:200]}"


# ---------- Admin list & filters ----------
class TestAdminList:
    def test_list_excludes_heavy_attachments(self, http, created_report_ids):
        # Create a report with a small base64 payload
        small_b64 = "data:image/png;base64," + "B" * 5000
        r = _create_report(http, {"category": "technical", "title": "TEST_with_shot", "description": "d", "screenshot": small_b64})
        assert r.status_code == 201
        rid = r.json()["id"]
        created_report_ids.append(rid)

        lst = requests.get(f"{API}/admin/reports", headers=ADMIN_HEADERS)
        assert lst.status_code == 200
        docs = lst.json()
        assert isinstance(docs, list) and len(docs) >= 1
        found = next((d for d in docs if d["id"] == rid), None)
        assert found is not None
        # Heavy fields must be absent
        assert "screenshot" not in found
        assert "video" not in found

    def test_list_filter_by_status_and_category(self, http):
        lst = requests.get(f"{API}/admin/reports", params={"status": "new", "category": "bug"}, headers=ADMIN_HEADERS)
        assert lst.status_code == 200
        for d in lst.json():
            assert d["status"] == "new"
            assert d["category"] == "bug"

    def test_list_search(self, http):
        lst = requests.get(f"{API}/admin/reports", params={"search": "TEST_guest_bug"}, headers=ADMIN_HEADERS)
        assert lst.status_code == 200
        titles = [d["title"] for d in lst.json()]
        assert any("TEST_guest_bug" in t for t in titles)

    def test_list_sort(self, http):
        desc = requests.get(f"{API}/admin/reports", params={"sort": "desc"}, headers=ADMIN_HEADERS).json()
        asc = requests.get(f"{API}/admin/reports", params={"sort": "asc"}, headers=ADMIN_HEADERS).json()
        if len(desc) >= 2 and len(asc) >= 2:
            assert desc[0]["created_at"] >= desc[-1]["created_at"]
            assert asc[0]["created_at"] <= asc[-1]["created_at"]

    def test_unread_count(self, http):
        r = requests.get(f"{API}/admin/reports/unread-count", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert "count" in body and isinstance(body["count"], int)


# ---------- Admin single report ----------
class TestAdminSingle:
    def test_get_marks_read(self, http, created_report_ids):
        # Create fresh report
        r = _create_report(http, {"category": "other", "title": "TEST_read_flag", "description": "d"})
        assert r.status_code == 201
        rid = r.json()["id"]
        created_report_ids.append(rid)

        # Before opening: appears in list with read=False
        lst = requests.get(f"{API}/admin/reports", headers=ADMIN_HEADERS).json()
        pre = next((d for d in lst if d["id"] == rid), None)
        assert pre is not None
        assert pre.get("read") in (False, None)

        g = requests.get(f"{API}/admin/reports/{rid}", headers=ADMIN_HEADERS)
        assert g.status_code == 200
        assert g.json()["read"] is True

        # After opening: subsequent list entry has read=True
        lst2 = requests.get(f"{API}/admin/reports", headers=ADMIN_HEADERS).json()
        post = next((d for d in lst2 if d["id"] == rid), None)
        assert post is not None
        assert post["read"] is True

    def test_get_returns_attachments(self, http, created_report_ids):
        small_b64 = "data:image/png;base64," + "C" * 2000
        r = _create_report(http, {"category": "bug", "title": "TEST_attach_full", "description": "d", "screenshot": small_b64})
        assert r.status_code == 201
        rid = r.json()["id"]
        created_report_ids.append(rid)
        g = requests.get(f"{API}/admin/reports/{rid}", headers=ADMIN_HEADERS)
        assert g.status_code == 200
        assert g.json().get("screenshot") == small_b64

    def test_get_missing_404(self):
        g = requests.get(f"{API}/admin/reports/rep_doesnotexist_xyz", headers=ADMIN_HEADERS)
        assert g.status_code == 404


# ---------- Admin PATCH ----------
class TestAdminPatch:
    def test_status_transitions(self, http, created_report_ids):
        r = _create_report(http, {"category": "bug", "title": "TEST_workflow", "description": "d"})
        rid = r.json()["id"]
        created_report_ids.append(rid)
        for st in ["in_progress", "resolved", "closed", "new"]:
            p = requests.patch(f"{API}/admin/reports/{rid}", json={"status": st}, headers=ADMIN_HEADERS)
            assert p.status_code == 200, f"status={st}: {p.text}"
            g = requests.get(f"{API}/admin/reports/{rid}", headers=ADMIN_HEADERS)
            assert g.json()["status"] == st

    def test_invalid_status_400(self, http, created_report_ids):
        r = _create_report(http, {"category": "bug", "title": "TEST_bad_st", "description": "d"})
        rid = r.json()["id"]
        created_report_ids.append(rid)
        p = requests.patch(f"{API}/admin/reports/{rid}", json={"status": "banana"}, headers=ADMIN_HEADERS)
        assert p.status_code == 400

    def test_patch_missing_404(self):
        p = requests.patch(f"{API}/admin/reports/rep_missing_xyz", json={"status": "new"}, headers=ADMIN_HEADERS)
        assert p.status_code == 404


# ---------- Admin stats ----------
class TestAdminStats:
    def test_stats_includes_reports_fields(self):
        r = requests.get(f"{API}/admin/stats", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert "reports" in body
        assert "reports_new" in body
        assert isinstance(body["reports"], int)
        assert isinstance(body["reports_new"], int)


# ---------- Admin DELETE + cleanup ----------
class TestAdminDelete:
    def test_delete_report(self, http):
        r = _create_report(http, {"category": "bug", "title": "TEST_to_delete", "description": "d"})
        rid = r.json()["id"]
        d = requests.delete(f"{API}/admin/reports/{rid}", headers=ADMIN_HEADERS)
        assert d.status_code == 200
        g = requests.get(f"{API}/admin/reports/{rid}", headers=ADMIN_HEADERS)
        assert g.status_code == 404


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_reports_at_end():
    """After the entire session (all workers), purge lingering TEST_ reports.

    We register this on both workers; last-worker-wins is fine because DELETE is idempotent.
    Kept as session-scope (not module) to avoid a race with pytest-xdist workers where an
    earlier-finishing worker would wipe reports still in use on another worker.
    """
    yield
    try:
        lst = requests.get(f"{API}/admin/reports", params={"search": "TEST_"}, headers=ADMIN_HEADERS)
        if lst.status_code == 200:
            for d in lst.json():
                requests.delete(f"{API}/admin/reports/{d['id']}", headers=ADMIN_HEADERS)
    except Exception:
        pass
