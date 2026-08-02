"""Tests for Showcase (Vetrina) feature.

Covers:
- Public GET /api/showcase visibility rules (active + date window + order)
- Admin CRUD /api/admin/showcase (create, get, patch, delete, order)
- Permission guard require_perm("showcase") -> 403 for non-admin/no-perm users
- Regression: /api/news and /api/admin/news continue to work
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def listener_token():
    """Register a fresh listener account and return its bearer token."""
    email = f"TEST_showcase_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "Test1234!", "name": "TEST Listener"},
        timeout=15,
    )
    assert r.status_code in (200, 201), f"register failed {r.status_code}: {r.text}"
    data = r.json()
    tok = data.get("session_token") or data.get("token") or data.get("access_token")
    assert tok, f"no token in register response: {data}"
    return tok


# -------- Public endpoint --------
class TestPublicShowcase:
    def test_public_returns_only_active_visible(self):
        r = requests.get(f"{BASE_URL}/api/showcase", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for card in data:
            assert card.get("active") is True
            # visible by date if set
            sd = card.get("start_date")
            ed = card.get("end_date")
            today = date.today()
            if sd:
                assert date.fromisoformat(sd[:10]) <= today
            if ed:
                assert date.fromisoformat(ed[:10]) >= today
            assert "_id" not in card

    def test_public_order_ascending(self):
        r = requests.get(f"{BASE_URL}/api/showcase", timeout=15)
        assert r.status_code == 200
        orders = [c.get("order", 0) for c in r.json()]
        assert orders == sorted(orders)


# -------- Admin CRUD --------
class TestAdminShowcaseCRUD:
    created_ids: list = []

    def test_admin_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/showcase", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_card(self, admin_headers):
        payload = {
            "title": "TEST_ Showcase A",
            "description": "TEST description",
            "category": "TEST",
            "cta_text": "Vai",
            "cta_url": "https://example.com",
            "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/admin/showcase", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 201, r.text
        j = r.json()
        assert j.get("ok") is True and j.get("id")
        TestAdminShowcaseCRUD.created_ids.append(j["id"])

        # verify persistence via GET
        r2 = requests.get(f"{BASE_URL}/api/admin/showcase/{j['id']}", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        got = r2.json()
        assert got["title"] == payload["title"]
        assert got["cta_url"] == payload["cta_url"]
        assert got["active"] is True

    def test_patch_toggle_active(self, admin_headers):
        assert TestAdminShowcaseCRUD.created_ids
        sid = TestAdminShowcaseCRUD.created_ids[0]
        r = requests.patch(
            f"{BASE_URL}/api/admin/showcase/{sid}",
            headers=admin_headers,
            json={"active": False, "description": "TEST edited"},
            timeout=15,
        )
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/admin/showcase/{sid}", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["active"] is False
        assert r2.json()["description"] == "TEST edited"

    def test_disabled_card_not_in_public(self, admin_headers):
        assert TestAdminShowcaseCRUD.created_ids
        sid = TestAdminShowcaseCRUD.created_ids[0]
        r = requests.get(f"{BASE_URL}/api/showcase", timeout=15)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert sid not in ids

    def test_date_window_future(self, admin_headers):
        """A card with start_date in the future must NOT appear in /api/showcase."""
        future = (date.today() + timedelta(days=10)).isoformat()
        payload = {"title": "TEST_ future", "active": True, "start_date": future}
        r = requests.post(f"{BASE_URL}/api/admin/showcase", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 201
        sid = r.json()["id"]
        TestAdminShowcaseCRUD.created_ids.append(sid)

        pub = requests.get(f"{BASE_URL}/api/showcase", timeout=15).json()
        assert sid not in [c["id"] for c in pub]

    def test_date_window_past(self, admin_headers):
        """A card with end_date in the past must NOT appear in /api/showcase."""
        past = (date.today() - timedelta(days=5)).isoformat()
        payload = {"title": "TEST_ past", "active": True, "end_date": past}
        r = requests.post(f"{BASE_URL}/api/admin/showcase", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 201
        sid = r.json()["id"]
        TestAdminShowcaseCRUD.created_ids.append(sid)
        pub = requests.get(f"{BASE_URL}/api/showcase", timeout=15).json()
        assert sid not in [c["id"] for c in pub]

    def test_no_dates_visible_when_active(self, admin_headers):
        payload = {"title": "TEST_ nodates", "active": True}
        r = requests.post(f"{BASE_URL}/api/admin/showcase", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 201
        sid = r.json()["id"]
        TestAdminShowcaseCRUD.created_ids.append(sid)
        pub = requests.get(f"{BASE_URL}/api/showcase", timeout=15).json()
        assert sid in [c["id"] for c in pub]

    def test_reorder(self, admin_headers):
        # create two more cards to reorder
        ids = []
        for i in range(2):
            r = requests.post(
                f"{BASE_URL}/api/admin/showcase",
                headers=admin_headers,
                json={"title": f"TEST_ order {i}", "active": True},
                timeout=15,
            )
            assert r.status_code == 201
            ids.append(r.json()["id"])
        TestAdminShowcaseCRUD.created_ids.extend(ids)

        reversed_ids = list(reversed(ids))
        r = requests.post(
            f"{BASE_URL}/api/admin/showcase/order",
            headers=admin_headers,
            json={"ids": reversed_ids},
            timeout=15,
        )
        assert r.status_code == 200

        # Check that order was applied
        all_cards = requests.get(f"{BASE_URL}/api/admin/showcase", headers=admin_headers, timeout=15).json()
        by_id = {c["id"]: c for c in all_cards}
        assert by_id[reversed_ids[0]]["order"] < by_id[reversed_ids[1]]["order"]

    def test_delete_and_verify_404(self, admin_headers):
        # cleanup all created ids
        for sid in TestAdminShowcaseCRUD.created_ids:
            r = requests.delete(f"{BASE_URL}/api/admin/showcase/{sid}", headers=admin_headers, timeout=15)
            assert r.status_code == 200
        # verify last one is 404
        if TestAdminShowcaseCRUD.created_ids:
            sid = TestAdminShowcaseCRUD.created_ids[-1]
            r = requests.get(f"{BASE_URL}/api/admin/showcase/{sid}", headers=admin_headers, timeout=15)
            assert r.status_code == 404


# -------- Permissions --------
class TestShowcasePermissions:
    def test_no_auth_forbidden(self):
        r = requests.get(f"{BASE_URL}/api/admin/showcase", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_listener_forbidden(self, listener_token):
        headers = {"Authorization": f"Bearer {listener_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/showcase", headers=headers, timeout=15)
        assert r.status_code == 403, f"expected 403 for listener, got {r.status_code}: {r.text}"

        r2 = requests.post(
            f"{BASE_URL}/api/admin/showcase",
            headers={**headers, "Content-Type": "application/json"},
            json={"title": "hack"},
            timeout=15,
        )
        assert r2.status_code == 403


# -------- Regression: News still works --------
class TestNewsRegression:
    def test_public_news(self):
        r = requests.get(f"{BASE_URL}/api/news", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_news(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/news", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
