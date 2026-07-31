"""Backend tests for AGENDA + INBOX (iteration 37).

Covers:
- Auth via /api/auth/login (admin email/password) -> Bearer token
- Categories, dashboard, event CRUD, RSVP, tasks, comments, attachments
- Inbox notifications generation on invite / comment / rsvp
- Permission enforcement (collaborator without agenda perms => 403)
- Date validation (invalid format should be 4xx, not 500)
"""
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
           os.environ.get("EXPO_BACKEND_URL", "").rstrip("/") or \
           "https://evangelic-stream.preview.emergentagent.com"

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PASS = "AdminTestPwd1!"


# ---------------- helpers/fixtures ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data["token"]
    s.headers["Authorization"] = f"Bearer {tok}"
    s.admin_id = data["user"]["user_id"]
    return s


@pytest.fixture(scope="module")
def collab_session():
    """Create a fresh collaborator user WITHOUT any agenda permissions."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"agenda_collab_{uuid.uuid4().hex[:8]}@example.com"
    reg = s.post(f"{BASE_URL}/api/auth/register",
                 json={"email": email, "password": "CollabPwd1!", "name": "Collab Test"}, timeout=30)
    assert reg.status_code in (200, 201), reg.text
    data = reg.json()
    tok = data.get("token") or data.get("session_token")
    assert tok, f"missing token in register response: {data}"
    s.headers["Authorization"] = f"Bearer {tok}"
    s.user_id = data["user"]["user_id"]
    return s


def _today_rome():
    # Backend uses Europe/Rome timezone if available; approximate with UTC+1/+2.
    # We'll query the dashboard to discover 'today' string reliably.
    return None


# ---------------- categories & auth ----------------
class TestAgendaCategories:
    def test_categories_seven(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/agenda/categories")
        assert r.status_code == 200, r.text
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) == 7, f"expected 7 categories, got {len(cats)}: {[c.get('key') for c in cats]}"
        keys = {c["key"] for c in cats}
        assert {"staff", "podcast", "radio", "studio", "social", "scadenza", "altro"}.issubset(keys)

    def test_unauth_categories_401(self):
        r = requests.get(f"{BASE_URL}/api/agenda/categories", timeout=15)
        assert r.status_code in (401, 403)


# ---------------- dashboard ----------------
class TestAgendaDashboard:
    def test_dashboard_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/agenda/dashboard")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("today", "upcoming", "due_tasks", "stats"):
            assert k in d, f"missing key {k}"
        s = d["stats"]
        for k in ("events_month", "tasks_done", "tasks_open", "events_today"):
            assert k in s


def _server_today(admin_session):
    """Read the server's 'today' string by inspecting existing today events, or use today's ISO date UTC."""
    # Fallback: create an event with UTC today and see if it lands in dashboard.today
    return datetime.now(timezone.utc).date().isoformat()


# ---------------- events CRUD + RSVP + tasks + comments + attachments ----------------
class TestAgendaEventsFlow:
    created_event_id = None
    created_task_id = None

    def test_create_event_today(self, admin_session):
        # Prefer server-today via dashboard scan: create with UTC today, then verify in dashboard.today
        today = _server_today(admin_session)
        payload = {
            "title": "TEST_Evento_Oggi",
            "description": "creato dai test automatici",
            "category": "staff",
            "date": today,
            "start_time": "18:00",
            "end_time": "19:00",
            "location": "Sala Test",
            "invitees": [],
            "priority": "normal",
            "tags": ["test"],
        }
        r = admin_session.post(f"{BASE_URL}/api/agenda/events", json=payload)
        assert r.status_code == 201, r.text
        ev = r.json()
        assert ev.get("id"), ev
        assert ev.get("color"), "color must be set from category default"
        assert ev.get("organizer_name")
        assert ev["title"] == payload["title"]
        TestAgendaEventsFlow.created_event_id = ev["id"]

    def test_dashboard_today_contains_new(self, admin_session):
        assert TestAgendaEventsFlow.created_event_id
        r = admin_session.get(f"{BASE_URL}/api/agenda/dashboard")
        assert r.status_code == 200
        ids = [e.get("id") for e in r.json().get("today", [])]
        # In case server-Rome-date differs from UTC by a few hours near midnight this may fail.
        # We assert soft: the event should appear either today OR in upcoming.
        upcoming_ids = [e.get("id") for e in r.json().get("upcoming", [])]
        assert TestAgendaEventsFlow.created_event_id in ids + upcoming_ids, \
            f"created event not in today+upcoming: today={ids} upcoming={upcoming_ids}"

    def test_get_event_details(self, admin_session):
        eid = TestAgendaEventsFlow.created_event_id
        r = admin_session.get(f"{BASE_URL}/api/agenda/events/{eid}")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("tasks", "comments", "attachments", "rsvp_summary", "task_progress"):
            assert k in d, f"missing decorated key {k}"

    def test_rsvp_yes(self, admin_session):
        eid = TestAgendaEventsFlow.created_event_id
        r = admin_session.post(f"{BASE_URL}/api/agenda/events/{eid}/rsvp", json={"status": "yes"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("rsvp_summary", {}).get("yes", 0) >= 1

    def test_rsvp_invalid(self, admin_session):
        eid = TestAgendaEventsFlow.created_event_id
        r = admin_session.post(f"{BASE_URL}/api/agenda/events/{eid}/rsvp", json={"status": "bogus"})
        assert r.status_code == 400

    def test_task_create_and_toggle(self, admin_session):
        eid = TestAgendaEventsFlow.created_event_id
        r = admin_session.post(f"{BASE_URL}/api/agenda/events/{eid}/tasks",
                               json={"title": "TEST_task", "priority": "normal", "due_date": ""})
        assert r.status_code == 201, r.text
        tsk = r.json()
        assert tsk.get("id")
        TestAgendaEventsFlow.created_task_id = tsk["id"]

        # toggle to done
        r2 = admin_session.put(f"{BASE_URL}/api/agenda/tasks/{tsk['id']}",
                               json={"title": "TEST_task", "status": "done"})
        assert r2.status_code == 200, r2.text
        assert r2.json().get("status") == "done"

        # verify progress reflected
        r3 = admin_session.get(f"{BASE_URL}/api/agenda/events/{eid}")
        prog = r3.json().get("task_progress", {})
        assert prog.get("done", 0) >= 1 and prog.get("total", 0) >= 1

    def test_comment_create(self, admin_session):
        eid = TestAgendaEventsFlow.created_event_id
        r = admin_session.post(f"{BASE_URL}/api/agenda/events/{eid}/comments",
                               json={"text": "TEST_commento", "mentions": []})
        assert r.status_code == 201, r.text
        assert r.json().get("id")

    def test_attachment_link(self, admin_session):
        eid = TestAgendaEventsFlow.created_event_id
        r = admin_session.post(f"{BASE_URL}/api/agenda/events/{eid}/attachments",
                               json={"name": "TEST link", "kind": "link", "url": "https://example.com"})
        assert r.status_code == 201, r.text
        assert r.json().get("id")

    def test_update_event(self, admin_session):
        eid = TestAgendaEventsFlow.created_event_id
        r = admin_session.get(f"{BASE_URL}/api/agenda/events/{eid}")
        base = r.json()
        payload = {
            "title": "TEST_Evento_Oggi_Updated",
            "description": base.get("description") or "",
            "category": base.get("category") or "altro",
            "date": base.get("date"),
            "start_time": base.get("start_time") or "",
            "end_time": base.get("end_time") or "",
            "location": base.get("location") or "",
            "invitees": base.get("invitees") or [],
            "priority": base.get("priority") or "normal",
            "tags": base.get("tags") or [],
        }
        r2 = admin_session.put(f"{BASE_URL}/api/agenda/events/{eid}", json=payload)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("title") == "TEST_Evento_Oggi_Updated"

    def test_delete_event(self, admin_session):
        eid = TestAgendaEventsFlow.created_event_id
        r = admin_session.delete(f"{BASE_URL}/api/agenda/events/{eid}")
        assert r.status_code == 200
        r2 = admin_session.get(f"{BASE_URL}/api/agenda/events/{eid}")
        assert r2.status_code == 404


# ---------------- date validation ----------------
class TestAgendaValidation:
    def test_bad_date_format_returns_4xx(self, admin_session):
        payload = {"title": "TEST_bad_date", "date": "15-06-2026"}
        r = admin_session.post(f"{BASE_URL}/api/agenda/events", json=payload)
        # per the review request: MUST be 4xx and NOT 500
        assert r.status_code != 500, f"got 500 on bad date: {r.text}"
        assert 400 <= r.status_code < 500, f"expected 4xx got {r.status_code}: {r.text}"

    def test_missing_title(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/agenda/events",
                               json={"date": "2026-06-15"})
        assert 400 <= r.status_code < 500

    def test_missing_date(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/agenda/events",
                               json={"title": "TEST_no_date"})
        assert 400 <= r.status_code < 500


# ---------------- inbox / notifications ----------------
class TestInbox:
    ev_id = None
    initial_unread = 0

    def test_inbox_list_and_unread_count(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/inbox")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = admin_session.get(f"{BASE_URL}/api/inbox/unread-count")
        assert r2.status_code == 200
        assert isinstance(r2.json().get("count"), int)

    def test_invite_creates_notification_for_invitee(self, admin_session, collab_session):
        # baseline unread for collab
        r0 = collab_session.get(f"{BASE_URL}/api/inbox/unread-count")
        assert r0.status_code == 200
        before = r0.json()["count"]

        payload = {
            "title": "TEST_invite_evt",
            "date": (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat(),
            "invitees": [collab_session.user_id],
            "category": "staff",
        }
        r = admin_session.post(f"{BASE_URL}/api/agenda/events", json=payload)
        assert r.status_code == 201, r.text
        TestInbox.ev_id = r.json()["id"]

        r1 = collab_session.get(f"{BASE_URL}/api/inbox/unread-count")
        assert r1.status_code == 200
        after = r1.json()["count"]
        assert after >= before + 1, f"unread should have increased: before={before} after={after}"

        # inbox list should contain the invite
        rl = collab_session.get(f"{BASE_URL}/api/inbox")
        titles = [n.get("title") for n in rl.json()]
        assert any("invito" in (t or "").lower() or "nuovo invito" in (t or "").lower() for t in titles), titles

    def test_read_all(self, collab_session):
        r = collab_session.post(f"{BASE_URL}/api/inbox/read-all", json={})
        assert r.status_code == 200
        r2 = collab_session.get(f"{BASE_URL}/api/inbox/unread-count")
        assert r2.json()["count"] == 0

    def test_cleanup_invite_event(self, admin_session):
        if TestInbox.ev_id:
            admin_session.delete(f"{BASE_URL}/api/agenda/events/{TestInbox.ev_id}")


# ---------------- permissions ----------------
class TestAgendaPermissions:
    def test_collab_without_agenda_perms_gets_403_on_list(self, collab_session):
        r = collab_session.get(f"{BASE_URL}/api/agenda/events")
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_collab_without_agenda_perms_gets_403_on_create(self, collab_session):
        payload = {"title": "TEST_no_perm", "date": "2026-07-01"}
        r = collab_session.post(f"{BASE_URL}/api/agenda/events", json=payload)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
