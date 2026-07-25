"""Backend tests for Stripe Donations (test mode via emergentintegrations)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"
ORIGIN = BASE_URL  # any absolute URL is fine for success_url/cancel_url template


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Checkout creation ----------------
class TestDonationCheckout:
    def test_checkout_anonymous_success(self, api):
        r = api.post(f"{BASE_URL}/api/donations/checkout", json={
            "amount": 10, "origin_url": ORIGIN,
            "donor_name": "TEST Ospite", "message": "TEST anonimo",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "session_id" in data
        assert data["url"].startswith("https://checkout.stripe.com/")
        # persist for status test
        pytest.stripe_session_id = data["session_id"]

    def test_checkout_authenticated(self, api):
        r = api.post(f"{BASE_URL}/api/donations/checkout",
                     headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
                     json={"amount": 25.50, "origin_url": ORIGIN})
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("https://checkout.stripe.com/")

    def test_checkout_amount_too_low(self, api):
        r = api.post(f"{BASE_URL}/api/donations/checkout", json={"amount": 0.5, "origin_url": ORIGIN})
        assert r.status_code == 400, r.text
        assert "Importo" in r.json().get("detail", "")

    def test_checkout_amount_too_high(self, api):
        r = api.post(f"{BASE_URL}/api/donations/checkout", json={"amount": 5001, "origin_url": ORIGIN})
        assert r.status_code == 400, r.text

    def test_checkout_amount_zero(self, api):
        r = api.post(f"{BASE_URL}/api/donations/checkout", json={"amount": 0, "origin_url": ORIGIN})
        assert r.status_code == 400, r.text


# ---------------- Status ----------------
class TestDonationStatus:
    def test_status_open_unpaid(self, api):
        sid = getattr(pytest, "stripe_session_id", None)
        if not sid:
            pytest.skip("no session id from previous test")
        r = api.get(f"{BASE_URL}/api/donations/status/{sid}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["session_id"] == sid
        assert data["payment_status"] in ("unpaid", "no_payment_required")
        assert data["status"] in ("open", "complete")
        assert data["currency"] in ("eur", None)


# ---------------- /me/donations ----------------
class TestMyDonations:
    def test_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/me/donations")
        assert r.status_code == 401, r.text

    def test_with_token_returns_list(self, api):
        r = api.get(f"{BASE_URL}/api/me/donations",
                    headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# ---------------- Admin endpoints ----------------
class TestAdminDonations:
    def test_admin_list_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/admin/donations")
        assert r.status_code in (401, 403), r.text

    def test_admin_list_with_admin_token(self, api):
        r = api.get(f"{BASE_URL}/api/admin/donations",
                    headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_admin_stats_shape(self, api):
        r = api.get(f"{BASE_URL}/api/admin/donations/stats",
                    headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "count", "average", "donors", "last_30_days", "currency"):
            assert k in d, f"missing key {k}"
        assert d["currency"] == "eur"
        assert isinstance(d["count"], int)
        assert isinstance(d["total"], (int, float))

    def test_admin_stats_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/admin/donations/stats")
        assert r.status_code in (401, 403), r.text


# ---------------- /api/admin/stats includes donations ----------------
class TestAdminStatsDonationsField:
    def test_donations_field_present(self, api):
        r = api.get(f"{BASE_URL}/api/admin/stats",
                    headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "donations" in d
        assert isinstance(d["donations"], int)
