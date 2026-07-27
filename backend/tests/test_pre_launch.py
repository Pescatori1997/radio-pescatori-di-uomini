"""
Pre-launch verification suite for Pescatori di Uomini (iteration 27).
Covers: AUTH (register/login/logout/session/reset), NOTIFICATIONS (manual send,
audience, log timezone, categories), WEB PUSH endpoints, CMS (sections + public
contents + admin CRUD), MEDIA (podcasts/meditations), RADIO nowplaying,
PRAYERS/MESSAGES, DONATIONS/MERCH checkout error paths, TEAM (public),
ADMIN users/activity/permissions, STABILITY (no 500 on core endpoints).
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PWD = "AdminTestPwd1!"


# ----------------------------- fixtures -----------------------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "administrator"
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def test_user(s):
    """Create a fresh throwaway user and return {email, password, token, user_id}."""
    email = f"testlaunch_{uuid.uuid4().hex[:8]}@pescatoridiuomini.it"
    pwd = "TestPre1234!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "Test Prelaunch"})
    assert r.status_code == 200, r.text
    d = r.json()
    yield {"email": email, "password": pwd, "token": d["token"], "user_id": d["user"]["user_id"]}
    # cleanup
    try:
        s.delete(f"{API}/auth/account", headers={"Authorization": f"Bearer {d['token']}"})
    except Exception:
        pass


# ----------------------------- AUTH -----------------------------
class TestAuth:
    def test_register_login_logout_session(self, s):
        email = f"prel_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "Pass1234!"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "Prelaunch"})
        assert r.status_code == 200
        tok = r.json()["token"]
        # /auth/me
        me = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert me.status_code == 200
        assert me.json()["email"] == email
        # duplicate register -> 400
        r2 = s.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "Dup"})
        assert r2.status_code == 400
        # login
        rl = s.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert rl.status_code == 200
        tok2 = rl.json()["token"]
        # wrong password
        rb = s.post(f"{API}/auth/login", json={"email": email, "password": "WRONG"})
        assert rb.status_code == 401
        # logout
        rlo = s.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {tok2}"})
        assert rlo.status_code == 200
        # cleanup
        s.delete(f"{API}/auth/account", headers={"Authorization": f"Bearer {tok}"})

    def test_admin_login_grants_role(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "administrator"

    def test_forgot_and_reset_password_flow(self, s):
        # Create user
        email = f"reset_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "OldPass123!"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "Reset"})
        tok = r.json()["token"]
        # request reset — key empty so code exposed in response
        rf = s.post(f"{API}/auth/forgot-password", json={"email": email})
        assert rf.status_code == 200
        j = rf.json()
        assert j["ok"] is True
        assert j["delivered"] is False
        assert "code" in j and len(j["code"]) == 6
        code = j["code"]
        # unknown email — must still return 200 (no enumeration)
        r_unk = s.post(f"{API}/auth/forgot-password", json={"email": "unknown@nowhere.tld"})
        assert r_unk.status_code == 200
        assert r_unk.json()["ok"] is True
        # wrong code -> 400
        rw = s.post(f"{API}/auth/reset-password", json={"email": email, "code": "000000", "new_password": "NewPass1"})
        assert rw.status_code == 400
        # short password -> 400
        rs = s.post(f"{API}/auth/reset-password", json={"email": email, "code": code, "new_password": "12"})
        assert rs.status_code == 400
        # correct
        newpwd = "NewPass456!"
        ro = s.post(f"{API}/auth/reset-password", json={"email": email, "code": code, "new_password": newpwd})
        assert ro.status_code == 200
        # old pwd fails
        rll = s.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert rll.status_code == 401
        # new pwd works
        rgg = s.post(f"{API}/auth/login", json={"email": email, "password": newpwd})
        assert rgg.status_code == 200
        # cleanup
        s.delete(f"{API}/auth/account", headers={"Authorization": f"Bearer {rgg.json()['token']}"})


# ----------------------------- NOTIFICATIONS -----------------------------
class TestNotifications:
    def test_admin_audience(self, s, admin_headers):
        r = s.get(f"{API}/admin/notifications/audience", headers=admin_headers)
        assert r.status_code == 200
        aud = r.json()
        for c in ["announcements", "podcasts", "meditations", "news", "live", "events", "prayers"]:
            assert c in aud
            assert isinstance(aud[c], int)

    def test_admin_send_notification_success(self, s, admin_headers):
        title = f"TEST_ Notifica {uuid.uuid4().hex[:6]}"
        body = {"category": "announcements", "title": title, "message": "TEST message"}
        r = s.post(f"{API}/admin/notifications/send", headers=admin_headers, json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert isinstance(j["recipients"], int)
        # verify it appears in log
        rl = s.get(f"{API}/admin/notifications", headers=admin_headers)
        assert rl.status_code == 200
        titles = [n["title"] for n in rl.json()]
        assert title in titles

    def test_admin_send_notification_invalid_category(self, s, admin_headers):
        r = s.post(f"{API}/admin/notifications/send", headers=admin_headers,
                   json={"category": "nope", "title": "x", "message": "y"})
        assert r.status_code == 400

    def test_admin_send_notification_missing_content(self, s, admin_headers):
        r = s.post(f"{API}/admin/notifications/send", headers=admin_headers,
                   json={"category": "announcements", "title": "  ", "message": ""})
        assert r.status_code == 400

    def test_admin_notifications_requires_auth(self, s):
        r = s.get(f"{API}/admin/notifications")
        assert r.status_code == 401

    def test_admin_notifications_log_timezone_offset(self, s, admin_headers):
        """Recent fix: created_at must be serialized WITH UTC offset (+00:00 or Z)."""
        # send one first to guarantee a row
        s.post(f"{API}/admin/notifications/send", headers=admin_headers,
               json={"category": "announcements", "title": f"TEST_ tz {uuid.uuid4().hex[:6]}", "message": "tz check"})
        r = s.get(f"{API}/admin/notifications", headers=admin_headers)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) > 0
        ca = docs[0].get("created_at", "")
        assert isinstance(ca, str)
        assert ca.endswith("+00:00") or ca.endswith("Z") or "+00:00" in ca, (
            f"created_at must include UTC offset, got: {ca}"
        )
        # sanity: parseable ISO
        datetime.fromisoformat(ca.replace("Z", "+00:00"))

    def test_user_notification_prefs_get_and_set(self, s, test_user):
        h = {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}
        r = s.get(f"{API}/me/notifications", headers=h)
        assert r.status_code == 200
        prefs = r.json()
        # default all true
        assert all(isinstance(v, bool) for v in prefs.values())
        # patch off news
        prefs["news"] = False
        r2 = s.put(f"{API}/me/notifications", headers=h, json=prefs)
        assert r2.status_code == 200
        assert r2.json()["news"] is False
        # verify GET
        r3 = s.get(f"{API}/me/notifications", headers=h)
        assert r3.json()["news"] is False


# ----------------------------- WEB PUSH -----------------------------
class TestWebPush:
    def test_public_key(self, s):
        r = s.get(f"{API}/webpush/public-key")
        assert r.status_code == 200
        j = r.json()
        assert "public_key" in j and len(j["public_key"]) > 20

    def test_subscribe_and_unsubscribe(self, s):
        sub = {
            "endpoint": f"https://fake.push.example/{uuid.uuid4().hex}",
            "keys": {"p256dh": "BABC" + "A" * 84, "auth": "AAAA" + "A" * 20},
        }
        payload = {"subscription": sub}
        r = s.post(f"{API}/webpush/subscribe", json=payload)
        assert r.status_code in (200, 201), r.text
        # dedup: same subscription again should be idempotent
        r2 = s.post(f"{API}/webpush/subscribe", json=payload)
        assert r2.status_code in (200, 201)
        # unsubscribe
        r3 = s.post(f"{API}/webpush/unsubscribe", json=payload)
        assert r3.status_code == 200

    def test_subscribe_invalid(self, s):
        # missing endpoint/keys entirely
        r = s.post(f"{API}/webpush/subscribe", json={"subscription": {}})
        assert r.status_code in (400, 422)


# ----------------------------- CMS -----------------------------
class TestCMS:
    def test_content_sections(self, s):
        r = s.get(f"{API}/content-sections")
        assert r.status_code == 200
        sections = r.json()
        assert len(sections) == 6
        keys = [x["key"] for x in sections]
        assert "studi-biblici" in keys

    def test_studi_biblici_seeds(self, s):
        r = s.get(f"{API}/contents", params={"section": "studi-biblici"})
        assert r.status_code == 200
        items = r.json()
        titles = [i["title"] for i in items]
        assert "Il Sermone sul Monte" in titles
        assert "La Fede di Abramo" in titles

    def test_admin_content_crud(self, s, admin_headers):
        payload = {
            "section": "studi-biblici",
            "title": f"TEST_ Prelaunch {uuid.uuid4().hex[:6]}",
            "description": "test desc",
            "visibility": "public",
            "status": "draft",
        }
        r = s.post(f"{API}/admin/contents", headers=admin_headers, json=payload)
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]
        # not public while draft
        r_pub = s.get(f"{API}/contents", params={"section": "studi-biblici"})
        assert payload["title"] not in [i["title"] for i in r_pub.json()]
        # publish
        rp = s.patch(f"{API}/admin/contents/{cid}", headers=admin_headers, json={"status": "published"})
        assert rp.status_code == 200
        # now visible
        r_pub2 = s.get(f"{API}/contents", params={"section": "studi-biblici"})
        assert payload["title"] in [i["title"] for i in r_pub2.json()]
        # delete
        rd = s.delete(f"{API}/admin/contents/{cid}", headers=admin_headers)
        assert rd.status_code == 200


# ----------------------------- MEDIA + PUBLIC -----------------------------
class TestPublicMedia:
    def test_podcasts(self, s):
        r = s.get(f"{API}/podcasts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_meditations(self, s):
        r = s.get(f"{API}/meditations")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_radio_nowplaying(self, s):
        # Backend exposes now-playing via /api/live/status (proxy to AzuraCast)
        r = s.get(f"{API}/live/status")
        assert r.status_code == 200, r.text
        j = r.json()
        assert "stream_url" in j
        assert "title" in j

    def test_products_list(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_team_crew_public(self, s):
        r = s.get(f"{API}/crew")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ----------------------------- PRAYERS & MESSAGES -----------------------------
class TestPrayersMessages:
    def test_submit_prayer(self, s):
        r = s.post(f"{API}/prayer-requests", json={
            "name": "TEST_ Prelaunch",
            "text": "Preghiamo per la app",
            "anonymous": False,
        })
        assert r.status_code in (200, 201), r.text

    def test_submit_message(self, s):
        r = s.post(f"{API}/messages", json={
            "name": "TEST_ Prelaunch",
            "text": "Ciao dallo staff",
            "type": "message",
        })
        assert r.status_code in (200, 201), r.text


# ----------------------------- DONATIONS / MERCH -----------------------------
class TestPayments:
    ORIGIN = "https://evangelic-stream.preview.emergentagent.com"

    def test_donations_checkout_bad_amount(self, s):
        r = s.post(f"{API}/donations/checkout",
                   json={"amount": 0.5, "currency": "eur", "origin_url": self.ORIGIN})
        assert r.status_code == 400
        r2 = s.post(f"{API}/donations/checkout",
                    json={"amount": 6000, "currency": "eur", "origin_url": self.ORIGIN})
        assert r2.status_code == 400

    def test_donations_checkout_valid_amount_reaches_stripe(self, s):
        """In preview STRIPE_API_KEY is placeholder → expect 400 (not 500)."""
        r = s.post(f"{API}/donations/checkout",
                   json={"amount": 10, "currency": "eur", "origin_url": self.ORIGIN})
        assert r.status_code in (200, 400), r.text
        assert r.status_code != 500

    def test_orders_checkout_empty_cart(self, s):
        r = s.post(f"{API}/orders/checkout",
                   json={"items": [], "delivery_mode": "pickup", "phone": "3331112222",
                         "origin_url": self.ORIGIN})
        # Business validation returns 400 (empty cart) — 422 (schema) also acceptable
        assert r.status_code in (400, 422), r.text


# ----------------------------- ADMIN GENERAL -----------------------------
class TestAdmin:
    def test_admin_stats(self, s, admin_headers):
        r = s.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200

    def test_admin_users_list(self, s, admin_headers):
        r = s.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_activity(self, s, admin_headers):
        r = s.get(f"{API}/admin/activity", headers=admin_headers)
        assert r.status_code == 200

    def test_admin_requires_auth(self, s):
        for ep in ("/admin/stats", "/admin/users", "/admin/notifications"):
            r = s.get(f"{API}{ep}")
            assert r.status_code == 401


# ----------------------------- STABILITY / SMOKE -----------------------------
class TestStability:
    def test_no_500_on_public_endpoints(self, s):
        for ep in ["/content-sections", "/podcasts", "/meditations", "/products",
                   "/crew", "/contents?section=studi-biblici"]:
            r = s.get(f"{API}{ep}")
            assert r.status_code < 500, f"{ep} -> {r.status_code}"
