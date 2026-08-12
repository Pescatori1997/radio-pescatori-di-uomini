"""Backend tests for the password-reset security fix (iteration 43).

Covers:
  1. /auth/forgot-password with unregistered email -> 404 with Italian detail.
  2. /auth/forgot-password with registered email  -> 200 and MUST NOT expose 'code'.
     (If EMERGENT_EMAIL_KEY is missing this endpoint returns 502 by design.)
  3. Full reset flow (register -> forgot -> read code from Mongo -> reset -> login).
"""
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

# Force all tests in this module to a single xdist worker to prevent
# TestFullResetFlow from racing with TestForgotPasswordRegistered on the
# shared password_resets record for REG_EMAIL.
pytestmark = pytest.mark.xdist_group(name="password_reset_security")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

REG_EMAIL = "test@pescatoridiuomini.it"
REG_PASSWORD = "Test1234!"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module", autouse=True)
def ensure_registered_user(api, mongo):
    """Make sure the reference email/password account exists."""
    r = api.post(f"{BASE_URL}/api/auth/register",
                 json={"email": REG_EMAIL, "password": REG_PASSWORD, "name": "Test User"})
    # 200 create OR 400 already-registered are both fine
    assert r.status_code in (200, 400), f"unexpected register status {r.status_code}: {r.text}"
    # Guarantee password matches (in case an earlier test reset it) via a mongo probe + login retry.
    login = api.post(f"{BASE_URL}/api/auth/login", json={"email": REG_EMAIL, "password": REG_PASSWORD})
    if login.status_code != 200:
        # Force-restore known password directly (dev pod convenience).
        # We call the backend's internal reset by seeding a code + hitting /reset-password.
        code = f"{secrets.randbelow(1000000):06d}"
        mongo.password_resets.update_one(
            {"email": REG_EMAIL},
            {"$set": {"email": REG_EMAIL, "code": code,
                      "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30),
                      "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        r2 = api.post(f"{BASE_URL}/api/auth/reset-password",
                      json={"email": REG_EMAIL, "code": code, "new_password": REG_PASSWORD})
        assert r2.status_code == 200, f"could not restore password: {r2.status_code} {r2.text}"
    yield


# ----- 1. UNREGISTERED email must return 404 with the exact Italian message -----
class TestForgotPasswordUnregistered:
    def test_returns_404(self, api):
        email = f"nobody-random-{secrets.token_hex(4)}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email})
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("detail") == "Nessun account trovato con questa email.", data


# ----- 2. REGISTERED email must NOT leak the code in the response -----
class TestForgotPasswordRegistered:
    def test_no_code_in_response(self, api, mongo):
        r = api.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": REG_EMAIL})
        # The security requirement is: whatever the response body is, it must not contain 'code'.
        body_text = r.text
        assert "\"code\"" not in body_text, f"SECURITY: response leaks 'code' -> {body_text[:300]}"

        if r.status_code == 200:
            data = r.json()
            assert "code" not in data, f"SECURITY: response leaks 'code' -> {data}"
            assert data.get("ok") is True
            # And the code MUST have been persisted server-side in the DB.
            rec = mongo.password_resets.find_one({"email": REG_EMAIL})
            assert rec and rec.get("code") and len(rec["code"]) == 6
        elif r.status_code == 502:
            # Email delivery failed -> by design the pending reset is deleted and no code exists.
            pytest.skip("email delivery unavailable in this pod (EMERGENT_EMAIL_KEY missing) - "
                        "endpoint correctly returns 502 without leaking a code")
        else:
            pytest.fail(f"unexpected status {r.status_code}: {r.text[:300]}")


# ----- 3. Full reset + login flow (uses Mongo to obtain the code if email is unavailable) -----
class TestFullResetFlow:
    def test_reset_and_login(self, api, mongo):
        # Ask for a code (may 200 or 502 depending on EMERGENT_EMAIL_KEY availability).
        r = api.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": REG_EMAIL})
        assert r.status_code in (200, 502), f"unexpected status {r.status_code}: {r.text[:200]}"

        # In either case, we bypass the email channel by reading (or seeding) the code from Mongo.
        rec = mongo.password_resets.find_one({"email": REG_EMAIL})
        if not rec:
            # Seed a fresh code so we can still verify the /reset-password + /login path.
            code = f"{secrets.randbelow(1000000):06d}"
            mongo.password_resets.update_one(
                {"email": REG_EMAIL},
                {"$set": {"email": REG_EMAIL, "code": code,
                          "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30),
                          "created_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
        else:
            code = rec["code"]

        new_pw = f"NewPwd{secrets.token_hex(3)}!"
        r2 = api.post(f"{BASE_URL}/api/auth/reset-password",
                      json={"email": REG_EMAIL, "code": code, "new_password": new_pw})
        assert r2.status_code == 200, f"reset-password failed: {r2.status_code} {r2.text[:200]}"
        assert r2.json().get("ok") is True

        # New password logs in.
        login_new = api.post(f"{BASE_URL}/api/auth/login",
                             json={"email": REG_EMAIL, "password": new_pw})
        assert login_new.status_code == 200, f"login with new pw failed: {login_new.status_code} {login_new.text[:200]}"
        assert "token" in login_new.json()

        # Old password should NOT work anymore.
        login_old = api.post(f"{BASE_URL}/api/auth/login",
                             json={"email": REG_EMAIL, "password": REG_PASSWORD})
        assert login_old.status_code in (400, 401), f"old pw still works: {login_old.status_code}"

        # Restore the well-known password for downstream tests.
        code2 = f"{secrets.randbelow(1000000):06d}"
        mongo.password_resets.update_one(
            {"email": REG_EMAIL},
            {"$set": {"email": REG_EMAIL, "code": code2,
                      "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30),
                      "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        rr = api.post(f"{BASE_URL}/api/auth/reset-password",
                      json={"email": REG_EMAIL, "code": code2, "new_password": REG_PASSWORD})
        assert rr.status_code == 200, f"could not restore original password: {rr.text[:200]}"
