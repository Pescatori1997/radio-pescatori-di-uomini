"""Test /api/admin/podcasts/spotify-episodes - Spotify episode import."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ENDPOINT = f"{BASE_URL}/api/admin/podcasts/spotify-episodes"
ADMIN_TOKEN = "ADMINTESTTOKEN123"

SPOTIFY_SHOW = "https://open.spotify.com/show/11WSBH5OJrC10dnZZEpfVx"
DIRECT_RSS = "https://anchor.fm/s/10cb630ac/podcast/rss"


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}


class TestSpotifyImportAuth:
    def test_no_auth_returns_401_or_403(self):
        r = requests.post(ENDPOINT, json={"source": SPOTIFY_SHOW}, timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_bad_token_returns_401_or_403(self):
        r = requests.post(
            ENDPOINT,
            json={"source": SPOTIFY_SHOW},
            headers={"Authorization": "Bearer INVALID_XYZ", "Content-Type": "application/json"},
            timeout=30,
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


class TestSpotifyImportFromSpotifyURL:
    def test_import_from_spotify_show_url(self, admin_headers):
        r = requests.post(ENDPOINT, json={"source": SPOTIFY_SHOW}, headers=admin_headers, timeout=60)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
        data = r.json()
        # structure
        assert "feed_url" in data
        assert "podcast_title" in data
        assert "episodes" in data
        assert isinstance(data["episodes"], list)
        assert len(data["episodes"]) > 0
        # title
        assert "Pescatori di Uomini" in data["podcast_title"], f"unexpected title: {data['podcast_title']}"
        # every episode must have direct .mp3 in cloudfront (or at least NOT open.spotify.com)
        for i, ep in enumerate(data["episodes"]):
            au = ep.get("audio_url", "")
            assert au, f"ep #{i} missing audio_url"
            assert "open.spotify.com" not in au, f"ep #{i} audio_url still points to spotify: {au}"
            assert au.lower().endswith(".mp3") or ".mp3?" in au.lower(), f"ep #{i} not direct mp3: {au}"
        # at least first episode on cloudfront host
        first_au = data["episodes"][0]["audio_url"]
        assert "d3ctxlq1ktw2nl.cloudfront.net" in first_au, f"first ep host not cloudfront: {first_au}"
        # required fields on episode
        for key in ("title", "description", "image", "duration", "published"):
            assert key in data["episodes"][0]


class TestSpotifyImportFromDirectRSS:
    def test_import_from_rss_url(self, admin_headers):
        r = requests.post(ENDPOINT, json={"source": DIRECT_RSS}, headers=admin_headers, timeout=60)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
        data = r.json()
        assert "Pescatori di Uomini" in data["podcast_title"]
        assert len(data["episodes"]) > 0
        assert "d3ctxlq1ktw2nl.cloudfront.net" in data["episodes"][0]["audio_url"]

    def test_spotify_and_rss_return_same_episode_count(self, admin_headers):
        r1 = requests.post(ENDPOINT, json={"source": SPOTIFY_SHOW}, headers=admin_headers, timeout=60)
        r2 = requests.post(ENDPOINT, json={"source": DIRECT_RSS}, headers=admin_headers, timeout=60)
        assert r1.status_code == 200 and r2.status_code == 200
        assert len(r1.json()["episodes"]) == len(r2.json()["episodes"])


class TestSpotifyImportErrors:
    def test_empty_source_returns_400(self, admin_headers):
        r = requests.post(ENDPOINT, json={"source": ""}, headers=admin_headers, timeout=30)
        assert r.status_code == 400
