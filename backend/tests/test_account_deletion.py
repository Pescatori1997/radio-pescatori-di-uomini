"""Tests for store-readiness features: DELETE /api/auth/account (Apple/Play requirement)."""
import os
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"


def _random_email() -> str:
    return f"deltest+{uuid.uuid4().hex[:8]}_{int(time.time())}@example.com"


@pytest.fixture(scope="module")
def disposable_user():
    """Registers a disposable user and returns (email, password, token)."""
    email = _random_email()
    pwd = "Test1234!"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": pwd, "name": "Delete Me"},
                      timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:200]}"
    tok = r.json()["token"]
    return email, pwd, tok


class TestAccountDeletion:
    def test_1_delete_requires_auth(self):
        r = requests.delete(f"{API}/auth/account", timeout=15)
        assert r.status_code == 401, f"expected 401 without token, got {r.status_code}"

    def test_2_delete_rejects_bad_token(self):
        r = requests.delete(f"{API}/auth/account",
                            headers={"Authorization": "Bearer bad_token_xyz"}, timeout=15)
        assert r.status_code == 401

    def test_3_me_works_before_delete(self, disposable_user):
        email, _pwd, tok = disposable_user
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == email

    def test_4_delete_account_success(self, disposable_user):
        _email, _pwd, tok = disposable_user
        r = requests.delete(f"{API}/auth/account",
                            headers={"Authorization": f"Bearer {tok}"}, timeout=20)
        assert r.status_code == 200, f"delete failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True

    def test_5_old_token_invalidated(self, disposable_user):
        _email, _pwd, tok = disposable_user
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 401, f"old token should be invalid after deletion, got {r.status_code}"

    def test_6_login_fails_after_delete(self, disposable_user):
        email, pwd, _tok = disposable_user
        r = requests.post(f"{API}/auth/login",
                          json={"email": email, "password": pwd}, timeout=15)
        assert r.status_code in (400, 401), f"login should fail after deletion, got {r.status_code}"

    def test_7_delete_no_500(self):
        """Full journey again: no 500 should ever be produced by the endpoint."""
        email = _random_email()
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Test1234!", "name": "X"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["token"]
        r2 = requests.delete(f"{API}/auth/account",
                             headers={"Authorization": f"Bearer {tok}"}, timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("ok") is True

    def test_8_email_can_be_reregistered(self):
        """After deletion the same email should be usable again (no residual user)."""
        email = _random_email()
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Test1234!", "name": "R1"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["token"]
        rd = requests.delete(f"{API}/auth/account",
                             headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert rd.status_code == 200
        # Re-register with same email → must succeed (user was truly deleted)
        r2 = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": "Test1234!", "name": "R2"}, timeout=15)
        assert r2.status_code == 200, f"re-register after deletion failed: {r2.status_code} {r2.text[:300]}"
        # cleanup
        requests.delete(f"{API}/auth/account",
                        headers={"Authorization": f"Bearer {r2.json()['token']}"}, timeout=15)
