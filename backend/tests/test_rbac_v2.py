"""
Iteration 9 tests: User & Roles Management System.
- /admin/users filters (role, status, sort=name|last_login|recent)
- /admin/users/{uid}/status suspend/reactivate + login blocked while suspended
- /admin/users/{uid}/role rejects administrator, accepts collaborator/listener
- /admin/invitations create/list/revoke + accept flow (single-use)
- /admin/activity audit log
- RBAC: 'team' perm collaborator can GET /admin/crew; but NOT /admin/users
- Public regression: /live/status, /podcasts, /news, /products still 200

Uses admin credentials from /app/memory/test_credentials.md:
    email:    pescatoridiuomini@outlook.it
    password: Admin1234!
Also uses seeded ADMINTESTTOKEN123 for existing conftest patterns.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PW = "Admin1234!"
ADMIN_TOKEN_SEED = "ADMINTESTTOKEN123"
ADMIN_H_SEED = {"Authorization": f"Bearer {ADMIN_TOKEN_SEED}"}


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    """Login as the real admin (register if missing). Returns bearer token."""
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    if r.status_code != 200:
        # try registering (in dev DB may not have it or password unknown)
        rr = api.post(f"{BASE_URL}/api/auth/register",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PW, "name": "Admin PDU"})
        if rr.status_code == 400:
            # password unknown; use seeded ADMIN token as fallback
            return ADMIN_TOKEN_SEED
        assert rr.status_code == 200, rr.text
        return rr.json()["token"]
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _mk_user(api, prefix="listener", password="Test1234!"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register",
                 json={"email": email, "password": password, "name": f"TEST {prefix}"})
    assert r.status_code == 200, r.text
    d = r.json()
    return email, d["token"], d["user"]["user_id"]


# ====================================================
# ADMIN USERS: filters, sort, fields
# ====================================================
class TestAdminUsersListing:
    def test_admin_users_returns_expected_fields(self, api, admin_h):
        r = api.get(f"{BASE_URL}/api/admin/users?search=pescatoridiuomini", headers=admin_h)
        assert r.status_code == 200
        rows = r.json()
        assert rows, "no admin row returned"
        u = next(x for x in rows if (x.get("email") or "").lower() == ADMIN_EMAIL)
        for k in ("role", "status", "permissions", "is_admin", "created_at"):
            assert k in u, f"missing field {k}"
        assert u["is_admin"] is True
        assert u["role"] == "administrator"

    def test_admin_users_filter_role(self, api, admin_h):
        r = api.get(f"{BASE_URL}/api/admin/users?role=administrator", headers=admin_h)
        assert r.status_code == 200
        for u in r.json():
            assert u["role"] == "administrator"

    def test_admin_users_filter_status_active(self, api, admin_h):
        r = api.get(f"{BASE_URL}/api/admin/users?status=active", headers=admin_h)
        assert r.status_code == 200
        for u in r.json():
            assert u["status"] != "suspended"

    def test_admin_users_sort_name(self, api, admin_h):
        r = api.get(f"{BASE_URL}/api/admin/users?sort=name", headers=admin_h)
        assert r.status_code == 200
        names = [(u.get("name") or "").lower() for u in r.json()]
        assert names == sorted(names)

    def test_admin_users_sort_last_login_accepts(self, api, admin_h):
        r = api.get(f"{BASE_URL}/api/admin/users?sort=last_login", headers=admin_h)
        assert r.status_code == 200


# ====================================================
# SUSPEND / REACTIVATE + login guard
# ====================================================
class TestSuspendReactivate:
    def test_suspend_blocks_login_then_reactivate_restores(self, api, admin_h):
        email, tok, uid = _mk_user(api, "susp")
        try:
            # non-admin gets 403 on suspend endpoint
            r = api.put(f"{BASE_URL}/api/admin/users/{uid}/status",
                        json={"status": "suspended"},
                        headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 403

            # admin suspends
            r = api.put(f"{BASE_URL}/api/admin/users/{uid}/status",
                        json={"status": "suspended"}, headers=admin_h)
            assert r.status_code == 200
            assert r.json()["status"] == "suspended"

            # suspended user login is 403
            r = api.post(f"{BASE_URL}/api/auth/login",
                         json={"email": email, "password": "Test1234!"})
            assert r.status_code == 403
            assert "sospeso" in r.text.lower()

            # sessions revoked -> old token should now yield 401/403
            r = api.get(f"{BASE_URL}/api/auth/me",
                        headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code in (401, 403)

            # reactivate
            r = api.put(f"{BASE_URL}/api/admin/users/{uid}/status",
                        json={"status": "active"}, headers=admin_h)
            assert r.status_code == 200

            # login works again
            r = api.post(f"{BASE_URL}/api/auth/login",
                         json={"email": email, "password": "Test1234!"})
            assert r.status_code == 200
        finally:
            api.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=admin_h)


# ====================================================
# ROLE UPDATE
# ====================================================
class TestRoleUpdate:
    def test_role_administrator_rejected(self, api, admin_h):
        email, tok, uid = _mk_user(api, "role")
        try:
            r = api.put(f"{BASE_URL}/api/admin/users/{uid}/role",
                        json={"role": "administrator"}, headers=admin_h)
            assert r.status_code == 400

            r = api.put(f"{BASE_URL}/api/admin/users/{uid}/role",
                        json={"role": "collaborator", "permissions": ["podcasts", "team", "banana"]},
                        headers=admin_h)
            assert r.status_code == 200
            assert r.json()["role"] == "collaborator"
            # banana filtered out
            assert set(r.json()["permissions"]) == {"podcasts", "team"}

            # activity log has entry
            r = api.get(f"{BASE_URL}/api/admin/activity?limit=20", headers=admin_h)
            assert r.status_code == 200
            assert any("Collaboratore" in (a.get("action") or "") for a in r.json())

            # demote to listener clears perms
            r = api.put(f"{BASE_URL}/api/admin/users/{uid}/role",
                        json={"role": "listener"}, headers=admin_h)
            assert r.status_code == 200
            assert r.json()["permissions"] == []
        finally:
            api.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=admin_h)


# ====================================================
# INVITATIONS
# ====================================================
class TestInvitations:
    def test_invitation_full_flow(self, api, admin_h):
        email = f"TEST_inv_{uuid.uuid4().hex[:8]}@example.com"
        # non-admin cannot invite
        _, tok, uid = _mk_user(api, "invguard")
        try:
            r = api.post(f"{BASE_URL}/api/admin/invitations",
                         json={"email": f"x_{email}", "role": "collaborator", "permissions": ["podcasts"]},
                         headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 403
        finally:
            api.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=admin_h)

        # admin creates invite
        r = api.post(f"{BASE_URL}/api/admin/invitations",
                     json={"email": email, "role": "collaborator",
                           "permissions": ["podcasts", "news", "banana"]},
                     headers=admin_h)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["email_sent"] is False, "EMERGENT_EMAIL_KEY not provisioned in dev -> False"
        accept_url = data["accept_url"]
        assert "/invite?token=" in accept_url
        token = accept_url.split("token=")[-1]
        inv_id = data["invitation"]["id"]
        assert set(data["invitation"]["permissions"]) == {"podcasts", "news"}  # banana filtered

        # list shows pending
        r = api.get(f"{BASE_URL}/api/admin/invitations", headers=admin_h)
        assert r.status_code == 200
        assert any(i["id"] == inv_id and i["status"] == "pending" for i in r.json())

        # public get invitation
        r = api.get(f"{BASE_URL}/api/invitations/{token}")
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == email.lower()
        assert body["role"] == "collaborator"
        assert set(body["permissions"]) == {"podcasts", "news"}

        # accept -> session + user with role/permissions
        r = api.post(f"{BASE_URL}/api/invitations/{token}/accept",
                     json={"name": "TEST Invitee", "password": "Test1234!"})
        assert r.status_code == 200, r.text
        acc = r.json()
        assert acc["user"]["role"] == "collaborator"
        assert set(acc["user"]["permissions"]) == {"podcasts", "news"}
        assert acc["token"]
        new_uid = acc["user"]["user_id"]

        try:
            # second accept -> 404
            r = api.post(f"{BASE_URL}/api/invitations/{token}/accept",
                         json={"name": "Dup", "password": "Test1234!"})
            assert r.status_code == 404
        finally:
            api.delete(f"{BASE_URL}/api/admin/users/{new_uid}", headers=admin_h)

    def test_invitation_revoke(self, api, admin_h):
        email = f"TEST_inv_{uuid.uuid4().hex[:8]}@example.com"
        r = api.post(f"{BASE_URL}/api/admin/invitations",
                     json={"email": email, "role": "listener"}, headers=admin_h)
        assert r.status_code == 201
        inv_id = r.json()["invitation"]["id"]
        token = r.json()["accept_url"].split("token=")[-1]

        r = api.delete(f"{BASE_URL}/api/admin/invitations/{inv_id}", headers=admin_h)
        assert r.status_code == 200

        # after delete, public GET returns 404
        r = api.get(f"{BASE_URL}/api/invitations/{token}")
        assert r.status_code == 404


# ====================================================
# ACTIVITY LOG
# ====================================================
class TestActivity:
    def test_activity_admin_only(self, api, admin_h):
        r = api.get(f"{BASE_URL}/api/admin/activity", headers=admin_h)
        assert r.status_code == 200
        for a in r.json():
            for k in ("actor_name", "action", "created_at"):
                assert k in a, f"missing {k}"

    def test_activity_non_admin_403(self, api, admin_h):
        _, tok, uid = _mk_user(api, "actguard")
        try:
            r = api.get(f"{BASE_URL}/api/admin/activity",
                        headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 403
        finally:
            api.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=admin_h)


# ====================================================
# RBAC: collaborator with 'team' perm can hit /admin/crew but NOT /admin/users
# ====================================================
class TestRBACTeam:
    def test_collab_team_can_crew_but_not_users(self, api, admin_h):
        _, tok, uid = _mk_user(api, "collabteam")
        try:
            # give collaborator + team perm
            r = api.put(f"{BASE_URL}/api/admin/users/{uid}/role",
                        json={"role": "collaborator", "permissions": ["team"]},
                        headers=admin_h)
            assert r.status_code == 200

            # collab -> /admin/crew 200
            r = api.get(f"{BASE_URL}/api/admin/crew",
                        headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 200

            # collab -> /admin/users 403
            r = api.get(f"{BASE_URL}/api/admin/users",
                        headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 403

            # collab -> /admin/activity 403
            r = api.get(f"{BASE_URL}/api/admin/activity",
                        headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 403
        finally:
            api.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=admin_h)


# ====================================================
# PUBLIC REGRESSION
# ====================================================
class TestPublicRegression:
    def test_live_status(self, api):
        assert api.get(f"{BASE_URL}/api/live/status").status_code == 200

    def test_podcasts(self, api):
        assert api.get(f"{BASE_URL}/api/podcasts").status_code == 200

    def test_news(self, api):
        assert api.get(f"{BASE_URL}/api/news").status_code == 200

    def test_products(self, api):
        assert api.get(f"{BASE_URL}/api/products").status_code == 200

    def test_auth_me_returns_role_permissions(self, api, admin_h):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=admin_h)
        assert r.status_code == 200
        d = r.json()
        assert "role" in d
        assert "permissions" in d
