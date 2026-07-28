"""
Tests for the newly wired 'Promuovi ad Amministratore' feature.
Verifies PUT /api/admin/users/{uid}/role accepts role='administrator' and:
  - grants all PERM_SECTIONS to the promoted user (via GET /api/admin/users)
  - is blocked for allowlist admin emails (400)
  - properly demotes back to collaborator/listener
Also runs a light regression on suspend/reactivate/delete/permissions endpoints.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update(ADMIN_HEADERS)
    return s


@pytest.fixture(scope="module")
def test_user(admin_client):
    """Create a fresh listener user via /api/auth/register, yield, then delete."""
    email = f"TEST_roleassign_{uuid.uuid4().hex[:8]}@example.com"
    password = "Reset1234!"
    reg = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": password, "name": "TEST RoleAssign"
    })
    assert reg.status_code == 200, f"register failed: {reg.status_code} {reg.text}"
    users = admin_client.get(f"{BASE_URL}/api/admin/users").json()
    u = next((x for x in users if (x.get("email") or "").lower() == email.lower()), None)
    assert u, "Created user not found in admin listing"
    yield u
    try:
        admin_client.delete(f"{BASE_URL}/api/admin/users/{u['user_id']}")
    except Exception:
        pass


class TestPromoteToAdministrator:
    def test_listener_default_role(self, test_user):
        assert test_user.get("role") in ("listener", None), f"unexpected initial role: {test_user.get('role')}"
        assert test_user.get("is_admin") is False

    def test_promote_listener_to_administrator(self, admin_client, test_user):
        r = admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/role",
            json={"role": "administrator", "permissions": []},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data["role"] == "administrator"
        # backend must grant every PERM_SECTION
        assert isinstance(data.get("permissions"), list)
        assert len(data["permissions"]) >= 8, f"expected all perms granted, got {data['permissions']}"

    def test_role_persisted_and_listed(self, admin_client, test_user):
        users = admin_client.get(f"{BASE_URL}/api/admin/users").json()
        u = next(x for x in users if x["user_id"] == test_user["user_id"])
        assert u["role"] == "administrator"
        # is_admin flag stays False because email not in ADMIN_EMAILS allowlist
        assert u["is_admin"] is False
        assert len(u.get("permissions") or []) >= 8

    def test_demote_admin_to_collaborator(self, admin_client, test_user):
        r = admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/role",
            json={"role": "collaborator", "permissions": ["podcasts", "news"]},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "collaborator"
        assert set(d["permissions"]) == {"podcasts", "news"}

    def test_demote_admin_to_listener(self, admin_client, test_user):
        # first re-promote
        admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/role",
            json={"role": "administrator", "permissions": []},
        )
        r = admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/role",
            json={"role": "listener", "permissions": []},
        )
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "listener"


class TestAllowlistProtection:
    def test_cannot_change_allowlist_admin_role(self, admin_client):
        users = admin_client.get(f"{BASE_URL}/api/admin/users").json()
        allow = next((u for u in users if (u.get("email") or "").lower() == "pescatoridiuomini@outlook.it"), None)
        assert allow, "allowlist admin not present in users list"
        r = admin_client.put(
            f"{BASE_URL}/api/admin/users/{allow['user_id']}/role",
            json={"role": "listener", "permissions": []},
        )
        assert r.status_code == 400
        assert "amministrator" in r.text.lower() or "allowlist" in r.text.lower()


class TestInvalidRole:
    def test_invalid_role_rejected(self, admin_client, test_user):
        r = admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/role",
            json={"role": "superuser", "permissions": []},
        )
        assert r.status_code == 400

    def test_missing_role_rejected(self, admin_client, test_user):
        r = admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/role",
            json={"permissions": []},
        )
        assert r.status_code == 422


class TestRegressionUserActions:
    """Light regression: ensure suspend/reactivate/permissions still work."""

    def test_suspend_and_reactivate(self, admin_client, test_user):
        r = admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/status",
            json={"status": "suspended"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "suspended"
        r2 = admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/status",
            json={"status": "active"},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "active"

    def test_manage_permissions_still_works(self, admin_client, test_user):
        r = admin_client.put(
            f"{BASE_URL}/api/admin/users/{test_user['user_id']}/role",
            json={"role": "collaborator", "permissions": ["podcasts", "prayers", "merch"]},
        )
        assert r.status_code == 200
        assert set(r.json()["permissions"]) == {"podcasts", "prayers", "merch"}


class TestUnauthorized:
    def test_no_token_rejected(self):
        r = requests.put(
            f"{BASE_URL}/api/admin/users/whatever/role",
            json={"role": "administrator"},
        )
        assert r.status_code in (401, 403)
