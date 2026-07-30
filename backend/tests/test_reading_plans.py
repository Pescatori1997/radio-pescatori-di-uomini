"""Backend tests for Bible Reading Plans (Piani di Lettura) — Phase 3.

Covers:
- Public list / detail endpoints
- Listener enroll / progress / toggle / unenroll flows
- Admin CRUD (create draft -> not in public; publish -> visible; delete)
- Authorization (listener -> 403 on admin routes; missing token -> 401)
- Regression: bible/books and bible/chapter
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = "https://evangelic-stream.preview.emergentagent.com/api"
ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PWD = "AdminTestPwd1!"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def listener_token(api):
    email = f"rp_test_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/auth/register", json={
        "email": email, "password": "Test1234!", "name": "RP Tester"
    })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("session_token")
    if not tok:
        lg = api.post(f"{BASE_URL}/auth/login", json={"email": email, "password": "Test1234!"})
        assert lg.status_code == 200
        tok = lg.json()["token"]
    return tok


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ----- Public endpoints -----
class TestPublicReadingPlans:
    def test_list_returns_two_seeded_published(self, api):
        r = api.get(f"{BASE_URL}/reading-plans")
        assert r.status_code == 200, r.text
        plans = r.json()
        assert isinstance(plans, list)
        # Filter (in case admin drafts were pushed here inadvertently)
        durations = sorted(p.get("duration_days") for p in plans)
        assert 7 in durations, f"expected duration 7 in list, got {durations}"
        assert 30 in durations, f"expected duration 30 in list, got {durations}"
        # Trimmed: no `days` payload in list responses
        for p in plans:
            assert "days" not in p, "list should be trimmed (no days)"
            assert "id" in p and "title" in p and "duration_days" in p
        # Exactly the two seeded ones (nothing else) expected
        assert len(plans) == 2, f"expected exactly 2 published plans, got {len(plans)}: {plans}"

    def test_detail_returns_full_days(self, api):
        r = api.get(f"{BASE_URL}/reading-plans")
        plans = r.json()
        # pick the 7-day one
        p7 = next(p for p in plans if p["duration_days"] == 7)
        r2 = api.get(f"{BASE_URL}/reading-plans/{p7['id']}")
        assert r2.status_code == 200, r2.text
        detail = r2.json()
        assert detail["id"] == p7["id"]
        assert isinstance(detail.get("days"), list)
        assert len(detail["days"]) == detail["duration_days"] == 7
        # each day has readings with book_nr/chapter/label
        for d in detail["days"]:
            assert isinstance(d.get("readings"), list) and len(d["readings"]) >= 1
            rd0 = d["readings"][0]
            assert isinstance(rd0.get("book_nr"), int)
            assert isinstance(rd0.get("chapter"), int)
            assert rd0.get("label")
        assert detail.get("enrollment") is None, "unauth call must have enrollment=null"

    def test_detail_404_for_unknown(self, api):
        r = api.get(f"{BASE_URL}/reading-plans/nonexistent-id-xyz")
        assert r.status_code == 404


# ----- Listener enrollment / progress -----
class TestListenerEnrollment:
    def test_enroll_and_list_and_progress(self, api, listener_token):
        # get 7-day plan id
        plans = api.get(f"{BASE_URL}/reading-plans").json()
        p = next(x for x in plans if x["duration_days"] == 7)
        pid = p["id"]

        # Enroll
        r = api.post(f"{BASE_URL}/me/reading-plans/{pid}/enroll", headers=_h(listener_token))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # My reading plans -> percent 0
        r2 = api.get(f"{BASE_URL}/me/reading-plans", headers=_h(listener_token))
        assert r2.status_code == 200, r2.text
        mine = r2.json()
        assert any(m["id"] == pid for m in mine)
        me_plan = next(m for m in mine if m["id"] == pid)
        assert me_plan["progress"]["percent"] == 0
        assert me_plan["progress"]["completed_count"] == 0

        # Toggle day 1 done
        r3 = api.post(f"{BASE_URL}/me/reading-plans/{pid}/day/1", json={"done": True}, headers=_h(listener_token))
        assert r3.status_code == 200, r3.text
        prog = r3.json()["progress"]
        assert prog["completed_count"] == 1
        assert prog["percent"] > 0
        assert 1 in prog["completed_days"]

        # Toggle day 1 off
        r4 = api.post(f"{BASE_URL}/me/reading-plans/{pid}/day/1", json={"done": False}, headers=_h(listener_token))
        assert r4.status_code == 200, r4.text
        prog2 = r4.json()["progress"]
        assert prog2["completed_count"] == 0

        # Invalid day 0
        r5 = api.post(f"{BASE_URL}/me/reading-plans/{pid}/day/0", json={"done": True}, headers=_h(listener_token))
        assert r5.status_code == 400

        # Invalid day > duration
        r6 = api.post(f"{BASE_URL}/me/reading-plans/{pid}/day/999", json={"done": True}, headers=_h(listener_token))
        assert r6.status_code == 400

    def test_detail_shows_enrollment_when_auth(self, api, listener_token):
        plans = api.get(f"{BASE_URL}/reading-plans").json()
        p = next(x for x in plans if x["duration_days"] == 7)
        r = api.get(f"{BASE_URL}/reading-plans/{p['id']}", headers=_h(listener_token))
        assert r.status_code == 200
        assert r.json().get("enrollment") is not None

    def test_unenroll_clears_my_list(self, api, listener_token):
        plans = api.get(f"{BASE_URL}/reading-plans").json()
        p = next(x for x in plans if x["duration_days"] == 7)
        pid = p["id"]
        r = api.delete(f"{BASE_URL}/me/reading-plans/{pid}", headers=_h(listener_token))
        assert r.status_code == 200
        r2 = api.get(f"{BASE_URL}/me/reading-plans", headers=_h(listener_token))
        assert r2.status_code == 200
        mine = r2.json()
        assert not any(m["id"] == pid for m in mine), "plan should be removed after unenroll"


# ----- Admin CRUD -----
class TestAdminCRUD:
    def test_admin_crud_full_flow(self, api, admin_token):
        title = f"TEST_plan_{uuid.uuid4().hex[:6]}"
        payload = {
            "title": title,
            "subtitle": "test",
            "description": "TEST plan",
            "days": [
                {"day": 1, "title": "Day 1", "meditation": "med",
                 "readings": [{"book_nr": 43, "chapter": 3, "label": "Giovanni 3"}]},
            ],
            "featured": False,
            "status": "draft",
            "order": 999,
        }
        # Create draft
        r = api.post(f"{BASE_URL}/admin/reading-plans", json=payload, headers=_h(admin_token))
        assert r.status_code == 201, r.text
        pid = r.json()["id"]

        try:
            # DRAFT should NOT appear in public list
            pub = api.get(f"{BASE_URL}/reading-plans").json()
            assert not any(x["id"] == pid for x in pub), "draft plan must not be public"

            # Admin GET single
            r_g = api.get(f"{BASE_URL}/admin/reading-plans/{pid}", headers=_h(admin_token))
            assert r_g.status_code == 200
            assert r_g.json()["title"] == title
            assert len(r_g.json()["days"]) == 1

            # Admin GET list -> includes drafts
            r_l = api.get(f"{BASE_URL}/admin/reading-plans", headers=_h(admin_token))
            assert r_l.status_code == 200
            assert any(x["id"] == pid for x in r_l.json())

            # PUT to publish
            payload_pub = {**payload, "status": "published"}
            r_u = api.put(f"{BASE_URL}/admin/reading-plans/{pid}", json=payload_pub, headers=_h(admin_token))
            assert r_u.status_code == 200

            pub2 = api.get(f"{BASE_URL}/reading-plans").json()
            assert any(x["id"] == pid for x in pub2), "published plan must appear in public list"
        finally:
            # DELETE
            r_d = api.delete(f"{BASE_URL}/admin/reading-plans/{pid}", headers=_h(admin_token))
            assert r_d.status_code == 200
            # Confirm gone
            r_g2 = api.get(f"{BASE_URL}/admin/reading-plans/{pid}", headers=_h(admin_token))
            assert r_g2.status_code == 404

    def test_delete_also_removes_enrollments(self, api, admin_token, listener_token):
        # Create a published plan, enroll listener, then delete plan and ensure enrollment is gone
        title = f"TEST_del_{uuid.uuid4().hex[:6]}"
        payload = {
            "title": title, "days": [
                {"day": 1, "title": "d1", "readings": [{"book_nr": 43, "chapter": 3, "label": "Giovanni 3"}]},
            ], "status": "published", "order": 998,
        }
        r = api.post(f"{BASE_URL}/admin/reading-plans", json=payload, headers=_h(admin_token))
        assert r.status_code == 201
        pid = r.json()["id"]
        # Enroll listener
        api.post(f"{BASE_URL}/me/reading-plans/{pid}/enroll", headers=_h(listener_token))
        mine = api.get(f"{BASE_URL}/me/reading-plans", headers=_h(listener_token)).json()
        assert any(m["id"] == pid for m in mine)
        # Delete plan
        r_d = api.delete(f"{BASE_URL}/admin/reading-plans/{pid}", headers=_h(admin_token))
        assert r_d.status_code == 200
        # Enrollment is gone
        mine2 = api.get(f"{BASE_URL}/me/reading-plans", headers=_h(listener_token)).json()
        assert not any(m["id"] == pid for m in mine2)


# ----- Authorization -----
class TestAuthorization:
    def test_listener_forbidden_on_admin_routes(self, api, listener_token):
        r = api.get(f"{BASE_URL}/admin/reading-plans", headers=_h(listener_token))
        assert r.status_code == 403, f"expected 403 for listener, got {r.status_code}"

    def test_listener_forbidden_on_admin_post(self, api, listener_token):
        r = api.post(f"{BASE_URL}/admin/reading-plans",
                     json={"title": "x", "days": [], "status": "draft"},
                     headers=_h(listener_token))
        assert r.status_code == 403

    def test_missing_token_401(self, api):
        r = api.get(f"{BASE_URL}/admin/reading-plans")
        assert r.status_code == 401, f"expected 401 without token, got {r.status_code}"

    def test_invalid_token_401(self, api):
        r = api.get(f"{BASE_URL}/admin/reading-plans", headers={"Authorization": "Bearer invalid-token-xyz"})
        assert r.status_code == 401

    def test_me_reading_plans_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/me/reading-plans")
        assert r.status_code == 401


# ----- Regression -----
class TestBibleRegression:
    def test_bible_books(self, api):
        r = api.get(f"{BASE_URL}/bible/books")
        assert r.status_code == 200
        data = r.json()
        # Endpoint returns dict with at/nt arrays (OT/NT groupings)
        if isinstance(data, dict):
            assert len(data.get("at", [])) + len(data.get("nt", [])) >= 66
        else:
            assert isinstance(data, list) and len(data) > 0

    def test_bible_chapter(self, api):
        r = api.get(f"{BASE_URL}/bible/chapter?book=43&chapter=3")
        assert r.status_code == 200
        data = r.json()
        # Loose validation: verses should be present
        assert data
