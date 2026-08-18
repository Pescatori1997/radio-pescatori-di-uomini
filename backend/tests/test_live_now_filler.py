"""Backend tests for the 'Diretta in tempo reale' feature.

Covers:
- GET /api/live/now: shape + always 200 (public, no auth)
- PUT /api/admin/settings (admin auth) persists live_filler_* fields WITHOUT
  clearing other settings (uses exclude_unset)
- GET /api/admin/settings re-reads them
- GET /api/live/now reflects the configured filler
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://evangelic-stream.preview.emergentagent.com",
).rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="module", autouse=True)
def _snapshot_and_restore(s, admin_headers):
    """Snapshot filler-related settings + a sibling field, restore on teardown."""
    r0 = s.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
    snap = {}
    if r0.status_code == 200:
        d = r0.json() or {}
        snap = {
            "live_filler_kind": d.get("live_filler_kind"),
            "live_filler_url": d.get("live_filler_url"),
            "live_filler_message": d.get("live_filler_message"),
            "contact_email": d.get("contact_email"),
            "about_short": d.get("about_short"),
        }
    yield
    # Restore (send None as empty string / "" to reset filler cleanly)
    payload = {
        "live_filler_kind": snap.get("live_filler_kind") or "",
        "live_filler_url": snap.get("live_filler_url") or "",
        "live_filler_message": snap.get("live_filler_message") or "",
    }
    if snap.get("contact_email") is not None:
        payload["contact_email"] = snap["contact_email"]
    if snap.get("about_short") is not None:
        payload["about_short"] = snap["about_short"]
    try:
        s.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json=payload, timeout=15)
    except Exception:
        pass


# ---------------- GET /api/live/now (public shape) ----------------
class TestLiveNowShape:
    def test_public_returns_200_and_shape(self, s):
        r = s.get(f"{BASE_URL}/api/live/now")
        assert r.status_code == 200, r.text
        data = r.json()
        # Required keys
        for k in ("server_time", "on_air", "program", "media", "offset_seconds",
                  "duration_seconds", "ends_in_seconds", "next", "up_next", "filler"):
            assert k in data, f"missing key '{k}' in /live/now"
        # Types
        assert isinstance(data["on_air"], bool)
        assert isinstance(data["offset_seconds"], int)
        assert isinstance(data["up_next"], list)
        assert isinstance(data["filler"], dict)
        for fk in ("kind", "url", "message"):
            assert fk in data["filler"], f"filler missing '{fk}'"


# ---------------- PUT /api/admin/settings (auth + persistence) ----------------
class TestAdminSettingsFillerPersistence:
    def test_put_requires_auth(self, s):
        r = s.put(f"{BASE_URL}/api/admin/settings", json={"live_filler_kind": "message"})
        assert r.status_code in (401, 403), r.text

    def test_put_persists_filler_and_get_reflects(self, s, admin_headers):
        payload = {
            "live_filler_kind": "message",
            "live_filler_message": "Torna più tardi",
            "live_filler_url": "",
        }
        r = s.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("live_filler_kind") == "message"
        assert body.get("live_filler_message") == "Torna più tardi"

        # GET reflects
        r2 = s.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("live_filler_kind") == "message"
        assert d.get("live_filler_message") == "Torna più tardi"

    def test_exclude_unset_does_not_wipe_other_fields(self, s, admin_headers):
        """Setting an unrelated field must not clear the filler_* fields set previously."""
        # First set filler
        s.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json={
            "live_filler_kind": "message",
            "live_filler_message": "Torna più tardi",
        })
        # Now set an unrelated field (contact_email) via a partial PUT
        marker_email = "TEST_filler_marker@example.com"
        r = s.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json={"contact_email": marker_email})
        assert r.status_code == 200
        d = r.json()
        # Both should coexist (exclude_unset semantics)
        assert d.get("contact_email") == marker_email
        assert d.get("live_filler_kind") == "message"
        assert d.get("live_filler_message") == "Torna più tardi"

        # Cleanup marker: rely on module teardown to restore snapshot

    def test_live_now_reflects_filler(self, s, admin_headers):
        # Set message-type filler
        s.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json={
            "live_filler_kind": "message",
            "live_filler_message": "Torna più tardi",
            "live_filler_url": "",
        })
        r = s.get(f"{BASE_URL}/api/live/now")
        assert r.status_code == 200
        f = r.json().get("filler") or {}
        assert f.get("kind") == "message"
        assert f.get("message") == "Torna più tardi"

    def test_switching_kind_to_video_reflects(self, s, admin_headers):
        s.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json={
            "live_filler_kind": "video",
            "live_filler_url": "/api/media/fakeid123",
            "live_filler_message": "",
        })
        r = s.get(f"{BASE_URL}/api/live/now")
        assert r.status_code == 200
        f = r.json().get("filler") or {}
        assert f.get("kind") == "video"
        assert f.get("url") == "/api/media/fakeid123"

    def test_clearing_kind_reflects(self, s, admin_headers):
        s.put(f"{BASE_URL}/api/admin/settings", headers=admin_headers, json={
            "live_filler_kind": "",
            "live_filler_url": "",
            "live_filler_message": "",
        })
        r = s.get(f"{BASE_URL}/api/live/now")
        assert r.status_code == 200
        f = r.json().get("filler") or {}
        assert f.get("kind") in ("", None)
