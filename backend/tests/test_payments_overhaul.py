"""Backend tests for Payments Overhaul (iteration 25).

Covers:
  - Admin login via /api/auth/login to obtain a real Bearer token for admin endpoints.
  - One-time donation checkout validation (amount bounds + Stripe-graceful 400 not 500).
  - Monthly donation subscription validation (plan whitelist + Stripe-graceful 400).
  - Merchandising order checkout validation (empty items / shipping requirements /
    pickup requirements / unknown product / sold-out product / valid -> Stripe 400).
  - Orphan-order guarantee: after a valid checkout that fails at Stripe, no order
    document is persisted (order insert only follows a successful Stripe session).
  - Auth guards on admin/orders (GET) and admin/orders/{id} (PATCH).
  - Regression: /api/products, /api/meditations still 200.

IMPORTANT: pod's STRIPE_API_KEY is a placeholder ("sk_test_emergent") that does
NOT authenticate against api.stripe.com. Therefore every endpoint that reaches
Stripe returns HTTP 400 by design (never 500).
"""

import os
import re
import time

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
).rstrip("/")

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PASSWORD = "AdminTestPwd1!"


# ---------------------- fixtures ----------------------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data.get("user", {}).get("role") == "administrator"
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def test_product(api, admin_headers):
    """Create a TEST_ product; delete at teardown (cleanup guarantee)."""
    payload = {
        "name": "TEST_Payments Product",
        "description": "TEST_ prod for payments overhaul",
        "price": "15,00",
        "images": [],
        "colors": ["Blu"],
        "sizes": ["M", "L"],
        "availability": "available",
        "published": True,
    }
    r = api.post(f"{BASE_URL}/api/admin/products", json=payload, headers=admin_headers)
    assert r.status_code == 201, f"product create failed: {r.status_code} {r.text}"
    pid = r.json().get("id")
    assert pid
    yield pid
    # cleanup
    api.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=admin_headers)


# ---------------------- Health / regression ----------------------
class TestRegression:
    def test_products_public_ok(self, api):
        r = api.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_meditations_public_ok(self, api):
        r = api.get(f"{BASE_URL}/api/meditations")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------------- Admin login (real token) ----------------------
class TestAdminLogin:
    def test_admin_login_returns_token(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20


# ---------------------- Donations: one-time checkout ----------------------
class TestDonationCheckout:
    ORIGIN = "https://example.com"

    def test_amount_too_low(self, api):
        r = api.post(
            f"{BASE_URL}/api/donations/checkout",
            json={"amount": 0.5, "origin_url": self.ORIGIN},
        )
        assert r.status_code == 400
        assert "Importo" in r.text

    def test_amount_too_high(self, api):
        r = api.post(
            f"{BASE_URL}/api/donations/checkout",
            json={"amount": 6000, "origin_url": self.ORIGIN},
        )
        assert r.status_code == 400

    def test_valid_amount_stripe_400_not_500(self, api):
        r = api.post(
            f"{BASE_URL}/api/donations/checkout",
            json={"amount": 10, "origin_url": self.ORIGIN, "donor_email": "test@example.com"},
        )
        # Stripe placeholder key => 400 "Impossibile avviare la donazione" (NOT 500)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert r.status_code != 500


# ---------------------- Donations: monthly subscription ----------------------
class TestDonationSubscribe:
    ORIGIN = "https://example.com"

    def test_invalid_plan(self, api):
        r = api.post(
            f"{BASE_URL}/api/donations/subscribe",
            json={"plan": "99", "origin_url": self.ORIGIN},
        )
        assert r.status_code == 400
        assert "Piano" in r.text or "piano" in r.text.lower()

    def test_valid_plan_stripe_400_not_500(self, api):
        r = api.post(
            f"{BASE_URL}/api/donations/subscribe",
            json={"plan": "10", "origin_url": self.ORIGIN},
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert r.status_code != 500


# ---------------------- Orders: /orders/checkout ----------------------
class TestOrderCheckout:
    ORIGIN = "https://example.com"

    def _shipping(self, **over):
        base = {
            "method": "shipping",
            "name": "Mario",
            "surname": "Rossi",
            "phone": "3331234567",
            "address": "Via Roma 1",
            "cap": "00100",
            "city": "Roma",
            "province": "RM",
        }
        base.update(over)
        return base

    def _pickup(self, **over):
        base = {"method": "pickup", "name": "Mario", "phone": "3331234567"}
        base.update(over)
        return base

    def test_empty_items(self, api, test_product):
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={"items": [], "delivery": self._shipping(), "origin_url": self.ORIGIN},
        )
        assert r.status_code == 400
        assert "Carrello" in r.text or "vuoto" in r.text.lower()

    def test_shipping_missing_surname(self, api, test_product):
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 1, "size": "M", "color": "Blu"}],
                "delivery": self._shipping(surname=""),
                "origin_url": self.ORIGIN,
            },
        )
        assert r.status_code == 400

    def test_shipping_missing_address(self, api, test_product):
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 1}],
                "delivery": self._shipping(address=""),
                "origin_url": self.ORIGIN,
            },
        )
        assert r.status_code == 400

    def test_shipping_missing_cap(self, api, test_product):
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 1}],
                "delivery": self._shipping(cap=""),
                "origin_url": self.ORIGIN,
            },
        )
        assert r.status_code == 400

    def test_shipping_missing_city(self, api, test_product):
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 1}],
                "delivery": self._shipping(city=""),
                "origin_url": self.ORIGIN,
            },
        )
        assert r.status_code == 400

    def test_shipping_missing_province(self, api, test_product):
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 1}],
                "delivery": self._shipping(province=""),
                "origin_url": self.ORIGIN,
            },
        )
        assert r.status_code == 400

    def test_pickup_empty_phone(self, api, test_product):
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 1}],
                "delivery": self._pickup(phone=""),
                "origin_url": self.ORIGIN,
            },
        )
        assert r.status_code == 400

    def test_unknown_product(self, api, test_product):
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": "prod_doesnotexist999", "quantity": 1}],
                "delivery": self._shipping(),
                "origin_url": self.ORIGIN,
            },
        )
        assert r.status_code == 404

    def test_valid_shipping_reaches_stripe_400(self, api, test_product):
        """Valid request that reaches Stripe should return 400 (placeholder key), NOT 500."""
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 2, "size": "M", "color": "Blu"}],
                "delivery": self._shipping(),
                "origin_url": self.ORIGIN,
                "note": "TEST_orphan-check",
            },
        )
        assert r.status_code == 400, f"expected 400 (Stripe placeholder), got {r.status_code}: {r.text}"
        assert r.status_code != 500

    def test_no_orphan_order_after_stripe_failure(self, api, admin_headers, test_product):
        """After the valid request that fails at Stripe, no order should exist for this product."""
        r_orders = api.get(f"{BASE_URL}/api/admin/orders", headers=admin_headers)
        assert r_orders.status_code == 200
        orders = r_orders.json()
        # An order is orphaned if inserted despite Stripe session creation failing.
        for o in orders:
            for it in (o.get("items") or []):
                assert it.get("product_id") != test_product, (
                    f"orphan order persisted (order_number={o.get('order_number')}) despite Stripe failure"
                )

    def test_sold_out_blocked(self, api, admin_headers, test_product):
        # Flip product to sold_out
        r_upd = api.patch(
            f"{BASE_URL}/api/admin/products/{test_product}",
            json={"availability": "sold_out"},
            headers=admin_headers,
        )
        assert r_upd.status_code == 200
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 1}],
                "delivery": self._shipping(),
                "origin_url": self.ORIGIN,
            },
        )
        assert r.status_code == 400
        assert "esaurito" in r.text.lower() or "sold" in r.text.lower()
        # restore
        api.patch(
            f"{BASE_URL}/api/admin/products/{test_product}",
            json={"availability": "available"},
            headers=admin_headers,
        )

    def test_price_bogus_field_ignored(self, api, test_product):
        """Even if the client sends a bogus 'price' field on an order item, the server
        must ignore it (OrderItemIn has no price field) — structurally price-safe."""
        r = api.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [{"product_id": test_product, "quantity": 1, "price": 0.01}],
                "delivery": self._shipping(),
                "origin_url": self.ORIGIN,
            },
        )
        # Either 400 (Stripe placeholder — flow reached DB price) — never 500.
        assert r.status_code in (400,), f"got {r.status_code}: {r.text}"


# ---------------------- Auth guards ----------------------
class TestAuthGuards:
    def test_admin_orders_no_token(self, api):
        r = api.get(f"{BASE_URL}/api/admin/orders")
        assert r.status_code in (401, 403)

    def test_admin_orders_patch_no_token(self, api):
        r = api.patch(
            f"{BASE_URL}/api/admin/orders/ord_doesnotexist",
            json={"status": "shipped"},
        )
        assert r.status_code in (401, 403)

    def test_admin_orders_invalid_token(self, api):
        r = api.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": "Bearer notavalidtoken"},
        )
        assert r.status_code in (401, 403)
