"""AzuraCast radio integration tests.

Covers:
- GET /api/live/status (public, never fails)
- GET /api/live/stream (HTTPS proxy, 503 when station offline)
- GET /api/live/art (artwork proxy, 400/503 negatives)
- GET/PUT /api/admin/radio (admin-only, 403 for non-admin)
- Regression: /api/podcasts, /api/news, /api/products, /api/programs 200
- Auth: register + /auth/me
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


# ---------------- /api/live/status ----------------
class TestLiveStatus:
    def test_live_status_shape(self, s):
        r = s.get(f"{BASE_URL}/api/live/status")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["is_live", "is_online", "title", "artist", "album", "artwork",
                  "listeners", "stream_url", "refresh_interval", "station_name"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["refresh_interval"], int) and d["refresh_interval"] > 0
        # Title must be present (either live 'musica 3' or fallback 'In Diretta')
        assert isinstance(d["title"], str) and len(d["title"]) > 0
        # stream_url must reference the AzuraCast host or admin override
        assert isinstance(d["stream_url"], str)

    def test_live_status_never_500(self, s):
        # Multiple hits should never return 500 even if upstream is offline
        for _ in range(3):
            r = s.get(f"{BASE_URL}/api/live/status", timeout=15)
            assert r.status_code == 200


# ---------------- /api/live/stream ----------------
class TestLiveStream:
    def test_live_stream_offline_returns_503(self, s):
        # Station is currently offline (502 upstream) -> we must return 503, NOT hang, NOT 500
        r = s.get(f"{BASE_URL}/api/live/stream", timeout=25, stream=True)
        r.close()
        assert r.status_code == 503, f"expected 503 when offline, got {r.status_code}"


# ---------------- /api/live/art ----------------
class TestLiveArt:
    def test_art_invalid_url_400(self, s):
        r = s.get(f"{BASE_URL}/api/live/art", params={"u": "not-a-url"})
        assert r.status_code == 400

    def test_art_unreachable_url_503(self, s):
        # Route to an unroutable host to force 503 (short-ish thanks to 10s timeout in server)
        r = s.get(f"{BASE_URL}/api/live/art",
                  params={"u": "http://10.255.255.1/fake.jpg"}, timeout=30)
        assert r.status_code == 503

    def test_art_from_status_artwork(self, s):
        d = s.get(f"{BASE_URL}/api/live/status").json()
        art = d.get("artwork") or ""
        # If backend rewrote to the proxy URL (starts with BASE_URL/api/live/art?u=), fetch it
        if art.startswith(BASE_URL + "/api/live/art?u="):
            r = s.get(art, timeout=15)
            # Either 200 image OR 503 if upstream unreachable — both acceptable, no 500
            assert r.status_code in (200, 503)
            if r.status_code == 200:
                ct = r.headers.get("content-type", "")
                assert ct.startswith("image/"), f"content-type={ct}"
        else:
            # Direct https default artwork returned — should be reachable
            pytest.skip("artwork not proxied (default https image)")


# ---------------- /api/admin/radio ----------------
class TestAdminRadio:
    def test_get_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/admin/radio")
        assert r.status_code == 401

    def test_get_admin_ok(self, s, admin_headers):
        r = s.get(f"{BASE_URL}/api/admin/radio", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "stream_url" in d
        assert "metadata_url" in d

    def test_put_refresh_interval_persists(self, s, admin_headers):
        # set to 20
        r = s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers,
                  json={"refresh_interval": 20})
        assert r.status_code == 200, r.text
        assert r.json().get("refresh_interval") == 20
        # public /live/status must reflect it
        r2 = s.get(f"{BASE_URL}/api/live/status")
        assert r2.status_code == 200
        assert r2.json().get("refresh_interval") == 20
        # restore to 15
        s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers, json={"refresh_interval": 15})

    def test_put_updates_stream_url_used_by_stream(self, s, admin_headers):
        # snapshot original
        original = s.get(f"{BASE_URL}/api/admin/radio", headers=admin_headers).json()
        orig_stream = original.get("stream_url")
        try:
            # set to an unreachable URL to prove dynamic pickup
            r = s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers,
                      json={"stream_url": "http://10.255.255.1:9/nope.mp3"})
            assert r.status_code == 200
            assert r.json().get("stream_url") == "http://10.255.255.1:9/nope.mp3"
            # /api/live/stream must now return 503 (dynamic pickup, no 500)
            r2 = s.get(f"{BASE_URL}/api/live/stream", timeout=25, stream=True)
            r2.close()
            assert r2.status_code == 503
        finally:
            s.put(f"{BASE_URL}/api/admin/radio", headers=admin_headers,
                  json={"stream_url": orig_stream})

    def test_non_admin_forbidden(self, s):
        # Register a fresh listener account
        email = f"TEST_radio_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{BASE_URL}/api/auth/register",
                     json={"email": email, "password": "Test1234!", "name": "TEST radio"})
        assert reg.status_code == 200, reg.text
        token = reg.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        r = s.get(f"{BASE_URL}/api/admin/radio", headers=h)
        assert r.status_code == 403
        r2 = s.put(f"{BASE_URL}/api/admin/radio", headers=h, json={"refresh_interval": 10})
        assert r2.status_code == 403
        # cleanup handled by admin delete
        uid = reg.json()["user"]["user_id"]
        s.delete(f"{BASE_URL}/api/admin/users/{uid}",
                 headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})


# ---------------- Public regression ----------------
class TestPublicRegression:
    def test_podcasts(self, s):
        r = s.get(f"{BASE_URL}/api/podcasts")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_news(self, s):
        r = s.get(f"{BASE_URL}/api/news")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_products(self, s):
        r = s.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_programs(self, s):
        r = s.get(f"{BASE_URL}/api/programs")
        assert r.status_code == 200 and isinstance(r.json(), list)


# ---------------- Auth regression ----------------
class TestAuth:
    def test_register_and_me(self, s):
        email = f"TEST_auth_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{BASE_URL}/api/auth/register",
                     json={"email": email, "password": "Test1234!", "name": "TEST auth"})
        assert reg.status_code == 200
        token = reg.json()["token"]
        me = s.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json().get("email") == email.lower()
        uid = reg.json()["user"]["user_id"]
        s.delete(f"{BASE_URL}/api/admin/users/{uid}",
                 headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
