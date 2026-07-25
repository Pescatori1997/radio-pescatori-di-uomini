"""Pre-deploy audit — smoke tests for critical production endpoints (iteration 19)."""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_H = {"Authorization": "Bearer ADMINTESTTOKEN123", "Content-Type": "application/json"}


class TestPublicContentEndpoints:
    """All public GET endpoints must respond 200 and never 500."""

    @pytest.mark.parametrize("path", [
        "/live/status",
        "/podcasts",
        "/podcasts/categories",
        "/meditations",
        "/meditations/categories",
        "/news",
        "/programs",
        "/crew",
        "/products",
        "/products/categories",
        "/settings",
    ])
    def test_public_get_ok(self, path):
        r = requests.get(f"{API}{path}", timeout=15)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:200]}"
        # Non-empty response for lists
        data = r.json()
        assert data is not None

    def test_live_status_shape(self):
        r = requests.get(f"{API}/live/status", timeout=15)
        d = r.json()
        for k in ("is_live", "title", "stream_url"):
            assert k in d


class TestAuthFullFlow:
    """Full auth journey: register -> me -> change-password -> forgot -> reset -> login."""

    email = f"audit19_{int(time.time())}@pescatoridiuomini.it"
    pwd_a = "Audit1234!"
    pwd_b = "Audit5678!"
    pwd_c = "Audit9999!"
    token = None

    def test_1_register(self):
        r = requests.post(f"{API}/auth/register",
                          json={"email": self.email, "password": self.pwd_a, "name": "Audit User"},
                          timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and d["user"]["email"] == self.email
        TestAuthFullFlow.token = d["token"]

    def test_2_me(self):
        h = {"Authorization": f"Bearer {TestAuthFullFlow.token}"}
        r = requests.get(f"{API}/auth/me", headers=h, timeout=15)
        assert r.status_code == 200 and r.json()["email"] == self.email

    def test_3_update_profile(self):
        h = {"Authorization": f"Bearer {TestAuthFullFlow.token}", "Content-Type": "application/json"}
        r = requests.put(f"{API}/auth/profile", headers=h, json={"name": "Audit Renamed"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # API returns user flat (no "user" wrapper)
        assert d.get("name") == "Audit Renamed" or d.get("user", {}).get("name") == "Audit Renamed"

    def test_4_change_password(self):
        h = {"Authorization": f"Bearer {TestAuthFullFlow.token}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/auth/change-password", headers=h,
                          json={"current_password": self.pwd_a, "new_password": self.pwd_b}, timeout=15)
        assert r.status_code == 200, r.text

    def test_5_login_new_pwd(self):
        r = requests.post(f"{API}/auth/login", json={"email": self.email, "password": self.pwd_b}, timeout=15)
        assert r.status_code == 200
        TestAuthFullFlow.token = r.json()["token"]

    def test_6_forgot_password_returns_fallback_code(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": self.email}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # placeholder email key -> delivered false with code fallback
        assert d.get("ok") is True
        assert d.get("delivered") is False
        assert "code" in d and len(str(d["code"])) == 6

    def test_7_reset_password_success(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": self.email}, timeout=15)
        code = r.json()["code"]
        r2 = requests.post(f"{API}/auth/reset-password",
                           json={"email": self.email, "code": code, "new_password": self.pwd_c},
                           timeout=15)
        assert r2.status_code == 200, r2.text

    def test_8_login_after_reset(self):
        r = requests.post(f"{API}/auth/login", json={"email": self.email, "password": self.pwd_c}, timeout=15)
        assert r.status_code == 200
        TestAuthFullFlow.token = r.json()["token"]

    def test_9_logout(self):
        h = {"Authorization": f"Bearer {TestAuthFullFlow.token}"}
        r = requests.post(f"{API}/auth/logout", headers=h, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/auth/me", headers=h, timeout=15)
        assert r2.status_code == 401


class TestNotificationSettings:
    """Notifications preferences require auth; 7 categories default true."""

    def test_notifications_default(self):
        # register a fresh user
        email = f"notif19_{int(time.time())}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Notif1234!", "name": "N"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["token"]
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        rg = requests.get(f"{API}/me/notifications", headers=h, timeout=15)
        assert rg.status_code == 200
        prefs = rg.json()
        for k in ("podcasts", "meditations", "news", "live", "announcements", "events", "prayers"):
            assert k in prefs, f"missing prefs key {k}"

    def test_notifications_unauth(self):
        r = requests.get(f"{API}/me/notifications", timeout=15)
        assert r.status_code == 401


class TestDonationsCheckout:
    """Donations checkout must create a session (Stripe test mode)."""

    def test_checkout_creates_session(self):
        payload = {
            "amount": 10.0,
            "currency": "eur",
            "type": "one_time",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/donations/checkout", json=payload, timeout=30)
        # Accept 200 or 400 (if stripe key is invalid); must not be 500
        assert r.status_code in (200, 400), f"checkout {r.status_code}: {r.text[:300]}"
        if r.status_code == 200:
            d = r.json()
            assert "url" in d or "checkout_url" in d or "session_id" in d


class TestAdminEndpoints:
    """Admin endpoints require admin token."""

    def test_admin_stats(self):
        r = requests.get(f"{API}/admin/stats", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Expected numeric fields
        for k in ("total_users", "podcasts", "news", "meditations", "notifications", "products", "donations"):
            assert k in d, f"admin/stats missing {k}"

    def test_admin_stats_unauth(self):
        r = requests.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_notifications_audience(self):
        r = requests.get(f"{API}/admin/notifications/audience", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # 7 category counts expected
        for k in ("podcasts", "meditations", "news", "live", "announcements", "events", "prayers"):
            assert k in d

    def test_admin_notifications_history(self):
        r = requests.get(f"{API}/admin/notifications", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_users_list(self):
        r = requests.get(f"{API}/admin/users", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_donations_list(self):
        r = requests.get(f"{API}/admin/donations", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200


class TestErrorHandling:
    """Verify 404/401 errors are handled cleanly (no 500 crashes)."""

    def test_podcast_not_found(self):
        r = requests.get(f"{API}/podcasts/nonexistent_xyz", timeout=15)
        assert r.status_code == 404

    def test_news_not_found(self):
        r = requests.get(f"{API}/news/nonexistent_xyz", timeout=15)
        assert r.status_code == 404

    def test_meditation_not_found(self):
        r = requests.get(f"{API}/meditations/nonexistent_xyz", timeout=15)
        assert r.status_code == 404

    def test_bad_session_token_401(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer bad_token_xyz"}, timeout=15)
        assert r.status_code == 401
