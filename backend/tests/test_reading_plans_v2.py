"""Backend tests for Reading Plans — Session update (Jan 2026).

Covers new features:
- Granular permission 'plans' (was 'verses') for /api/admin/reading-plans*
- Cover field (base64 data URL) persisted on create/update and returned
  in admin/get and public list
- Regression on /api/reading-plans, enroll/day/unenroll
- Regression on /api/admin/verses (Versetto del Giorno) still uses 'verses'
"""
import os
import uuid
import base64
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = "https://evangelic-stream.preview.emergentagent.com/api"
ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PWD = "AdminTestPwd1!"

# Tiny 1x1 PNG base64 data URL used to test cover persistence
COVER_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _register_listener(api):
    import time as _time
    email = f"rp2_{uuid.uuid4().hex[:8]}@example.com"
    r = None
    for _ in range(10):
        r = api.post(f"{BASE_URL}/auth/register", json={
            "email": email, "password": "Test1234!", "name": "RP2 Tester"
        })
        if r.status_code != 429:
            break
        _time.sleep(6)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tok = data.get("token") or data.get("session_token")
    return email, tok


@pytest.fixture(scope="module")
def listener(api):
    return _register_listener(api)


def _make_collab(perms):
    """Directly promote a freshly-registered user to collaborator with given perms via Mongo.
    Returns (email, token, user_id)."""
    import time as _time
    api = requests.Session()
    api.headers.update({"Content-Type": "application/json"})
    email = f"collab_{uuid.uuid4().hex[:8]}@example.com"
    # Retry against 429 rate-limit
    r = None
    for _ in range(5):
        r = api.post(f"{BASE_URL}/auth/register", json={
            "email": email, "password": "Test1234!", "name": "Collab Tester"
        })
        if r.status_code != 429:
            break
        _time.sleep(2)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tok = data.get("token")
    uid = data.get("user", {}).get("user_id")

    async def _promote():
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["test_database"]
        await db.users.update_one({"user_id": uid}, {"$set": {
            "role": "collaborator", "permissions": perms
        }})
        client.close()
    asyncio.new_event_loop().run_until_complete(_promote())
    return email, tok, uid


# ---------- Granular permission 'plans' ----------
class TestGranularPermissionPlans:
    def test_collab_without_plans_perm_forbidden(self, api):
        _, tok, _ = _make_collab(perms=["news"])  # no plans
        # GET list
        r = api.get(f"{BASE_URL}/admin/reading-plans", headers=_h(tok))
        assert r.status_code == 403, r.text
        # POST
        r2 = api.post(f"{BASE_URL}/admin/reading-plans",
                      json={"title": "TEST_x", "days": [], "status": "draft"},
                      headers=_h(tok))
        assert r2.status_code == 403
        # PUT (using seeded id)
        r3 = api.put(f"{BASE_URL}/admin/reading-plans/plan_test_range",
                     json={"title": "x", "days": [], "status": "draft"},
                     headers=_h(tok))
        assert r3.status_code == 403
        # DELETE
        r4 = api.delete(f"{BASE_URL}/admin/reading-plans/plan_test_range", headers=_h(tok))
        assert r4.status_code == 403

    def test_collab_with_plans_perm_can_manage(self, api):
        _, tok, _ = _make_collab(perms=["plans"])
        # GET list allowed
        r = api.get(f"{BASE_URL}/admin/reading-plans", headers=_h(tok))
        assert r.status_code == 200, r.text
        # CREATE draft
        payload = {
            "title": f"TEST_collab_{uuid.uuid4().hex[:6]}",
            "days": [{"day": 1, "title": "d1", "readings": [{"book_nr": 43, "chapter": 3, "label": "Giovanni 3"}]}],
            "status": "draft",
        }
        rc = api.post(f"{BASE_URL}/admin/reading-plans", json=payload, headers=_h(tok))
        assert rc.status_code == 201, rc.text
        pid = rc.json()["id"]
        try:
            # UPDATE
            ru = api.put(f"{BASE_URL}/admin/reading-plans/{pid}",
                         json={**payload, "status": "draft", "subtitle": "updated"},
                         headers=_h(tok))
            assert ru.status_code == 200
        finally:
            rd = api.delete(f"{BASE_URL}/admin/reading-plans/{pid}", headers=_h(tok))
            assert rd.status_code == 200

    def test_collab_with_plans_perm_cannot_access_verses(self, api):
        """Regression: 'plans' perm must NOT grant access to /api/admin/verses (Versetto del Giorno)."""
        _, tok, _ = _make_collab(perms=["plans"])  # only plans
        r = api.get(f"{BASE_URL}/admin/verses", headers=_h(tok))
        assert r.status_code == 403, f"expected 403 on verses with only 'plans' perm, got {r.status_code}"

    def test_collab_with_verses_perm_can_access_verses(self, api):
        """/api/admin/verses still uses 'verses' perm — regression."""
        _, tok, _ = _make_collab(perms=["verses"])  # only verses
        r = api.get(f"{BASE_URL}/admin/verses", headers=_h(tok))
        assert r.status_code == 200, r.text

    def test_collab_with_verses_perm_cannot_access_plans(self, api):
        """The 'verses' perm alone must NOT grant plans admin access."""
        _, tok, _ = _make_collab(perms=["verses"])  # only verses
        r = api.get(f"{BASE_URL}/admin/reading-plans", headers=_h(tok))
        assert r.status_code == 403, r.text

    def test_admin_full_access(self, api, admin_token):
        r = api.get(f"{BASE_URL}/admin/reading-plans", headers=_h(admin_token))
        assert r.status_code == 200


# ---------- Cover field ----------
class TestCoverField:
    def test_create_update_cover_persists(self, api, admin_token):
        payload = {
            "title": f"TEST_cover_{uuid.uuid4().hex[:6]}",
            "cover": COVER_DATA_URL,
            "days": [{"day": 1, "title": "d1", "readings": [{"book_nr": 43, "chapter": 3, "label": "Giovanni 3"}]}],
            "status": "published",
            "order": 500,
        }
        r = api.post(f"{BASE_URL}/admin/reading-plans", json=payload, headers=_h(admin_token))
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        try:
            # Admin GET returns cover
            rg = api.get(f"{BASE_URL}/admin/reading-plans/{pid}", headers=_h(admin_token))
            assert rg.status_code == 200
            body = rg.json()
            assert body.get("cover") == COVER_DATA_URL, "cover must persist as base64 data URL"

            # Public list includes cover
            rl = api.get(f"{BASE_URL}/reading-plans")
            assert rl.status_code == 200
            pubs = rl.json()
            found = next((x for x in pubs if x["id"] == pid), None)
            assert found is not None, "published plan should appear in public list"
            assert found.get("cover") == COVER_DATA_URL, "public list must include cover"

            # Update cover to a different value
            new_cover = COVER_DATA_URL.replace("BAAAAAYAA", "CAAAAAYAA")
            ru = api.put(f"{BASE_URL}/admin/reading-plans/{pid}",
                         json={**payload, "cover": new_cover},
                         headers=_h(admin_token))
            assert ru.status_code == 200

            rg2 = api.get(f"{BASE_URL}/admin/reading-plans/{pid}", headers=_h(admin_token))
            assert rg2.json().get("cover") == new_cover
        finally:
            api.delete(f"{BASE_URL}/admin/reading-plans/{pid}", headers=_h(admin_token))


# ---------- Public regression ----------
class TestPublicRegression:
    def test_public_list_and_detail(self, api):
        r = api.get(f"{BASE_URL}/reading-plans")
        assert r.status_code == 200
        plans = r.json()
        assert isinstance(plans, list) and len(plans) >= 2
        # ensure trimmed
        for p in plans:
            assert "days" not in p
            # cover key must be present (may be None)
            assert "cover" in p

        # seeded 'plan_test_range' should be in list
        pt = next((p for p in plans if p["id"] == "plan_test_range"), None)
        assert pt is not None, "seeded plan_test_range must be published in public list"

        # detail
        r2 = api.get(f"{BASE_URL}/reading-plans/plan_test_range")
        assert r2.status_code == 200
        d = r2.json()
        assert d["duration_days"] == 1
        assert isinstance(d["days"], list) and len(d["days"]) == 1
        reading0 = d["days"][0]["readings"][0]
        assert reading0["book_nr"] == 43 and reading0["chapter"] == 18
        assert reading0["verse_start"] == 28 and reading0["verse_end"] == 40

    def test_enroll_day_unenroll_flow(self, api, listener):
        _, tok = listener
        plans = api.get(f"{BASE_URL}/reading-plans").json()
        p = next(x for x in plans if x["duration_days"] == 7)
        pid = p["id"]

        r = api.post(f"{BASE_URL}/me/reading-plans/{pid}/enroll", headers=_h(tok))
        assert r.status_code == 200

        r2 = api.get(f"{BASE_URL}/me/reading-plans", headers=_h(tok))
        assert r2.status_code == 200
        assert any(m["id"] == pid for m in r2.json())

        r3 = api.post(f"{BASE_URL}/me/reading-plans/{pid}/day/1", json={"done": True}, headers=_h(tok))
        assert r3.status_code == 200
        assert r3.json()["progress"]["completed_count"] == 1

        r4 = api.delete(f"{BASE_URL}/me/reading-plans/{pid}", headers=_h(tok))
        assert r4.status_code == 200
