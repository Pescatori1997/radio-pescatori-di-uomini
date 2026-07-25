"""E2E tests for the Contact page data-binding bugfix.

- GET /api/settings (public) should include the new `website` field along with
  contact_email/contact_phone/whatsapp/address/facebook/instagram/youtube.
- PUT /api/admin/settings should update those fields and the values must be
  reflected immediately in the public GET /api/settings response.
- POST /api/contact should keep working (contact form on /contact page).
"""
import os
import uuid
import requests
import pytest


def _load_base_url():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        # Fallback: parse frontend/.env
        try:
            with open("/app/frontend/.env", "r") as fh:
                for line in fh:
                    line = line.strip()
                    if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith("EXPO_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    if not url:
        raise RuntimeError("EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL not configured")
    return url.rstrip("/")


BASE_URL = _load_base_url()
ADMIN_TOKEN = "ADMINTESTTOKEN123"

# Unique tag so we can assert the value was actually persisted per run.
_TAG = uuid.uuid4().hex[:8]

PAYLOAD = {
    "contact_email": f"test-{_TAG}@pescatoridiuomini.it",
    "contact_phone": f"+39 333 000 {_TAG[:4]}",
    "whatsapp": f"+39 349 111 {_TAG[:4]}",
    "address": f"Via Test {_TAG}, Roma",
    "website": f"https://pescatori-{_TAG}.example.com",
    "facebook": f"https://facebook.com/pdu-{_TAG}",
    "instagram": f"https://instagram.com/pdu-{_TAG}",
    "youtube": f"https://youtube.com/@pdu-{_TAG}",
}

# Fields left blank to verify conditional rendering on the FE (values that
# should NOT be present after we clear them).
CLEARED_PAYLOAD = {
    "facebook": "",
    "instagram": "",
    "youtube": "",
    "website": "",
    "whatsapp": "",
}


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}


# ---- Public GET /api/settings ----
class TestPublicSettings:
    def test_get_public_settings_returns_dict_with_website_key_after_seed(self, api, admin_headers):
        # Ensure `website` key exists by first PUTting a value.
        put = api.put(f"{BASE_URL}/api/admin/settings", json={"website": PAYLOAD["website"]}, headers=admin_headers)
        assert put.status_code == 200, put.text
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        assert "website" in data, "Public GET /api/settings must include `website` field"
        assert data["website"] == PAYLOAD["website"]

    def test_public_settings_no_mongo_id(self, api):
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        assert "_id" not in r.json()


# ---- E2E Admin PUT -> Public GET sync ----
class TestAdminToPublicSync:
    def test_put_all_contact_fields_and_verify_public(self, api, admin_headers):
        put = api.put(f"{BASE_URL}/api/admin/settings", json=PAYLOAD, headers=admin_headers)
        assert put.status_code == 200, put.text
        body = put.json()
        # Admin PUT response should also echo the saved values.
        for k, v in PAYLOAD.items():
            assert body.get(k) == v, f"Admin PUT response mismatch for {k}: got {body.get(k)!r}"

        # Now the public endpoint MUST reflect immediately.
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        pub = r.json()
        for k, v in PAYLOAD.items():
            assert pub.get(k) == v, f"Public /api/settings mismatch for {k}: got {pub.get(k)!r}"

    def test_clearing_social_fields_persists_empty_string(self, api, admin_headers):
        put = api.put(f"{BASE_URL}/api/admin/settings", json=CLEARED_PAYLOAD, headers=admin_headers)
        assert put.status_code == 200, put.text
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        pub = r.json()
        for k in CLEARED_PAYLOAD:
            assert pub.get(k, "") == "", f"Field {k} should be cleared, got {pub.get(k)!r}"

    def test_restore_full_payload_for_frontend_tests(self, api, admin_headers):
        """Restore populated values (used by subsequent FE playwright run)."""
        put = api.put(f"{BASE_URL}/api/admin/settings", json=PAYLOAD, headers=admin_headers)
        assert put.status_code == 200
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        for k, v in PAYLOAD.items():
            assert r.json().get(k) == v


# ---- Contact form ----
class TestContactForm:
    def test_post_contact_success(self, api):
        payload = {
            "name": f"TEST_User_{_TAG}",
            "email": f"test-{_TAG}@example.com",
            "message": f"Automated test message {_TAG}",
        }
        r = api.post(f"{BASE_URL}/api/contact", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True

    def test_post_contact_missing_field_returns_422(self, api):
        r = api.post(f"{BASE_URL}/api/contact", json={"name": "x"})
        assert r.status_code in (400, 422)


# ---- Admin auth guard ----
class TestAdminGuard:
    def test_admin_settings_requires_admin(self, api):
        r = api.put(f"{BASE_URL}/api/admin/settings", json={"website": "x"})
        assert r.status_code in (401, 403)
