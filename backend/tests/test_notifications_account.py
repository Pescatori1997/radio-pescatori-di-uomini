"""
Tests for the Notifications & Account extras block (iteration 17).

Covers:
  - POST /api/auth/forgot-password  (fallback code path)
  - POST /api/auth/reset-password   (invalid/short/valid code)
  - POST /api/auth/change-password  (wrong/short/correct)
  - PUT  /api/auth/profile          (updates name)
  - GET/PUT /api/me/notifications   (7 categories, persistence)
  - POST /api/register-push         (graceful failure with placeholder key)
  - POST /api/admin/notifications/send (validation + admin gate + log record)
  - GET  /api/admin/notifications        (delivery log)
  - GET  /api/admin/notifications/audience (respects opted-out users)
  - Auto-notifications on content creation (podcast/meditation/news/live)
  - /api/admin/stats includes 'notifications'
"""
from __future__ import annotations

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be defined in the environment"
BASE_URL = BASE_URL.rstrip("/")

ADMIN_TOKEN = "ADMINTESTTOKEN123"
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
CATEGORIES = ["podcasts", "meditations", "news", "live", "announcements", "events", "prayers"]


# ---------- Shared fixtures ----------
@pytest.fixture(scope="session")
def notif_user():
    """Register a fresh test user with a known password.

    Returns dict {email, password, token, user_id}. Uses a random suffix
    so the test suite is idempotent (does not collide with earlier runs).
    """
    email = f"TEST_notif_{uuid.uuid4().hex[:10]}@example.com"
    password = "Reset1234!"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": password, "name": "TEST Notif"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "email": email,
        "password": password,
        "token": data["token"],
        "user_id": data["user"]["user_id"],
    }


def _bearer(token: str):
    return {"Authorization": f"Bearer {token}"}


# =====================================================================
# 1) Password reset flow: forgot-password + reset-password
# =====================================================================
class TestPasswordReset:
    def test_forgot_password_unknown_email_no_code(self):
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password",
                          json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com"})
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["delivered"] is False
        assert "code" not in body, "Unknown email must NOT leak a reset code"

    def test_forgot_password_known_returns_fallback_code(self, notif_user):
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": notif_user["email"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["delivered"] is False, "EMERGENT_EMAIL_KEY is empty in dev, so delivered=False"
        assert "code" in body and len(body["code"]) == 6, "Fallback should expose a 6-digit code"
        notif_user["reset_code"] = body["code"]

    def test_reset_password_wrong_code(self, notif_user):
        r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                          json={"email": notif_user["email"],
                                "code": "000000",
                                "new_password": "NewPassw0rd!"})
        assert r.status_code == 400
        assert "Codice non valido" in r.json().get("detail", "")

    def test_reset_password_short_password(self, notif_user):
        # Need a fresh code because the previous test may have consumed it (it did not, wrong code)
        assert notif_user.get("reset_code"), "requires known code from previous test"
        r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                          json={"email": notif_user["email"],
                                "code": notif_user["reset_code"],
                                "new_password": "abc"})
        assert r.status_code == 400
        assert "6" in r.json().get("detail", "")

    def test_reset_password_success_and_invalidates_sessions(self, notif_user):
        new_password = "Brandnew123!"
        r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                          json={"email": notif_user["email"],
                                "code": notif_user["reset_code"],
                                "new_password": new_password})
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        # Old session token should now be invalid
        r2 = requests.get(f"{BASE_URL}/api/me/notifications", headers=_bearer(notif_user["token"]))
        assert r2.status_code == 401, "Session should be invalidated after reset-password"
        # New password should log in
        r3 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": notif_user["email"], "password": new_password})
        assert r3.status_code == 200, r3.text
        notif_user["password"] = new_password
        notif_user["token"] = r3.json()["token"]


# =====================================================================
# 2) change-password (auth required)
# =====================================================================
class TestChangePassword:
    def test_wrong_current_password(self, notif_user):
        r = requests.post(f"{BASE_URL}/api/auth/change-password",
                          headers=_bearer(notif_user["token"]),
                          json={"current_password": "wrong-pass", "new_password": "AnotherPwd1!"})
        assert r.status_code == 400
        assert "Password attuale non corretta" in r.json().get("detail", "")

    def test_short_new_password(self, notif_user):
        r = requests.post(f"{BASE_URL}/api/auth/change-password",
                          headers=_bearer(notif_user["token"]),
                          json={"current_password": notif_user["password"], "new_password": "ab"})
        assert r.status_code == 400

    def test_success(self, notif_user):
        new_pw = "Chang3d!23"
        r = requests.post(f"{BASE_URL}/api/auth/change-password",
                          headers=_bearer(notif_user["token"]),
                          json={"current_password": notif_user["password"], "new_password": new_pw})
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        # Session must still be valid (only reset-password invalidates)
        r2 = requests.get(f"{BASE_URL}/api/me/notifications", headers=_bearer(notif_user["token"]))
        assert r2.status_code == 200
        # And the new password logs in
        r3 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": notif_user["email"], "password": new_pw})
        assert r3.status_code == 200
        notif_user["password"] = new_pw
        notif_user["token"] = r3.json()["token"]

    def test_change_password_unauth(self):
        r = requests.post(f"{BASE_URL}/api/auth/change-password",
                          json={"current_password": "x", "new_password": "Somepwd123"})
        assert r.status_code == 401


# =====================================================================
# 3) PUT /api/auth/profile
# =====================================================================
class TestUpdateProfile:
    def test_update_name(self, notif_user):
        new_name = f"TEST Renamed {uuid.uuid4().hex[:4]}"
        r = requests.put(f"{BASE_URL}/api/auth/profile",
                         headers=_bearer(notif_user["token"]),
                         json={"name": new_name})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == new_name
        # Backend normalizes emails to lowercase at register-time
        assert data["email"] == notif_user["email"].lower()

    def test_profile_unauth(self):
        r = requests.put(f"{BASE_URL}/api/auth/profile", json={"name": "hacker"})
        assert r.status_code == 401


# =====================================================================
# 4) Notification preferences
# =====================================================================
class TestNotifPrefs:
    def test_defaults_are_all_true(self, notif_user):
        r = requests.get(f"{BASE_URL}/api/me/notifications", headers=_bearer(notif_user["token"]))
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == set(CATEGORIES)
        for c in CATEGORIES:
            assert body[c] is True, f"category {c} should default to True"

    def test_put_persists(self, notif_user):
        payload = {c: True for c in CATEGORIES}
        payload["news"] = False
        payload["prayers"] = False
        r = requests.put(f"{BASE_URL}/api/me/notifications",
                         headers=_bearer(notif_user["token"]), json=payload)
        assert r.status_code == 200
        stored = r.json()
        assert stored["news"] is False
        assert stored["prayers"] is False
        # Re-read
        r2 = requests.get(f"{BASE_URL}/api/me/notifications", headers=_bearer(notif_user["token"]))
        assert r2.status_code == 200
        again = r2.json()
        assert again["news"] is False
        assert again["prayers"] is False
        assert again["podcasts"] is True

    def test_prefs_unauth(self):
        assert requests.get(f"{BASE_URL}/api/me/notifications").status_code == 401
        assert requests.put(f"{BASE_URL}/api/me/notifications", json={}).status_code == 401


# =====================================================================
# 5) Push registration relay – placeholder key path must NOT crash
# =====================================================================
class TestRegisterPush:
    def test_placeholder_key_returns_controlled_error(self, notif_user):
        r = requests.post(f"{BASE_URL}/api/register-push",
                          json={"user_id": notif_user["user_id"],
                                "platform": "ios",
                                "device_token": "TEST_dummy_token"})
        # With placeholder key the upstream fails; endpoint must respond
        # with a controlled 500/502 (NEVER a 422 / traceback / crash).
        assert r.status_code in (500, 502, 200, 201), (
            f"register-push must not 422/crash: got {r.status_code} {r.text}")
        if r.status_code >= 400:
            body = r.json()
            assert "detail" in body

    def test_missing_body_is_422_not_crash(self):
        r = requests.post(f"{BASE_URL}/api/register-push", json={})
        # Missing required fields → FastAPI validation 422 is expected here.
        assert r.status_code == 422


# =====================================================================
# 6) Admin: send / list / audience
# =====================================================================
class TestAdminNotifications:
    def test_send_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/notifications/send",
                          json={"category": "announcements", "title": "T", "message": "M"})
        assert r.status_code in (401, 403)

    def test_non_admin_forbidden(self, notif_user):
        r = requests.post(f"{BASE_URL}/api/admin/notifications/send",
                          headers=_bearer(notif_user["token"]),
                          json={"category": "announcements", "title": "T", "message": "M"})
        assert r.status_code == 403

    def test_invalid_category(self):
        r = requests.post(f"{BASE_URL}/api/admin/notifications/send",
                          headers=ADMIN_HEADERS,
                          json={"category": "bogus", "title": "T", "message": "M"})
        assert r.status_code == 400
        assert "Categoria" in r.json().get("detail", "")

    def test_empty_title_or_message(self):
        r1 = requests.post(f"{BASE_URL}/api/admin/notifications/send",
                           headers=ADMIN_HEADERS,
                           json={"category": "announcements", "title": "", "message": "hey"})
        assert r1.status_code == 400
        r2 = requests.post(f"{BASE_URL}/api/admin/notifications/send",
                           headers=ADMIN_HEADERS,
                           json={"category": "announcements", "title": "hey", "message": "   "})
        assert r2.status_code == 400

    def test_send_success_records_failed_log(self):
        title = f"TEST notify {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/admin/notifications/send",
                          headers=ADMIN_HEADERS,
                          json={"category": "announcements", "title": title,
                                "message": "Messaggio di test"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert isinstance(body["recipients"], int) and body["recipients"] >= 0

        # Verify it was persisted in the log with status=failed (placeholder key)
        log = requests.get(f"{BASE_URL}/api/admin/notifications", headers=ADMIN_HEADERS)
        assert log.status_code == 200
        entries = log.json()
        assert isinstance(entries, list)
        found = next((e for e in entries if e.get("title") == title), None)
        assert found is not None, "Notification must be persisted in notifications_log"
        assert found["category"] == "announcements"
        assert found["status"] == "failed", (
            f"With placeholder EMERGENT_PUSH_KEY, status must be 'failed', got {found['status']}")

    def test_audience_counts(self, notif_user):
        # notif_user has news=False, prayers=False (from TestNotifPrefs.test_put_persists)
        r = requests.get(f"{BASE_URL}/api/admin/notifications/audience", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        counts = r.json()
        assert set(counts.keys()) == set(CATEGORIES)
        for c, v in counts.items():
            assert isinstance(v, int) and v >= 0
        # podcasts count should be >= news count (news excluded our user; podcasts not)
        assert counts["podcasts"] >= counts["news"]


# =====================================================================
# 7) Auto push on content creation should NOT break creation
# =====================================================================
class TestAutoNotifications:
    def _log_len(self):
        r = requests.get(f"{BASE_URL}/api/admin/notifications", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        return r.json()

    def _find(self, entries, message, category, title_prefix=None):
        """notify_category stores label as 'title' and content title as 'message'."""
        for e in entries:
            if e.get("category") != category:
                continue
            if e.get("message") != message:
                continue
            if title_prefix and not (e.get("title") or "").startswith(title_prefix):
                continue
            return e
        return None

    def test_create_podcast_logs_new_podcast(self):
        title = f"TEST podcast {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/admin/podcasts", headers=ADMIN_HEADERS,
                          json={"title": title, "category": "Predicazione",
                                "author": "TEST", "audio_url": "https://example.com/a.mp3"})
        assert r.status_code in (200, 201), r.text
        time.sleep(0.5)
        entries = self._log_len()
        rec = self._find(entries, title, "podcasts", title_prefix="Nuovo podcast")
        assert rec is not None, "Podcast creation must create a log entry in category 'podcasts' with label 'Nuovo podcast'"
        assert rec["status"] in ("failed", "sent")

    def test_create_meditation_logs_new_meditation(self):
        title = f"TEST meditazione {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/admin/podcasts", headers=ADMIN_HEADERS,
                          json={"title": title, "category": "Meditazione mattutina",
                                "author": "TEST", "audio_url": "https://example.com/a.mp3"})
        assert r.status_code in (200, 201), r.text
        time.sleep(0.5)
        entries = self._log_len()
        rec = self._find(entries, title, "meditations", title_prefix="Nuova meditazione")
        assert rec is not None, "Category containing 'meditaz' must log under 'meditations' with label 'Nuova meditazione'"

    def test_create_news_published_logs(self):
        title = f"TEST news pub {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/admin/news", headers=ADMIN_HEADERS,
                          json={"title": title, "excerpt": "e", "body": "b", "published": True})
        assert r.status_code in (200, 201), r.text
        time.sleep(0.5)
        entries = self._log_len()
        rec = self._find(entries, title, "news", title_prefix="Nuova notizia")
        assert rec is not None, "Published news must produce a 'news' log entry with label 'Nuova notizia'"

    def test_create_news_draft_does_not_log(self):
        title = f"TEST news draft {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/admin/news", headers=ADMIN_HEADERS,
                          json={"title": title, "excerpt": "e", "body": "b", "published": False})
        assert r.status_code in (200, 201), r.text
        time.sleep(0.3)
        rec = self._find(self._log_len(), title, "news")
        assert rec is None, "Draft news must NOT create a notification log"

    def test_radio_live_start_logs(self):
        # Ensure we start a fresh live cycle
        r = requests.post(f"{BASE_URL}/api/admin/radio/live",
                          headers=ADMIN_HEADERS, json={"action": "start"})
        assert r.status_code in (200, 201), r.text
        time.sleep(0.5)
        entries = self._log_len()
        # We can't assume a unique title; look for the standard live push title in category 'live'
        live_recs = [e for e in entries if e.get("category") == "live"
                     and "diretta" in (e.get("title") or "").lower()]
        assert live_recs, "Live start must produce a 'live' log entry with a diretta title"
        # Cleanup
        requests.post(f"{BASE_URL}/api/admin/radio/live",
                      headers=ADMIN_HEADERS, json={"action": "end"})


# =====================================================================
# 8) admin/stats includes 'notifications'
# =====================================================================
class TestAdminStatsExtension:
    def test_stats_has_notifications_field(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert "notifications" in body, f"admin/stats must include 'notifications', got keys={list(body.keys())}"
        assert isinstance(body["notifications"], int) and body["notifications"] >= 0
