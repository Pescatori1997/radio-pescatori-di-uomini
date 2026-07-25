"""Live Streaming (multi-platform) backend tests.

Covers the extension of Live Mode with configurable multi-platform live_links.

Endpoints under test:
- PUT  /api/admin/radio           accepts live_links (Dict[str,str]) + persists
- GET  /api/admin/radio           returns live_links (still masks api key)
- GET  /api/live/status  (public) returns live_links
- GET  /api/admin/radio/status    returns live_links in status payload
- POST /api/admin/radio/live      {action:'start'|'end'} unchanged behavior

IMPORTANT: Station is REAL & online. This suite ends with:
  * live_mode=false (POST /api/admin/radio/live {action:'end'})
  * live_links={}   (PUT /api/admin/radio {live_links:{}})
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://evangelic-stream.preview.emergentagent.com",
).rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="session", autouse=True)
def _snapshot_and_restore(s, admin_headers):
    """Capture initial live_links + live_mode, restore at teardown."""
    r0 = s.get(f"{BASE_URL}/api/admin/radio", headers=admin_headers)
    original_links = {}
    if r0.status_code == 200:
        original_links = r0.json().get("live_links") or {}
    yield
    # Restore live_links
    try:
        s.put(
            f"{BASE_URL}/api/admin/radio",
            headers=admin_headers,
            json={"live_links": original_links},
            timeout=15,
        )
    except Exception:
        pass
    # Ensure live_mode = false so AutoDJ runs
    try:
        s.post(
            f"{BASE_URL}/api/admin/radio/live",
            headers=admin_headers,
            json={"action": "end"},
            timeout=30,
        )
    except Exception:
        pass


# ---------------- PUT /api/admin/radio (live_links persistence) ----------------
class TestLiveLinksPersistence:
    def test_put_requires_auth(self, s):
        r = s.put(f"{BASE_URL}/api/admin/radio", json={"live_links": {"youtube": "x"}})
        assert r.status_code == 401, r.text

    def test_put_persists_live_links(self, s, admin_headers):
        payload = {
            "live_links": {
                "youtube": "https://youtube.com/@pescatori/live",
                "facebook": "https://facebook.com/pescatori/live",
                "tiktok": "https://tiktok.com/@pescatori/live",
                "instagram": "https://instagram.com/pescatori/live",
                "website": "https://www.pescatoridiuomini.it/diretta",
                "custom": "https://example.com/custom",
            }
        }
        r = s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        # Response must return live_links AND still mask api key
        assert body.get("live_links") == payload["live_links"]
        assert "azuracast_api_key" not in body
        assert body.get("has_api_key") in (True, False)

        # GET verifies persistence
        r2 = s.get(f"{BASE_URL}/api/admin/radio", headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json().get("live_links") == payload["live_links"]

    def test_put_partial_update_merges_or_replaces(self, s, admin_headers):
        """PUT with new live_links replaces the dict (Mongo $set semantics)."""
        # Set only 2 platforms
        payload = {"live_links": {"youtube": "https://youtube.com/only", "facebook": "https://fb.com/only"}}
        r = s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers, json=payload)
        assert r.status_code == 200
        assert r.json().get("live_links") == payload["live_links"]

    def test_put_empty_live_links_clears(self, s, admin_headers):
        r = s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers, json={"live_links": {}})
        assert r.status_code == 200
        assert r.json().get("live_links") == {}


# ---------------- GET /api/live/status (public) ----------------
class TestPublicLiveStatusLinks:
    def test_public_live_status_includes_live_links(self, s, admin_headers):
        # Set 2 platforms
        payload = {"live_links": {"youtube": "https://youtube.com/@x/live", "website": "https://site.tld/live"}}
        r = s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers, json=payload)
        assert r.status_code == 200

        # Public endpoint (no auth) must expose live_links
        r2 = s.get(f"{BASE_URL}/api/live/status")
        assert r2.status_code == 200
        body = r2.json()
        assert "live_links" in body
        assert body["live_links"] == payload["live_links"]
        # Regression fields
        assert "live_mode" in body
        assert "live_watch_url" in body
        assert "stream_url" in body

    def test_public_live_status_after_clear(self, s, admin_headers):
        r = s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers, json={"live_links": {}})
        assert r.status_code == 200
        r2 = s.get(f"{BASE_URL}/api/live/status")
        assert r2.status_code == 200
        assert r2.json().get("live_links") == {}


# ---------------- GET /api/admin/radio/status (with live_links) ----------------
class TestAdminRadioStatusLinks:
    def test_status_returns_live_links(self, s, admin_headers):
        payload = {"live_links": {"tiktok": "https://tiktok.com/@x/live"}}
        r = s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers, json=payload)
        assert r.status_code == 200

        r2 = s.get(f"{BASE_URL}/api/admin/radio/status", headers=admin_headers)
        assert r2.status_code == 200
        body = r2.json()
        # Regression fields
        for k in ("backend_running", "frontend_running", "listeners", "live_mode", "live_watch_url"):
            assert k in body, f"missing key {k} in status payload"
        # New field
        assert body.get("live_links") == payload["live_links"]

    def test_status_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/admin/radio/status")
        assert r.status_code == 401


# ---------------- POST /api/admin/radio/live (regression, must end with 'end') ----------------
class TestLiveModeToggleRegression:
    def test_start_then_end_live_mode(self, s, admin_headers):
        # Preconfigure some links
        s.put(
            f"{BASE_URL}/api/admin/radio",
            headers=admin_headers,
            json={"live_links": {"youtube": "https://youtube.com/@x/live", "facebook": "https://fb.com/live"}},
        )

        # START
        r1 = s.post(
            f"{BASE_URL}/api/admin/radio/live",
            headers=admin_headers,
            json={"action": "start"},
            timeout=30,
        )
        assert r1.status_code == 200, r1.text
        body1 = r1.json()
        assert body1.get("ok") is True
        st1 = body1.get("status") or {}
        assert st1.get("live_mode") is True
        # live_links still surfaced
        assert st1.get("live_links", {}).get("youtube")

        # Public reflects live_mode=true immediately
        pub = s.get(f"{BASE_URL}/api/live/status").json()
        assert pub.get("live_mode") is True
        assert pub.get("live_links", {}).get("youtube")

        # END (MANDATORY — restores AutoDJ)
        r2 = s.post(
            f"{BASE_URL}/api/admin/radio/live",
            headers=admin_headers,
            json={"action": "end"},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        st2 = r2.json().get("status") or {}
        assert st2.get("live_mode") is False

    def test_invalid_action_returns_400(self, s, admin_headers):
        r = s.post(
            f"{BASE_URL}/api/admin/radio/live",
            headers=admin_headers,
            json={"action": "explode"},
        )
        assert r.status_code == 400


# ---------------- Regression: mask still works while live_links present ----------------
class TestApiKeyMaskingRegression:
    def test_get_admin_radio_masks_key_with_links_present(self, s, admin_headers):
        s.put(
            f"{BASE_URL}/api/admin/radio",
            headers=admin_headers,
            json={"live_links": {"instagram": "https://ig.com/x"}},
        )
        r = s.get(f"{BASE_URL}/api/admin/radio", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert "azuracast_api_key" not in body
        assert "has_api_key" in body
        assert body.get("station_shortcode")
        assert body.get("live_links", {}).get("instagram")
