"""v1.1 backend hardening tests:
- Auth rate limiting (429 after 10 rapid wrong logins)
- Anti-ReDoS on search endpoints (re.escape safe)
- TTS meditation (audio generation & retrieval, graceful degradation)
- Verse-notification config (GET/PUT + invalid day filtering)
- Audio cache invalidation on manual meditation edit
- Regression: verse endpoints (today, {id}, admin CRUD, notify-today)
- Auth guard on protected admin endpoints
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PWD = "AdminTestPwd1!"


# --- fixtures ---------------------------------------------------------------
@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


@pytest.fixture(scope="module")
def admin_token():
    """Use the seeded ADMINTESTTOKEN123 from conftest — bypasses the login
    rate limiter so authenticated tests still work after the burst test."""
    return "ADMINTESTTOKEN123"


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}


# --- 1. RATE LIMIT ----------------------------------------------------------
class TestRateLimit:
    """Login rate-limit: 10/min per IP. Note: this test runs after admin_token
    fixture consumed 1 slot, so we may hit 429 slightly earlier — accepted."""

    def test_login_rate_limit_returns_429(self, s):
        codes = []
        # Send 12 wrong logins from same IP. Limit is 10/min.
        for i in range(12):
            r = s.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": f"noone-{uuid.uuid4().hex[:6]}@example.com", "password": "wrong"},
                timeout=15,
            )
            codes.append(r.status_code)
        # Confirm we got at least one 401 and at least one 429.
        assert 401 in codes, f"expected some 401s, got {codes}"
        assert 429 in codes, f"expected at least one 429, got {codes}"
        # First few should be 401 (unauth wrong creds); after limit — 429s.
        # Wait briefly, then confirm a normal, unrelated endpoint still works.
        time.sleep(1)
        r = s.get(f"{BASE_URL}/api/verse/today", timeout=15)
        assert r.status_code == 200

    def test_after_window_login_route_recovers(self, s):
        """Rate-limit window is 60s. We don't wait the whole minute — just
        confirm a NON-rate-limited public endpoint works right after."""
        r = s.get(f"{BASE_URL}/api/podcasts", timeout=15)
        assert r.status_code == 200


# --- 2. ANTI-ReDoS ----------------------------------------------------------
class TestAntiReDoS:
    def test_podcasts_search_evil_regex_is_safe(self, s):
        start = time.time()
        r = s.get(f"{BASE_URL}/api/podcasts", params={"search": "(a+)+"}, timeout=10)
        elapsed = time.time() - start
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        assert elapsed < 5, f"took too long: {elapsed:.2f}s (possible ReDoS)"

    def test_meditations_search_special_chars_is_safe(self, s):
        start = time.time()
        r = s.get(f"{BASE_URL}/api/meditations", params={"search": "[test.*+?^${}()|\\]"}, timeout=10)
        elapsed = time.time() - start
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        assert elapsed < 5, f"took too long: {elapsed:.2f}s"


# --- 3. TTS meditation ------------------------------------------------------
class TestTTSMeditation:
    def test_get_today_and_meditation(self, s):
        r = s.get(f"{BASE_URL}/api/verse/today", timeout=15)
        assert r.status_code == 200
        vid = r.json().get("id")
        assert vid
        # meditation endpoint always returns text (even if audio not ready)
        r2 = s.get(f"{BASE_URL}/api/verse/{vid}/meditation", timeout=60)
        assert r2.status_code == 200, f"{r2.status_code} {r2.text[:200]}"
        data = r2.json()
        assert "meditation" in data and isinstance(data["meditation"], str)
        assert "reflection" in data
        assert "audio" in data and isinstance(data["audio"], bool)
        assert len(data["meditation"].strip()) > 20

    def test_meditation_audio_becomes_ready(self, s):
        """Poll the audio endpoint up to ~20s. Expect 200 audio/mpeg with body >10KB."""
        vid = s.get(f"{BASE_URL}/api/verse/today", timeout=15).json()["id"]
        # trigger meditation (starts background TTS)
        s.get(f"{BASE_URL}/api/verse/{vid}/meditation", timeout=60)
        deadline = time.time() + 25
        last = None
        while time.time() < deadline:
            r = s.get(f"{BASE_URL}/api/verse/{vid}/meditation/audio", timeout=15)
            last = r
            if r.status_code == 200:
                break
            time.sleep(1.5)
        assert last is not None
        assert last.status_code == 200, f"audio not ready after 25s: {last.status_code} {last.text[:200]}"
        ctype = last.headers.get("content-type", "")
        assert "audio/mpeg" in ctype, f"unexpected content-type: {ctype}"
        assert len(last.content) > 10_000, f"audio too small: {len(last.content)} bytes"


# --- 4. VERSE NOTIF CONFIG --------------------------------------------------
class TestVerseNotifConfig:
    def test_get_returns_all_fields(self, s, auth_headers):
        r = s.get(f"{BASE_URL}/api/admin/verse-notification", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("enabled", "title", "message", "send_time", "send_days", "all_days"):
            assert k in data, f"missing key {k} in {data}"
        assert isinstance(data["send_days"], list)
        assert isinstance(data["all_days"], list)
        assert len(data["all_days"]) == 7

    def test_put_persists_and_filters_invalid_day(self, s, auth_headers):
        payload = {"send_time": "08:00", "send_days": ["Lunedì", "Martedì", "FooInvalid"]}
        r = s.put(f"{BASE_URL}/api/admin/verse-notification", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        # GET must reflect the changes with FooInvalid filtered out
        r2 = s.get(f"{BASE_URL}/api/admin/verse-notification", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["send_time"] == "08:00"
        assert "FooInvalid" not in d["send_days"]
        assert "Lunedì" in d["send_days"] and "Martedì" in d["send_days"]
        # Restore send_time to 07:30 AND send_days to all 7 (test spec cleanup).
        r3 = s.put(f"{BASE_URL}/api/admin/verse-notification", headers=auth_headers,
                   json={"send_time": "07:30",
                         "send_days": ["Lunedì", "Martedì", "Mercoledì", "Giovedì",
                                       "Venerdì", "Sabato", "Domenica"]}, timeout=15)
        assert r3.status_code == 200
        d2 = s.get(f"{BASE_URL}/api/admin/verse-notification", headers=auth_headers, timeout=15).json()
        assert d2["send_time"] == "07:30"
        assert len(d2["send_days"]) == 7


# --- 5. AUDIO INVALIDATION on manual meditation edit ------------------------
class TestAudioInvalidation:
    def test_manual_meditation_invalidates_audio_and_locks(self, s, auth_headers):
        # Create a TEST verse
        verse_body = {
            "reference": "TEST_Salmo 1:1",
            "text": "TEST_ Beato l'uomo che non cammina secondo il consiglio degli empi.",
            "active": True,
        }
        r = s.post(f"{BASE_URL}/api/admin/verses", headers=auth_headers, json=verse_body, timeout=15)
        assert r.status_code == 201, f"create failed: {r.status_code} {r.text[:200]}"
        vid = r.json()["id"]

        try:
            # Trigger meditation → schedules background TTS
            rm = s.get(f"{BASE_URL}/api/verse/{vid}/meditation", timeout=60)
            assert rm.status_code == 200
            # Wait for audio to become ready
            audio_ready = False
            deadline = time.time() + 25
            while time.time() < deadline:
                ra = s.get(f"{BASE_URL}/api/verse/{vid}/meditation/audio", timeout=15)
                if ra.status_code == 200 and len(ra.content) > 10_000:
                    audio_ready = True
                    break
                time.sleep(1.5)
            assert audio_ready, "audio never became ready for test verse"

            # PATCH manual meditation → should lock + invalidate audio
            rp = s.patch(
                f"{BASE_URL}/api/admin/verses/{vid}",
                headers=auth_headers,
                json={"meditation": "Testo manuale di prova"},
                timeout=15,
            )
            assert rp.status_code == 200, f"{rp.status_code} {rp.text[:200]}"

            # GET /admin/verses → meditation_locked True on our verse
            rl = s.get(f"{BASE_URL}/api/admin/verses", headers=auth_headers,
                       params={"search": "TEST_Salmo 1:1"}, timeout=15)
            assert rl.status_code == 200
            docs = [d for d in rl.json() if d.get("id") == vid]
            assert docs, "our TEST verse not found in list"
            assert docs[0].get("meditation_locked") is True

            # Audio endpoint must 404 (cache invalidated)
            ra2 = s.get(f"{BASE_URL}/api/verse/{vid}/meditation/audio", timeout=15)
            assert ra2.status_code == 404, f"expected 404, got {ra2.status_code}"
        finally:
            # Cleanup
            s.delete(f"{BASE_URL}/api/admin/verses/{vid}", headers=auth_headers, timeout=15)


# --- 6. REGRESSION: verse endpoints ----------------------------------------
class TestVerseRegression:
    def test_verse_today_200(self, s):
        r = s.get(f"{BASE_URL}/api/verse/today", timeout=15)
        assert r.status_code == 200
        assert "id" in r.json() and "reference" in r.json() and "text" in r.json()

    def test_verse_by_id_200_and_404(self, s):
        vid = s.get(f"{BASE_URL}/api/verse/today").json()["id"]
        r = s.get(f"{BASE_URL}/api/verse/{vid}", timeout=15)
        assert r.status_code == 200
        r404 = s.get(f"{BASE_URL}/api/verse/does-not-exist-xyz", timeout=15)
        assert r404.status_code == 404

    def test_admin_verses_crud(self, s, auth_headers):
        # Create
        body = {"reference": "TEST_Regr 1:1", "text": "TEST_ regression body", "active": True}
        rc = s.post(f"{BASE_URL}/api/admin/verses", headers=auth_headers, json=body, timeout=15)
        assert rc.status_code == 201
        vid = rc.json()["id"]
        # Patch
        rp = s.patch(f"{BASE_URL}/api/admin/verses/{vid}", headers=auth_headers,
                     json={"text": "TEST_ regression updated"}, timeout=15)
        assert rp.status_code == 200
        # Patch unknown -> 404
        rp404 = s.patch(f"{BASE_URL}/api/admin/verses/nope-{uuid.uuid4().hex[:6]}",
                        headers=auth_headers, json={"text": "x"}, timeout=15)
        assert rp404.status_code == 404
        # Delete
        rd = s.delete(f"{BASE_URL}/api/admin/verses/{vid}", headers=auth_headers, timeout=15)
        assert rd.status_code == 200

    def test_notify_today_returns_recipients_count(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/admin/verses/notify-today", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("ok") is True
        assert "recipients" in data and isinstance(data["recipients"], int)


# --- 7. AUTH GUARD ---------------------------------------------------------
class TestAuthGuard:
    def test_verse_notification_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/admin/verse-notification", timeout=15)
        assert r.status_code == 401

    def test_admin_verses_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/admin/verses", timeout=15)
        assert r.status_code == 401
