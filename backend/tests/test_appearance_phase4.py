"""Phase 4 — Personalizzazione sito: Aspetto (brand palette)
Focused tests for the appearance.palette field on /site-settings.
Non-destructive: restores original palette in teardown.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") \
    or "https://evangelic-stream.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="module")
def snapshot(api, auth_headers):
    """Snapshot original site-settings and always restore appearance/texts we touch."""
    site_before = api.get(f"{BASE_URL}/api/site-settings").json()
    yield {"site": site_before}
    orig_palette = (site_before.get("appearance") or {}).get("palette", "sky")
    orig_texts_home_brand = (
        (site_before.get("texts") or {}).get("home") or {}
    ).get("brand_name", "")
    api.put(
        f"{BASE_URL}/api/admin/site-settings",
        json={
            "appearance": {"palette": orig_palette or "sky"},
            "texts": {"home": {"brand_name": orig_texts_home_brand}},
        },
        headers=auth_headers,
    )


# ---------------------- Public GET shape ----------------------
class TestAppearanceGroupShape:
    def test_get_returns_appearance_group(self, api):
        r = api.get(f"{BASE_URL}/api/site-settings")
        assert r.status_code == 200
        data = r.json()
        assert "appearance" in data and isinstance(data["appearance"], dict)


# ---------------------- Auth ----------------------
class TestAppearanceAuth:
    def test_put_appearance_without_auth(self, api):
        r = requests.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"appearance": {"palette": "teal"}},
        )
        assert r.status_code in (401, 403), f"got {r.status_code}"

    def test_put_appearance_invalid_token(self, api):
        r = requests.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"appearance": {"palette": "teal"}},
            headers={"Authorization": "Bearer NOPE"},
        )
        assert r.status_code in (401, 403)


# ---------------------- Set + read back ----------------------
class TestAppearanceSetTeal:
    def test_set_palette_teal_and_reflect(self, api, auth_headers, snapshot):
        r = api.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"appearance": {"palette": "teal"}},
            headers=auth_headers,
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        # Public GET reflects it
        pub = api.get(f"{BASE_URL}/api/site-settings").json()
        assert pub["appearance"]["palette"] == "teal"

    def test_appearance_update_is_non_destructive_on_texts(self, api, auth_headers, snapshot):
        # Seed a texts field first
        api.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"texts": {"home": {"brand_name": "TEST_BRAND_PDU_P4"}}},
            headers=auth_headers,
        )
        # Now update appearance only
        r = api.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"appearance": {"palette": "amber"}},
            headers=auth_headers,
        )
        assert r.status_code == 200
        pub = api.get(f"{BASE_URL}/api/site-settings").json()
        assert pub["appearance"]["palette"] == "amber"
        # texts NOT wiped
        assert pub["texts"]["home"]["brand_name"] == "TEST_BRAND_PDU_P4"
        # Also sections group still present (structure preserved)
        assert isinstance(pub.get("sections"), dict)

    def test_restore_palette_to_sky(self, api, auth_headers, snapshot):
        r = api.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"appearance": {"palette": "sky"}},
            headers=auth_headers,
        )
        assert r.status_code == 200
        pub = api.get(f"{BASE_URL}/api/site-settings").json()
        assert pub["appearance"]["palette"] == "sky"
