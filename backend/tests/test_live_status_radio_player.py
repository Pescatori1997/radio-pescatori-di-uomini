"""Backend tests for GET /api/live/status radio-player payload (session 34+).

Ensures the new keys required by the redesigned Radio Player are always present
and correctly typed, and that the endpoint never returns 5xx even when the
upstream AzuraCast metadata is unreachable (development scenario).
"""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
           os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")

if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestLiveStatusRadioPlayer:
    """/api/live/status shape for Radio Player"""

    def test_endpoint_never_500(self, api):
        r = api.get(f"{BASE_URL}/api/live/status", timeout=15)
        assert r.status_code == 200, f"live/status returned {r.status_code}: {r.text[:200]}"

    def test_required_keys_present(self, api):
        r = api.get(f"{BASE_URL}/api/live/status", timeout=15)
        data = r.json()
        for key in [
            "is_live", "is_online", "title", "artist", "artwork",
            "stream_url", "refresh_interval", "playing_next",
            "song_history", "next_program",
        ]:
            assert key in data, f"missing key {key} in response"

    def test_playing_next_type(self, api):
        r = api.get(f"{BASE_URL}/api/live/status", timeout=15)
        pn = r.json().get("playing_next")
        assert pn is None or isinstance(pn, dict), f"playing_next has wrong type: {type(pn)}"
        if isinstance(pn, dict):
            for k in ("title", "artist"):
                assert k in pn

    def test_song_history_type(self, api):
        r = api.get(f"{BASE_URL}/api/live/status", timeout=15)
        hist = r.json().get("song_history")
        assert isinstance(hist, list), f"song_history must be list, got {type(hist)}"
        for h in hist:
            assert isinstance(h, dict)
            assert "title" in h and "artist" in h

    def test_current_program_type(self, api):
        r = api.get(f"{BASE_URL}/api/live/status", timeout=15)
        cp = r.json().get("current_program")
        # Optional key; may be absent when nothing is on air. When present must be a dict.
        assert cp is None or isinstance(cp, dict)
        if isinstance(cp, dict):
            for k in ("id", "title", "host", "start_time", "end_time"):
                assert k in cp, f"current_program missing key {k}"

    def test_next_program_shape(self, api):
        r = api.get(f"{BASE_URL}/api/live/status", timeout=15)
        np_ = r.json().get("next_program")
        assert np_ is None or isinstance(np_, dict), f"next_program wrong type: {type(np_)}"
        if isinstance(np_, dict):
            for k in ("id", "title", "host", "start_time", "end_time", "weekdays", "starts_at"):
                assert k in np_, f"next_program missing key {k}"
            assert isinstance(np_["weekdays"], list)
            # Time format HH:MM
            assert len(np_["start_time"]) == 5 and np_["start_time"][2] == ":"

    def test_azuracast_unreachable_graceful(self, api):
        """When AzuraCast is unreachable playing_next/song_history stay empty but
        the endpoint MUST still return 200 with fallback values."""
        r = api.get(f"{BASE_URL}/api/live/status", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # In dev the TEST metadata URL is unreachable -> is_online False, no crash.
        assert data.get("is_live") is True
        # playing_next may be None; song_history may be []; either way not 500.
        assert data.get("song_history") == [] or isinstance(data["song_history"], list)

    def test_repeated_calls_stable(self, api):
        """Endpoint should be idempotent under repeated polling (frontend polls
        every ~15s)."""
        codes = []
        for _ in range(3):
            codes.append(api.get(f"{BASE_URL}/api/live/status", timeout=15).status_code)
            time.sleep(0.2)
        assert set(codes) == {200}, f"Non-200 detected: {codes}"
