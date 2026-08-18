"""Backend tests for Iteration 46 — generic favorites (content-fav), library
grouping, and admin section_labels override. All flows exercised via public URL
using the admin email/password login."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PASS = "Admin1234!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("user", {}).get("role") == "administrator"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def meditation_id():
    r = requests.get(f"{BASE_URL}/api/meditations", timeout=15)
    assert r.status_code == 200, r.text
    lst = r.json()
    assert isinstance(lst, list) and len(lst) > 0, "No meditations available in preview DB — cannot test content-fav"
    return lst[0]["id"]


# ---------------- content-fav toggle ----------------
class TestContentFav:
    def test_ids_endpoint_returns_dict(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/me/content-fav-ids", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict)

    def test_toggle_invalid_type_returns_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/me/content-fav/notatype/xxx", headers=auth_headers, timeout=15)
        assert r.status_code == 400, r.text

    def test_toggle_meditation_persists_and_appears_in_library(self, auth_headers, meditation_id):
        # Ensure clean start: check current state
        ids0 = requests.get(f"{BASE_URL}/api/me/content-fav-ids", headers=auth_headers, timeout=15).json()
        was_fav = meditation_id in (ids0.get("meditazioni") or [])

        # Toggle ON if not already
        if not was_fav:
            r = requests.post(f"{BASE_URL}/api/me/content-fav/meditazioni/{meditation_id}", headers=auth_headers, timeout=15)
            assert r.status_code == 200, r.text
            assert r.json().get("favorited") is True

        # Verify appears in ids
        ids = requests.get(f"{BASE_URL}/api/me/content-fav-ids", headers=auth_headers, timeout=15).json()
        assert meditation_id in (ids.get("meditazioni") or []), ids

        # Verify shows up in /me/library under 'meditazioni' group
        lib = requests.get(f"{BASE_URL}/api/me/library", headers=auth_headers, timeout=15).json()
        assert "groups" in lib
        med_group = next((g for g in lib["groups"] if g["key"] == "meditazioni"), None)
        assert med_group is not None, lib
        assert any(it["id"] == meditation_id for it in med_group["items"])  # persisted+resolved
        item = next(it for it in med_group["items"] if it["id"] == meditation_id)
        # data shape checks
        for f in ("id", "title", "type", "route"):
            assert f in item, item
        assert item["type"] == "meditazioni"
        assert item["route"] == "/meditazioni"

        # Toggle OFF and verify removed
        r2 = requests.post(f"{BASE_URL}/api/me/content-fav/meditazioni/{meditation_id}", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("favorited") is False
        ids2 = requests.get(f"{BASE_URL}/api/me/content-fav-ids", headers=auth_headers, timeout=15).json()
        assert meditation_id not in (ids2.get("meditazioni") or [])

    def test_content_fav_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/me/content-fav-ids", timeout=15)
        assert r.status_code == 401


# ---------------- section_labels round-trip ----------------
class TestSectionLabels:
    def test_public_settings_exposes_section_labels(self):
        r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r.status_code == 200
        # key may be absent when never set — accept either
        j = r.json()
        assert isinstance(j.get("section_labels", {}), dict)

    def test_admin_can_persist_and_read_back(self, auth_headers):
        marker_val = "TESTLibIter46"
        payload = {"section_labels": {"cat_meditazioni": marker_val, "menu_team": "TESTTeamIter46"}}
        r = requests.put(f"{BASE_URL}/api/admin/settings", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        # Read back via admin GET
        r2 = requests.get(f"{BASE_URL}/api/admin/settings", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        lbls = r2.json().get("section_labels") or {}
        assert lbls.get("cat_meditazioni") == marker_val
        assert lbls.get("menu_team") == "TESTTeamIter46"
        # Public GET reflects override
        r3 = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r3.json().get("section_labels", {}).get("cat_meditazioni") == marker_val

    def test_cleanup_labels(self, auth_headers):
        # Reset to empty so live app is clean
        r = requests.put(f"{BASE_URL}/api/admin/settings", headers=auth_headers, json={"section_labels": {}}, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r2.json().get("section_labels", {}) == {}
