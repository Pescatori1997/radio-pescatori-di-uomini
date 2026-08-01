"""Supporter status derived from a live Stripe subscription (source of truth = DB
synced with Stripe). Verifies the badge state across the whole subscription
lifecycle without needing a real Stripe checkout (we drive the subscriptions
collection the same way the webhook / sync would)."""
import asyncio
from datetime import datetime, timedelta, timezone

import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE = "http://localhost:8001/api"
UID = "user_supptest001"
TOKEN = "SUPPTESTTOKEN999"
NOW = lambda: datetime.now(timezone.utc)


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


async def _seed_user():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    await db.users.update_one(
        {"user_id": UID},
        {"$set": {"user_id": UID, "email": "supp@test.it", "name": "Supporter Test",
                  "role": "listener", "status": "active", "created_at": NOW()}},
        upsert=True)
    await db.user_sessions.update_one(
        {"session_token": TOKEN},
        {"$set": {"session_token": TOKEN, "user_id": UID, "created_at": NOW(),
                  "expires_at": NOW() + timedelta(days=7)}}, upsert=True)
    await db.subscriptions.delete_many({"user_id": UID})
    client.close()


async def _set_sub(**fields):
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    doc = {"user_id": UID, "stripe_subscription_id": "sub_test_none",
           "stripe_customer_id": None, "plan": "10", "updated_at": NOW()}
    doc.update(fields)
    await db.subscriptions.update_one({"user_id": UID}, {"$set": doc}, upsert=True)
    client.close()


async def _clear_sub():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    await db.subscriptions.delete_many({"user_id": UID})
    client.close()


def _me():
    return requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {TOKEN}"}).json()


def setup_module(_):
    _run(_seed_user())


# --- 1. user WITHOUT subscription -> not a supporter ---
def test_no_subscription():
    _run(_clear_sub())
    me = _me()
    assert me["is_supporter"] is False
    assert me.get("subscription") is None


# --- 3. active subscription -> supporter ---
def test_active_subscription():
    _run(_set_sub(status="active", cancel_at_period_end=False,
                  current_period_end=NOW() + timedelta(days=25)))
    me = _me()
    assert me["is_supporter"] is True
    assert me["subscription"]["status"] == "active"
    assert me["subscription"]["plan"] == "10"


# --- 5. cancel at period end but still within paid period -> KEEP supporter ---
def test_cancel_at_period_end_keeps_benefits():
    _run(_set_sub(status="active", cancel_at_period_end=True,
                  current_period_end=NOW() + timedelta(days=10)))
    me = _me()
    assert me["is_supporter"] is True
    assert me["subscription"]["cancel_at_period_end"] is True


# --- 6. definitively canceled -> supporter removed ---
def test_canceled_removes_supporter():
    _run(_set_sub(status="canceled", cancel_at_period_end=True,
                  current_period_end=NOW() - timedelta(days=1)))
    assert _me()["is_supporter"] is False


# --- 4. renewal succeeded (active, new future period) -> stays supporter ---
def test_renewal_keeps_supporter():
    _run(_set_sub(status="active", cancel_at_period_end=False,
                  current_period_end=NOW() + timedelta(days=30)))
    assert _me()["is_supporter"] is True


# --- 7. payment failed (past_due): grace until period end, then removed ---
def test_past_due_grace_then_expired():
    _run(_set_sub(status="past_due", current_period_end=NOW() + timedelta(days=3)))
    assert _me()["is_supporter"] is True  # grace
    _run(_set_sub(status="past_due", current_period_end=NOW() - timedelta(days=1)))
    assert _me()["is_supporter"] is False  # expired


# --- 8. reactivation (new active sub) -> supporter again ---
def test_reactivation():
    _run(_set_sub(status="canceled", current_period_end=NOW() - timedelta(days=2)))
    assert _me()["is_supporter"] is False
    _run(_set_sub(status="active", cancel_at_period_end=False,
                  current_period_end=NOW() + timedelta(days=30)))
    assert _me()["is_supporter"] is True


# --- 9/10. logout/login & other device: state comes from server DB, not client ---
def test_state_is_server_side_not_client():
    _run(_set_sub(status="active", cancel_at_period_end=False,
                  current_period_end=NOW() + timedelta(days=15)))
    # A brand-new "device" == a fresh request with only the bearer token.
    me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {TOKEN}"}).json()
    assert me["is_supporter"] is True
    # /me/subscription endpoint returns the authoritative state too.
    sub = requests.get(f"{BASE}/me/subscription", headers={"Authorization": f"Bearer {TOKEN}"}).json()
    assert sub["is_supporter"] is True


# --- 6/SECURITY. client cannot fake supporter: no sub in DB => always false ---
def test_client_cannot_fake_supporter():
    _run(_clear_sub())
    # Even if the client sends is_supporter in a body/header, /auth/me ignores it.
    me = requests.get(
        f"{BASE}/auth/me",
        headers={"Authorization": f"Bearer {TOKEN}", "X-Is-Supporter": "true"},
    ).json()
    assert me["is_supporter"] is False
    sub = requests.get(f"{BASE}/me/subscription",
                       headers={"Authorization": f"Bearer {TOKEN}"}).json()
    assert sub["is_supporter"] is False


# --- /me/subscription requires auth ---
def test_subscription_requires_auth():
    r = requests.get(f"{BASE}/me/subscription")
    assert r.status_code == 401
