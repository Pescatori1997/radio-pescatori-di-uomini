"""Tests for bottom-navigation admin customization (settings.nav_config).

Covers:
  - Admin email/password login (`/api/auth/login`) with the seeded admin.
  - GET /api/admin/settings + PUT /api/admin/settings round-trip of nav_config.
  - Public GET /api/settings reflects the nav_config saved by admin.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PASSWORDS = ["Admin1234!", "AdminTestPwd1!"]  # try the current then the legacy one

ADMIN_TOKEN = "ADMINTESTTOKEN123"


@pytest.fixture(scope="module")
def admin_token():
    """Try email login; fall back to seeded ADMINTESTTOKEN123 (see conftest)."""
    last_err = None
    for pw in ADMIN_PASSWORDS:
        try:
            r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": pw}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                tok = data.get("session_token") or data.get("token")
                if tok:
                    return tok
            last_err = f"{r.status_code} {r.text[:200]}"
        except Exception as e:
            last_err = str(e)
    # Fallback (conftest already seeded it)
    return ADMIN_TOKEN


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- Admin login ----------------
class TestAdminLogin:
    def test_email_password_login(self):
        found = False
        for pw in ADMIN_PASSWORDS:
            r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": pw}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                assert data.get("session_token") or data.get("token"), f"No token in response: {data}"
                user = data.get("user") or {}
                # Allowlist emails always get role=administrator
                assert user.get("role") == "administrator" or user.get("email") == ADMIN_EMAIL
                found = True
                break
        assert found, f"Admin login failed with all known passwords ({ADMIN_PASSWORDS})"


# ---------------- Admin settings CRUD (nav_config) ----------------
class TestNavConfigAdminSettings:
    def test_get_admin_settings_ok(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # nav_config may be absent initially, but the endpoint must return a dict
        assert isinstance(body, dict)

    def test_put_nav_config_persists_and_round_trips(self, admin_headers):
        marker = f"TEST_Casa_{int(time.time())}"
        payload = {
            "nav_config": {
                "index": {
                    "label": marker,
                    "color": "#0EA5E9",
                    "colorActive": "#E0B15E",
                    "indicator": True,
                },
                "podcast": {
                    "label": "TEST_Radio",
                    "indicator": False,
                },
            }
        }
        r = requests.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        nav_cfg = body.get("nav_config") or {}
        assert nav_cfg.get("index", {}).get("label") == marker
        assert nav_cfg.get("index", {}).get("color") == "#0EA5E9"
        assert nav_cfg.get("index", {}).get("colorActive") == "#E0B15E"
        assert nav_cfg.get("index", {}).get("indicator") is True
        assert nav_cfg.get("podcast", {}).get("indicator") is False

        # GET back
        r2 = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        nav_cfg2 = (r2.json() or {}).get("nav_config") or {}
        assert nav_cfg2.get("index", {}).get("label") == marker

    def test_public_settings_reflect_nav_config(self, admin_headers):
        marker = f"TEST_PublicHome_{int(time.time())}"
        r = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"nav_config": {"index": {"label": marker, "indicator": True}}},
            timeout=15,
        )
        assert r.status_code == 200, r.text

        p = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert p.status_code == 200, p.text
        pub = p.json()
        # /settings must not require auth and MUST expose nav_config for the client bottom bar
        assert isinstance(pub, dict)
        assert "nav_config" in pub, "Public /api/settings must include nav_config for the mobile bottom bar"
        assert pub["nav_config"].get("index", {}).get("label") == marker

    def test_nav_config_accepts_asset_shape(self, admin_headers):
        """nav_config accepts a NavAsset object (id/kind/mime/filename) without validation errors."""
        payload = {
            "nav_config": {
                "index": {
                    "icon": {"id": "media_test_static_123", "kind": "raster", "mime": "image/png", "filename": "home.png"},
                    "anim": {"id": "media_test_lottie_456", "kind": "lottie", "mime": "application/json", "filename": "home.json"},
                }
            }
        }
        r = requests.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        cfg = (r.json() or {}).get("nav_config", {}).get("index", {})
        assert cfg.get("icon", {}).get("id") == "media_test_static_123"
        assert cfg.get("anim", {}).get("kind") == "lottie"

    def test_cleanup_nav_config(self, admin_headers):
        # Clear the TEST marker so we don't leak into other tests
        r = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"nav_config": {}},
            timeout=15,
        )
        assert r.status_code == 200


# ---------------- Media allow-list (Lottie / animated GIF/WebP) ----------------
class TestMediaAllowList:
    def test_settings_endpoint_is_public(self):
        r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)
