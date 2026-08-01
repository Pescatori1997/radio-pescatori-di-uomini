"""Analytics & community social-proof — end-to-end backend tests.
Covers: activity/online tracking (registered only), content view/play dedup,
radio session start/beat/stop + live listener count, public aggregated endpoints,
admin dashboard, and privacy/authorization (no admin data leak to normal users)."""
import asyncio
from datetime import datetime, timedelta, timezone

import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE = "http://localhost:8001/api"
NOW = lambda: datetime.now(timezone.utc)
U_UID, U_TOK = "user_an_normal", "ANTOKNORMAL01"
A_UID, A_TOK = "user_an_admin", "ANTOKADMIN01"


def _run(c):
    return asyncio.new_event_loop().run_until_complete(c)


async def _seed():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["test_database"]
    for uid, email, role in [(U_UID, "an.normal@test.it", "listener"),
                             (A_UID, "an.admin@test.it", "administrator")]:
        await db.users.update_one({"user_id": uid}, {"$set": {
            "user_id": uid, "email": email, "name": "AN " + role, "role": role,
            "status": "active", "created_at": NOW()}}, upsert=True)
    for tok, uid in [(U_TOK, U_UID), (A_TOK, A_UID)]:
        await db.user_sessions.update_one({"session_token": tok}, {"$set": {
            "session_token": tok, "user_id": uid, "created_at": NOW(),
            "expires_at": NOW() + timedelta(days=7)}}, upsert=True)
    # clean prior test artifacts
    await db.radio_sessions.delete_many({"user_id": {"$in": [U_UID, A_UID]}})
    await db.content_views.delete_many({"user_id": {"$in": [U_UID, A_UID]}})
    await db.analytics_daily_active.delete_many({"user_id": {"$in": [U_UID, A_UID]}})
    db.client.close()


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def setup_module(_):
    _run(_seed())


# --- 2/3. activity marks the user active & online; guests are ignored ---
def test_active_and_online():
    assert requests.post(f"{BASE}/track/active", headers=_h(U_TOK)).status_code == 200
    stats = requests.get(f"{BASE}/community/stats").json()
    assert stats["members"] >= 2
    # online reflects recent activity (cache is 60s; the count is >=1 registered user)
    an = requests.get(f"{BASE}/admin/analytics", headers=_h(A_TOK)).json()
    assert an["users"]["online_now"] >= 1
    assert an["users"]["active_today"] >= 1
    # guest ping must not error and must not count
    assert requests.post(f"{BASE}/track/active").status_code == 200


# --- 5/9. content view/play dedup: refresh doesn't double count ---
def test_content_dedup():
    for _ in range(3):  # simulate refresh x3
        requests.post(f"{BASE}/track/content", headers=_h(U_TOK),
                      json={"kind": "meditation", "id": "med_test_1", "action": "view"})
    cs = requests.get(f"{BASE}/content/stats", params={"kind": "meditation", "id": "med_test_1"}).json()
    assert cs["views"] == 1  # deduped per user
    # a play by the same user is a distinct action
    requests.post(f"{BASE}/track/content", headers=_h(U_TOK),
                  json={"kind": "podcast", "id": "pod_1", "action": "play"})
    requests.post(f"{BASE}/track/content", headers=_h(U_TOK),
                  json={"kind": "podcast", "id": "pod_1", "action": "play"})
    cs2 = requests.get(f"{BASE}/content/stats", params={"kind": "podcast", "id": "pod_1"}).json()
    assert cs2["plays"] == 1
    # guests are not counted
    requests.post(f"{BASE}/track/content", json={"kind": "meditation", "id": "med_test_1", "action": "view"})
    cs3 = requests.get(f"{BASE}/content/stats", params={"kind": "meditation", "id": "med_test_1"}).json()
    assert cs3["views"] == 1


# --- 4/8/12. radio session: start (reuse on refresh), beat, live count, stop ---
def test_radio_session_lifecycle():
    r1 = requests.post(f"{BASE}/track/radio/start", headers=_h(U_TOK)).json()
    sid = r1["session_id"]
    assert sid
    # refresh -> start again reuses the SAME open session (no double count)
    r2 = requests.post(f"{BASE}/track/radio/start", headers=_h(U_TOK)).json()
    assert r2["session_id"] == sid
    listeners = requests.get(f"{BASE}/community/radio-listeners").json()
    assert listeners["listening"] >= 1
    requests.post(f"{BASE}/track/radio/beat", headers=_h(U_TOK), json={"session_id": sid})
    # stop -> no longer a current listener
    requests.post(f"{BASE}/track/radio/stop", headers=_h(U_TOK), json={"session_id": sid})
    # cache is 10s; verify via admin (uncached) that it's not counted as current
    an = requests.get(f"{BASE}/admin/analytics", headers=_h(A_TOK)).json()
    assert an["radio"]["current"] == 0
    assert an["radio"]["unique_today"] >= 1
    # guest cannot open a session
    assert requests.post(f"{BASE}/track/radio/start").json()["session_id"] is None


# --- 1. admin dashboard has the expected shape & real numbers ---
def test_admin_dashboard_shape():
    an = requests.get(f"{BASE}/admin/analytics?range=30", headers=_h(A_TOK)).json()
    for k in ("users", "registrations_series", "active_series", "radio", "content", "community"):
        assert k in an
    assert an["users"]["total"] >= 2
    assert isinstance(an["registrations_series"], list)
    assert "meditations" in an["content"] and "podcasts" in an["content"]


# --- 10. PRIVACY / AUTHZ: a normal user cannot access the admin dashboard ---
def test_admin_requires_admin():
    r = requests.get(f"{BASE}/admin/analytics", headers=_h(U_TOK))
    assert r.status_code == 403
    assert requests.get(f"{BASE}/admin/analytics").status_code == 401


# --- 10. public endpoints expose ONLY aggregates (no user identifiers) ---
def test_public_endpoints_are_aggregated():
    stats = requests.get(f"{BASE}/community/stats").json()
    assert set(stats.keys()) <= {"members", "active_today", "new_this_week", "online_now"}
    for forbidden in ("users", "emails", "names", "ip", "ids"):
        assert forbidden not in stats
