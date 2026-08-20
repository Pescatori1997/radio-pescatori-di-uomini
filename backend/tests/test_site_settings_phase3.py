"""Phase 3 — Personalizzazione sito (Testi & Metadati sezione)
Tests the extensible /site-settings CMS layer + section_visibility persistence.
Non-destructive: uses temporary keys/values, restores originals in teardown.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
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
    """Snapshot site_settings and general settings so we can restore at the end."""
    site_before = api.get(f"{BASE_URL}/api/site-settings").json()
    gs_before = api.get(f"{BASE_URL}/api/admin/settings", headers=auth_headers).json()
    yield {"site": site_before, "gs": gs_before}
    # Restore: clear the fields we touched
    restore_payload = {
        "texts": {
            "podcast": {"search_placeholder": site_before.get("texts", {}).get("podcast", {}).get("search_placeholder", "")}
        },
        "sections": {
            "podcast": {
                "name": site_before.get("sections", {}).get("podcast", {}).get("name", ""),
                "subtitle": site_before.get("sections", {}).get("podcast", {}).get("subtitle", ""),
            }
        },
    }
    api.put(f"{BASE_URL}/api/admin/site-settings", json=restore_payload, headers=auth_headers)
    # Restore section_visibility for podcast
    orig_vis = (gs_before.get("section_visibility") or {}).get("podcast", True)
    api.put(f"{BASE_URL}/api/admin/settings", json={"section_visibility": {**(gs_before.get("section_visibility") or {}), "podcast": orig_vis}}, headers=auth_headers)


# ---------------------- GET /site-settings ----------------------
class TestSiteSettingsShape:
    def test_public_get_returns_all_groups(self, api):
        r = api.get(f"{BASE_URL}/api/site-settings")
        assert r.status_code == 200
        data = r.json()
        expected_groups = {"navigation", "sections", "home", "texts", "images", "icons", "features", "appearance"}
        assert expected_groups.issubset(set(data.keys())), f"Missing groups: {expected_groups - set(data.keys())}"
        # Each group must be a dict
        for g in expected_groups:
            assert isinstance(data[g], dict), f"Group {g} is not a dict"


# ---------------------- Auth requirement ----------------------
class TestSiteSettingsAuth:
    def test_put_without_auth_is_forbidden(self, api):
        r = requests.put(f"{BASE_URL}/api/admin/site-settings", json={"texts": {"podcast": {"search_placeholder": "x"}}})
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_put_with_invalid_token_is_forbidden(self, api):
        r = requests.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"texts": {"podcast": {"search_placeholder": "x"}}},
            headers={"Authorization": "Bearer INVALID_TOKEN"},
        )
        assert r.status_code in (401, 403)


# ---------------------- Deep-merge non-destructive ----------------------
class TestDeepMerge:
    def test_partial_update_preserves_other_fields(self, api, auth_headers, snapshot):
        # Seed a texts.home value first
        api.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"texts": {"home": {"brand_name": "TEST_BRAND_PDU"}}},
            headers=auth_headers,
        )
        # Update a DIFFERENT field
        r = api.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"texts": {"podcast": {"search_placeholder": "TEST_placeholder_ricerca"}}},
            headers=auth_headers,
        )
        assert r.status_code == 200
        # Verify BOTH are present via public GET
        pub = api.get(f"{BASE_URL}/api/site-settings").json()
        assert pub["texts"]["home"]["brand_name"] == "TEST_BRAND_PDU"
        assert pub["texts"]["podcast"]["search_placeholder"] == "TEST_placeholder_ricerca"
        # Cleanup TEST_BRAND_PDU
        api.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"texts": {"home": {"brand_name": ""}}},
            headers=auth_headers,
        )

    def test_sections_podcast_persisted_and_reflected(self, api, auth_headers, snapshot):
        payload = {"sections": {"podcast": {"name": "Podcast TEST", "subtitle": "TEST sottotitolo"}}}
        r = api.put(f"{BASE_URL}/api/admin/site-settings", json=payload, headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert body["site_settings"]["sections"]["podcast"]["name"] == "Podcast TEST"
        # Public GET reflects it
        pub = api.get(f"{BASE_URL}/api/site-settings").json()
        assert pub["sections"]["podcast"]["name"] == "Podcast TEST"
        assert pub["sections"]["podcast"]["subtitle"] == "TEST sottotitolo"

    def test_empty_string_fallback_semantics(self, api, auth_headers, snapshot):
        """Frontend fallback: empty string means use default. Backend still stores '' -
        the frontend context does the fallback (verified in FE test)."""
        r = api.put(
            f"{BASE_URL}/api/admin/site-settings",
            json={"sections": {"podcast": {"name": ""}}},
            headers=auth_headers,
        )
        assert r.status_code == 200
        pub = api.get(f"{BASE_URL}/api/site-settings").json()
        # Backend stores empty string; FE will fall back to default "Podcast"
        assert pub["sections"]["podcast"].get("name") == ""


# ---------------------- section_visibility toggle ----------------------
class TestSectionVisibility:
    def test_toggle_podcast_visibility_off_then_on(self, api, auth_headers, snapshot):
        # Set podcast=False
        r = api.put(
            f"{BASE_URL}/api/admin/settings",
            json={"section_visibility": {**(snapshot["gs"].get("section_visibility") or {}), "podcast": False}},
            headers=auth_headers,
        )
        assert r.status_code == 200
        pub = api.get(f"{BASE_URL}/api/settings").json()
        assert pub["section_visibility"]["podcast"] is False

        # Restore to True
        r = api.put(
            f"{BASE_URL}/api/admin/settings",
            json={"section_visibility": {**(snapshot["gs"].get("section_visibility") or {}), "podcast": True}},
            headers=auth_headers,
        )
        assert r.status_code == 200
        pub2 = api.get(f"{BASE_URL}/api/settings").json()
        assert pub2["section_visibility"]["podcast"] is True
