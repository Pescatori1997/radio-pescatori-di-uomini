"""RBAC (role/permissions) tests for Pescatori di Uomini backend.

NOTE: pytest is configured with --dist loadscope (per-class scoping).
So all tests that depend on module-scoped state MUST be in ONE class to
run on the same worker in order.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_TOKEN = "ADMINTESTTOKEN123"


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ------------- Class 1: register/login/me + admin/me + role promotion + collab access
class TestRbacFlow:
    """Full sequential RBAC flow (one worker via loadscope)."""

    listener = {}
    collab = {}

    def test_01_register_listener(self):
        email = f"TEST_listener_{uuid.uuid4().hex[:8]}@example.com".lower()
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Test1234!", "name": "TEST Listener"},
                          timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["role"] == "listener"
        assert data["user"]["permissions"] == []
        TestRbacFlow.listener = {"email": email, "token": data["token"], "user": data["user"]}

    def test_02_me_returns_role_permissions(self):
        r = requests.get(f"{API}/auth/me", headers=_hdr(TestRbacFlow.listener["token"]), timeout=30)
        assert r.status_code == 200, r.text
        me = r.json()
        assert me.get("role") == "listener"
        assert me.get("permissions") == []
        assert (me.get("email") or "").lower() == TestRbacFlow.listener["email"]

    def test_03_login_returns_role_permissions(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": TestRbacFlow.listener["email"], "password": "Test1234!"},
                          timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["role"] == "listener"
        assert data["user"]["permissions"] == []

    def test_04_admin_me_403_for_listener(self):
        r = requests.get(f"{API}/admin/me", headers=_hdr(TestRbacFlow.listener["token"]), timeout=30)
        assert r.status_code == 403

    def test_05_admin_me_200_for_admin(self):
        r = requests.get(f"{API}/admin/me", headers=_hdr(ADMIN_TOKEN), timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("is_admin") is True
        assert j.get("role") == "administrator"
        assert isinstance(j.get("permissions"), list) and len(j["permissions"]) > 0

    def test_06_register_second_user_for_collab(self):
        email = f"TEST_collab_{uuid.uuid4().hex[:8]}@example.com".lower()
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Test1234!", "name": "TEST Collab"},
                          timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["role"] == "listener"
        TestRbacFlow.collab = {"email": email, "token": data["token"], "user": data["user"]}

    def test_07_non_admin_cannot_set_role(self):
        uid = TestRbacFlow.collab["user"]["user_id"]
        r = requests.put(f"{API}/admin/users/{uid}/role",
                         headers=_hdr(TestRbacFlow.listener["token"]),
                         json={"role": "collaborator", "permissions": ["podcasts"]},
                         timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_08_admin_promotes_to_collaborator(self):
        uid = TestRbacFlow.collab["user"]["user_id"]
        r = requests.put(f"{API}/admin/users/{uid}/role",
                         headers=_hdr(ADMIN_TOKEN),
                         json={"role": "collaborator", "permissions": ["podcasts", "news"]},
                         timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["role"] == "collaborator"
        assert set(j["permissions"]) == {"podcasts", "news"}

    def test_09_admin_users_reflects_role_permissions(self):
        r = requests.get(f"{API}/admin/users", headers=_hdr(ADMIN_TOKEN), timeout=30)
        assert r.status_code == 200, r.text
        users = r.json()
        uid = TestRbacFlow.collab["user"]["user_id"]
        match = [u for u in users if u.get("user_id") == uid]
        assert match, "collab user not present in /admin/users"
        u = match[0]
        assert u.get("role") == "collaborator"
        assert set(u.get("permissions") or []) == {"podcasts", "news"}

    def test_10_admin_me_for_collaborator(self):
        r = requests.get(f"{API}/admin/me", headers=_hdr(TestRbacFlow.collab["token"]), timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("is_admin") is False
        assert j.get("role") == "collaborator"
        assert set(j.get("permissions") or []) == {"podcasts", "news"}

    def test_11_collab_can_get_podcasts(self):
        r = requests.get(f"{API}/admin/podcasts",
                         headers=_hdr(TestRbacFlow.collab["token"]), timeout=30)
        assert r.status_code == 200, r.text

    def test_12_collab_can_post_podcast(self):
        payload = {
            "title": f"TEST_podcast_{uuid.uuid4().hex[:6]}",
            "description": "test",
            "audio_url": "https://example.com/a.mp3",
        }
        r = requests.post(f"{API}/admin/podcasts",
                          headers=_hdr(TestRbacFlow.collab["token"]),
                          json=payload, timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        try:
            data = r.json()
            pid = data.get("id") or data.get("podcast_id") or (data.get("podcast") or {}).get("id")
            if pid:
                requests.delete(f"{API}/admin/podcasts/{pid}",
                                headers=_hdr(ADMIN_TOKEN), timeout=30)
        except Exception:
            pass

    def test_13_collab_denied_admin_users(self):
        r = requests.get(f"{API}/admin/users",
                         headers=_hdr(TestRbacFlow.collab["token"]), timeout=30)
        assert r.status_code == 403

    def test_14_collab_denied_admin_settings(self):
        r = requests.get(f"{API}/admin/settings",
                         headers=_hdr(TestRbacFlow.collab["token"]), timeout=30)
        assert r.status_code == 403

    def test_15_cleanup_test_users(self):
        for u in (TestRbacFlow.listener, TestRbacFlow.collab):
            if not u:
                continue
            uid = u.get("user", {}).get("user_id")
            if uid:
                requests.delete(f"{API}/admin/users/{uid}",
                                headers=_hdr(ADMIN_TOKEN), timeout=30)


# ------------- Class 2: Admin-only endpoints still work
class TestAdminEndpoints:
    def test_admin_stats(self):
        r = requests.get(f"{API}/admin/stats", headers=_hdr(ADMIN_TOKEN), timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        # sanity checks on fields
        for k in ("total_users", "podcasts", "news"):
            assert k in j

    def test_admin_applications(self):
        r = requests.get(f"{API}/admin/applications", headers=_hdr(ADMIN_TOKEN), timeout=30)
        assert r.status_code == 200, r.text

    def test_admin_users(self):
        r = requests.get(f"{API}/admin/users", headers=_hdr(ADMIN_TOKEN), timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_admin_settings(self):
        r = requests.get(f"{API}/admin/settings", headers=_hdr(ADMIN_TOKEN), timeout=30)
        assert r.status_code == 200, r.text


# ------------- Class 3: Public endpoints regression
class TestPublicRegression:
    @pytest.mark.parametrize("path", ["/live/status", "/podcasts", "/news", "/products"])
    def test_public_endpoint_ok(self, path):
        r = requests.get(f"{API}{path}", timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
