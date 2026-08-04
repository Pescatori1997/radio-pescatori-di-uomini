"""Backend tests for 'Traguardi del Cammino' (iteration 41).

Covers:
- GET /api/me/achievements: auth gate (401) + demo user shape/earned_count
- Idempotency of earned_at across repeated calls
- Admin CRUD + reorder + assign/unassign
- Walk board GET/PATCH persistence
- Permission enforcement (non-admin => 403)
"""
import os
import uuid
import time

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
    or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
)
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PASS = "AdminTestPwd1!"
DEMO_EMAIL = "bacheca_demo@test.it"
DEMO_PASS = "Test1234!"


# ---------------- helpers/fixtures ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="module")
def demo_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=30)
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    s.headers["Authorization"] = f"Bearer {tok}"
    s.user_id = r.json()["user"]["user_id"]
    return s


@pytest.fixture(scope="module")
def listener_session():
    """Fresh non-admin/non-collaborator (listener) user."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"listener_ach_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "TestPwd1!", "name": "Listener"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    tok = r.json().get("token") or r.json().get("session_token")
    s.headers["Authorization"] = f"Bearer {tok}"
    return s


# ---------------- /me/achievements ----------------
class TestMeAchievements:
    def test_requires_auth_401(self):
        r = requests.get(f"{API}/me/achievements", timeout=15)
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"

    def test_demo_user_shape_and_counts(self, demo_session):
        r = demo_session.get(f"{API}/me/achievements", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "settings" in data and "achievements" in data
        assert "earned_count" in data
        settings = data["settings"]
        for k in ("enabled", "title", "wood"):
            assert k in settings, f"settings missing {k}"
        achs = data["achievements"]
        assert len(achs) >= 12, f"expected >=12 achievements, got {len(achs)}"
        # each must have required fields
        for a in achs:
            for k in ("earned", "count", "progress", "threshold", "back_label"):
                assert k in a, f"achievement {a.get('seed_key')} missing '{k}'"
        # earned_count == 6 for demo
        assert data["earned_count"] == 6, f"expected earned_count=6, got {data['earned_count']}"

    def test_demo_plans_thresholds(self, demo_session):
        r = demo_session.get(f"{API}/me/achievements", timeout=20)
        data = r.json()
        by_key = {a.get("seed_key"): a for a in data["achievements"]}
        pb = by_key.get("plans_bronze")
        ps = by_key.get("plans_silver")
        pg = by_key.get("plans_gold")
        assert pb and ps and pg, "plans seed keys missing"
        assert pb["count"] == 3
        assert pb["earned"] is True, "plans_bronze should be earned (3>=1)"
        assert ps["earned"] is True, "plans_silver should be earned (3>=3)"
        assert pg["earned"] is False, "plans_gold should NOT be earned (3<7)"

    def test_earned_at_is_idempotent(self, demo_session):
        r1 = demo_session.get(f"{API}/me/achievements", timeout=20).json()
        # small delay to guarantee wall-clock advance if a new insert happened
        time.sleep(1.2)
        r2 = demo_session.get(f"{API}/me/achievements", timeout=20).json()
        m1 = {a["id"]: a.get("earned_at") for a in r1["achievements"] if a["earned"]}
        m2 = {a["id"]: a.get("earned_at") for a in r2["achievements"] if a["earned"]}
        assert set(m1.keys()) == set(m2.keys()), "earned set changed between calls"
        for aid, t1 in m1.items():
            assert t1 is not None
            assert m2[aid] == t1, f"earned_at changed for {aid}: {t1} -> {m2[aid]}"


# ---------------- admin CRUD ----------------
class TestAdminAchievements:
    def test_admin_list_min_12(self, admin_session):
        r = admin_session.get(f"{API}/admin/achievements", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) >= 12

    def test_admin_create_patch_delete(self, admin_session):
        payload = {
            "category": "TEST", "tier": "bronze",
            "title": f"TEST_ach_{uuid.uuid4().hex[:6]}",
            "description": "TEST desc", "metric": "manual",
            "threshold": 1, "back_label": "TEST",
            "emoji": "🎯", "active": True,
        }
        r = admin_session.post(f"{API}/admin/achievements", json=payload, timeout=15)
        assert r.status_code == 201, r.text
        aid = r.json().get("id")
        assert aid, r.json()

        # verify GET reflects it
        g = admin_session.get(f"{API}/admin/achievements/{aid}", timeout=15)
        assert g.status_code == 200 and g.json()["title"] == payload["title"]

        # PATCH
        p = admin_session.patch(f"{API}/admin/achievements/{aid}",
                                json={"description": "TEST desc 2"}, timeout=15)
        assert p.status_code == 200, p.text
        g2 = admin_session.get(f"{API}/admin/achievements/{aid}", timeout=15).json()
        assert g2["description"] == "TEST desc 2"

        # DELETE
        d = admin_session.delete(f"{API}/admin/achievements/{aid}", timeout=15)
        assert d.status_code == 200
        g3 = admin_session.get(f"{API}/admin/achievements/{aid}", timeout=15)
        assert g3.status_code == 404

    def test_admin_reorder(self, admin_session):
        lst = admin_session.get(f"{API}/admin/achievements", timeout=15).json()
        ids = [a["id"] for a in lst[:5]]
        # reverse order
        rev = list(reversed(ids))
        r = admin_session.post(f"{API}/admin/achievements/order",
                               json={"ids": rev}, timeout=15)
        assert r.status_code == 200, r.text
        lst2 = admin_session.get(f"{API}/admin/achievements", timeout=15).json()
        # first 5 should now match the reversed order
        by_id = {a["id"]: a["order"] for a in lst2}
        for i, aid in enumerate(rev):
            assert by_id[aid] == i, f"order not applied for {aid}: expected {i}, got {by_id[aid]}"
        # restore
        admin_session.post(f"{API}/admin/achievements/order",
                          json={"ids": ids}, timeout=15)

    def test_manual_assign_and_unassign(self, admin_session, demo_session):
        # find one existing achievement (create ephemeral manual one to be safe)
        payload = {
            "category": "TEST_MANUAL", "tier": "gold",
            "title": f"TEST_manual_{uuid.uuid4().hex[:6]}",
            "description": "manual", "metric": "manual", "threshold": 1,
            "back_label": "manual",
        }
        cr = admin_session.post(f"{API}/admin/achievements", json=payload, timeout=15)
        aid = cr.json()["id"]
        try:
            # assign to demo
            r = admin_session.post(f"{API}/admin/achievements/{aid}/assign",
                                   json={"email": DEMO_EMAIL}, timeout=15)
            assert r.status_code == 200, r.text
            # demo should see earned=True (auto=false) for this id
            data = demo_session.get(f"{API}/me/achievements", timeout=15).json()
            found = next((a for a in data["achievements"] if a["id"] == aid), None)
            assert found and found["earned"] is True, f"manual assign not visible: {found}"

            # unassign
            r2 = admin_session.post(f"{API}/admin/achievements/{aid}/unassign",
                                    json={"email": DEMO_EMAIL}, timeout=15)
            assert r2.status_code == 200
            data2 = demo_session.get(f"{API}/me/achievements", timeout=15).json()
            found2 = next((a for a in data2["achievements"] if a["id"] == aid), None)
            assert found2 and found2["earned"] is False, f"unassign not applied: {found2}"
        finally:
            admin_session.delete(f"{API}/admin/achievements/{aid}", timeout=15)


# ---------------- walk-board ----------------
class TestWalkBoard:
    def test_get_and_patch_wood(self, admin_session):
        # capture original
        orig = admin_session.get(f"{API}/admin/walk-board", timeout=15)
        assert orig.status_code == 200, orig.text
        original_wood = orig.json().get("wood", "walnut")
        try:
            r = admin_session.patch(f"{API}/admin/walk-board",
                                    json={"wood": "oak"}, timeout=15)
            assert r.status_code == 200, r.text
            g = admin_session.get(f"{API}/admin/walk-board", timeout=15).json()
            assert g["wood"] == "oak", f"wood not persisted: {g}"
        finally:
            admin_session.patch(f"{API}/admin/walk-board",
                               json={"wood": original_wood}, timeout=15)


# ---------------- permissions ----------------
class TestPermissions:
    def test_listener_403_on_admin_endpoints(self, listener_session):
        endpoints = [
            ("GET", f"{API}/admin/achievements"),
            ("POST", f"{API}/admin/achievements"),
            ("POST", f"{API}/admin/achievements/order"),
            ("GET", f"{API}/admin/walk-board"),
            ("PATCH", f"{API}/admin/walk-board"),
        ]
        for method, url in endpoints:
            r = listener_session.request(method, url, json={}, timeout=15)
            assert r.status_code == 403, f"{method} {url} expected 403, got {r.status_code}"
