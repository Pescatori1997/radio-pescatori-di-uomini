"""Merchandising module tests (backend only).

Covers new Product endpoints (public + admin) added for the merch catalog.
Tests are self-cleaning so the products collection ends empty as before.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "ADMINTESTTOKEN123"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


# ---------- helpers ----------
def _register_user():
    """Create a fresh non-admin user; return their bearer token."""
    email = f"TEST_user_{int(time.time()*1000)}@example.com"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Test1234!", "name": "TEST User"
    }, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_token():
    return _register_user()


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # Cleanup - delete any leftover TEST products
    for pid in ids:
        try:
            requests.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=ADMIN_HEADERS, timeout=15)
        except Exception:
            pass
    # Also purge any TEST_ leftovers
    try:
        r = requests.get(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS, timeout=15)
        if r.status_code == 200:
            for p in r.json():
                if (p.get("name") or "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/admin/products/{p['id']}", headers=ADMIN_HEADERS, timeout=15)
    except Exception:
        pass


def _new_product_payload(name="TEST_Prod", **overrides):
    payload = {
        "name": name,
        "description": "TEST short desc",
        "long_description": "TEST long description body",
        "category": "Abbigliamento",
        "price": "€19.90",
        "images": ["https://example.com/a.jpg", "https://example.com/b.jpg"],
        "colors": ["Nero", "Bianco"],
        "sizes": ["S", "M", "L"],
        "availability": "available",
        "featured": False,
        "published": True,
    }
    payload.update(overrides)
    return payload


# ---------- Auth guard ----------
class TestAdminAuthGuard:
    def test_admin_products_requires_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/products", timeout=15)
        assert r.status_code == 401

    def test_admin_products_forbidden_for_non_admin(self, user_token):
        r = requests.get(f"{BASE_URL}/api/admin/products",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=15)
        assert r.status_code == 403

    def test_admin_products_ok_for_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Create + availability validation ----------
class TestCreateProduct:
    def test_create_returns_201_and_id(self, created_ids):
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload("TEST_Create_01"), timeout=15)
        assert r.status_code == 201, r.text
        data = r.json()
        assert "id" in data and data["id"]
        created_ids.append(data["id"])

        # verify persistence via admin GET/{id}
        g = requests.get(f"{BASE_URL}/api/admin/products/{data['id']}", headers=ADMIN_HEADERS, timeout=15)
        assert g.status_code == 200
        prod = g.json()
        assert prod["name"] == "TEST_Create_01"
        assert prod["price"] == "€19.90"
        assert prod["images"] == ["https://example.com/a.jpg", "https://example.com/b.jpg"]
        assert prod["colors"] == ["Nero", "Bianco"]
        assert prod["sizes"] == ["S", "M", "L"]
        assert prod["availability"] == "available"
        assert prod["published"] is True
        assert prod["category"] == "Abbigliamento"

    def test_create_invalid_availability_400(self):
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload("TEST_Bad", availability="in_stock"), timeout=15)
        assert r.status_code == 400

    @pytest.mark.parametrize("val", ["available", "coming_soon", "sold_out"])
    def test_create_valid_availability_persists(self, val, created_ids):
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload(f"TEST_Av_{val}", availability=val), timeout=15)
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        created_ids.append(pid)
        g = requests.get(f"{BASE_URL}/api/admin/products/{pid}", headers=ADMIN_HEADERS, timeout=15).json()
        assert g["availability"] == val


# ---------- PATCH + persistence ----------
class TestPatchProduct:
    def test_patch_updates_and_persists(self, created_ids):
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload("TEST_Patch"), timeout=15)
        pid = r.json()["id"]
        created_ids.append(pid)

        updates = {
            "name": "TEST_Patch_Updated",
            "price": "€25.00",
            "featured": True,
            "published": False,
            "availability": "sold_out",
            "images": ["https://example.com/new.jpg"],
            "colors": ["Rosso"],
            "sizes": ["XL"],
        }
        p = requests.patch(f"{BASE_URL}/api/admin/products/{pid}", headers=ADMIN_HEADERS, json=updates, timeout=15)
        assert p.status_code == 200

        g = requests.get(f"{BASE_URL}/api/admin/products/{pid}", headers=ADMIN_HEADERS, timeout=15).json()
        for k, v in updates.items():
            assert g[k] == v, f"{k}: expected {v} got {g.get(k)}"

    def test_patch_invalid_availability_400(self, created_ids):
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload("TEST_PatchBad"), timeout=15)
        pid = r.json()["id"]
        created_ids.append(pid)
        p = requests.patch(f"{BASE_URL}/api/admin/products/{pid}", headers=ADMIN_HEADERS,
                           json={"availability": "nope"}, timeout=15)
        assert p.status_code == 400


# ---------- DELETE ----------
class TestDeleteProduct:
    def test_delete_removes_product(self):
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload("TEST_ToDelete"), timeout=15)
        pid = r.json()["id"]
        d = requests.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=ADMIN_HEADERS, timeout=15)
        assert d.status_code == 200
        g = requests.get(f"{BASE_URL}/api/admin/products/{pid}", headers=ADMIN_HEADERS, timeout=15)
        assert g.status_code == 404


# ---------- Public endpoints ----------
class TestPublicProducts:
    def test_categories_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/products/categories", timeout=15)
        assert r.status_code == 200
        assert r.json() == ["Tutti", "Abbigliamento", "Cappelli", "Tazze", "Accessori", "Libri", "Altro"]

    def test_public_list_hides_unpublished_and_sorts_featured(self, created_ids):
        # published + featured
        r1 = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                           json=_new_product_payload("TEST_PubFeatured", featured=True, published=True,
                                                     category="Cappelli"), timeout=15)
        pid1 = r1.json()["id"]; created_ids.append(pid1)

        # published, not featured
        r2 = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                           json=_new_product_payload("TEST_PubNormal", featured=False, published=True,
                                                     category="Cappelli"), timeout=15)
        pid2 = r2.json()["id"]; created_ids.append(pid2)

        # unpublished
        r3 = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                           json=_new_product_payload("TEST_Hidden", featured=False, published=False,
                                                     category="Cappelli"), timeout=15)
        pid3 = r3.json()["id"]; created_ids.append(pid3)

        pub = requests.get(f"{BASE_URL}/api/products", timeout=15)
        assert pub.status_code == 200
        items = pub.json()
        ids = [p["id"] for p in items]
        assert pid1 in ids
        assert pid2 in ids
        assert pid3 not in ids, "Unpublished product must not appear publicly"

        # featured first
        idx1 = ids.index(pid1)
        idx2 = ids.index(pid2)
        assert idx1 < idx2, "Featured product should be sorted before non-featured"

    def test_public_search_and_category(self, created_ids):
        unique = f"TEST_UniqZzz_{int(time.time())}"
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload(unique, category="Libri"), timeout=15)
        pid = r.json()["id"]; created_ids.append(pid)

        # search by name
        s = requests.get(f"{BASE_URL}/api/products", params={"search": unique}, timeout=15)
        assert s.status_code == 200
        names = [p["name"] for p in s.json()]
        assert unique in names

        # category filter (Libri) should include our product
        c = requests.get(f"{BASE_URL}/api/products", params={"category": "Libri"}, timeout=15)
        assert c.status_code == 200
        assert any(p["id"] == pid for p in c.json())

        # different category filter should NOT include it
        c2 = requests.get(f"{BASE_URL}/api/products", params={"category": "Tazze"}, timeout=15)
        assert c2.status_code == 200
        assert all(p["id"] != pid for p in c2.json())

    def test_public_detail_and_404(self, created_ids):
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload("TEST_Detail"), timeout=15)
        pid = r.json()["id"]; created_ids.append(pid)
        g = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
        assert g.status_code == 200
        assert g.json()["id"] == pid

        miss = requests.get(f"{BASE_URL}/api/products/prod_doesnotexist123", timeout=15)
        assert miss.status_code == 404


# ---------- Reorder ----------
class TestReorderProducts:
    def test_reorder_sets_order_field(self, created_ids):
        pids = []
        for i in range(3):
            r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                              json=_new_product_payload(f"TEST_Order_{i}", featured=False, published=True,
                                                        category="Accessori"), timeout=15)
            pids.append(r.json()["id"])
            created_ids.append(r.json()["id"])

        # Reverse order
        desired = list(reversed(pids))
        r = requests.post(f"{BASE_URL}/api/admin/products/reorder", headers=ADMIN_HEADERS,
                          json={"ids": desired}, timeout=15)
        assert r.status_code == 200

        # admin list must reflect the new order for our subset
        lst = requests.get(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS, timeout=15).json()
        # filter only our reordered ids in same relative order they appear in list
        appearance = [p["id"] for p in lst if p["id"] in desired]
        assert appearance == desired, f"expected {desired}, got {appearance}"


# ---------- Admin stats ----------
class TestAdminStatsProducts:
    def test_stats_has_numeric_products_field(self, created_ids):
        # Create one to ensure > 0
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=ADMIN_HEADERS,
                          json=_new_product_payload("TEST_Stats"), timeout=15)
        created_ids.append(r.json()["id"])

        s = requests.get(f"{BASE_URL}/api/admin/stats", headers=ADMIN_HEADERS, timeout=15)
        assert s.status_code == 200
        data = s.json()
        assert "products" in data
        assert isinstance(data["products"], int)
        assert data["products"] >= 1
