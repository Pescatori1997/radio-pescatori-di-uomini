"""Analytics & community social-proof — modular, additive, reuse-first.

Design principles (per product spec):
- REGISTERED users only for community/active/online stats (no anonymous IDs).
- "active" = a real action (app foreground / section / radio listen / content open).
- "online now" = registered user active in the last 5 minutes.
- Radio listener counted ONLY while audio is really playing (session + heartbeat).
- No invented data: everything derives from really-collected events. Metrics that
  can't be reconstructed start from implementation time; historical registrations
  come from the existing users.created_at.
- Performance: throttled writes (client debounce + server per-day dedup),
  in-memory TTL caches for public endpoints, TTL index to bound event growth.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import time

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api")

# Injected from server.py to avoid a circular import (same pattern as timoteo).
_d: dict = {}


def init(*, db, get_current_user, require_admin, now_utc, new_id, live_status, logger):
    _d.update(db=db, get_current_user=get_current_user, require_admin=require_admin,
              now_utc=now_utc, new_id=new_id, live_status=live_status, logger=logger)


async def ensure_indexes():
    try:
        db = _d["db"]
        await db.users.create_index("last_active_at")
        await db.analytics_daily_active.create_index("day")
        await db.radio_sessions.create_index("last_beat")
        await db.radio_sessions.create_index([("user_id", 1), ("ended_at", 1)])
        await db.radio_sessions.create_index("started_at")
        await db.content_views.create_index([("content_kind", 1), ("content_id", 1)])
        # Bound growth: expire raw radio sessions after 120 days.
        await db.radio_sessions.create_index("started_at", expireAfterSeconds=120 * 86400,
                                             name="radio_ttl")
    except Exception as e:  # index may already exist with different opts
        _d.get("logger") and _d["logger"].warning("analytics index setup: %s", e)


# ---- dependency wrappers (delegate to the injected server dependencies) ----
async def _admin(authorization: Optional[str] = Header(None)):
    return await _d["require_admin"](authorization)


async def _user(authorization: Optional[str] = Header(None)):
    return await _d["get_current_user"](authorization)


async def _user_optional(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    try:
        return await _d["get_current_user"](authorization)
    except Exception:
        return None


# ---------------- helpers ----------------
def _now():
    return _d["now_utc"]()


def _aw(dt):
    """Normalize a value read from Mongo (naive UTC) or ISO string to tz-aware UTC."""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except Exception:
            return None
    if isinstance(dt, datetime) and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _day_str(dt: datetime) -> str:
    return _aw(dt).astimezone(timezone.utc).strftime("%Y-%m-%d")


# tiny in-memory TTL cache for public endpoints (per-worker; fine for social proof)
_cache: dict = {}


def _cache_get(key):
    v = _cache.get(key)
    if v and v[0] > time.time():
        return v[1]
    return None


def _cache_set(key, value, ttl):
    _cache[key] = (time.time() + ttl, value)


# =========================================================================
# TRACKING (writes) — all require an authenticated (registered) user
# =========================================================================
async def mark_active(user: dict):
    """Record activity for a registered user. Cheap: updates last_active_at every
    call (client already debounces to ~60s) and writes ONE daily-active marker per
    day per user (only on the first activity of the day)."""
    if not user:
        return
    db, now = _d["db"], _now()
    uid = user["user_id"]
    la = user.get("last_active_at")
    if isinstance(la, str):
        try:
            la = datetime.fromisoformat(la)
        except Exception:
            la = None
    need_daily = not (la and _day_str(la) == _day_str(now))
    await db.users.update_one({"user_id": uid}, {"$set": {"last_active_at": now}})
    if need_daily:
        day = _day_str(now)
        await db.analytics_daily_active.update_one(
            {"_id": f"{uid}:{day}"},
            {"$setOnInsert": {"user_id": uid, "day": day, "at": now}}, upsert=True)


@router.post("/track/active")
async def track_active(user=Depends(_user_optional)):
    """Lightweight activity ping (app foreground / section change). Guests ignored."""
    if user:
        await mark_active(user)
    return {"ok": True}


class ContentTrackIn(BaseModel):
    kind: str          # meditation | podcast | news
    id: str
    action: str = "view"  # view | play


@router.post("/track/content")
async def track_content(body: ContentTrackIn, user=Depends(_user_optional)):
    """Dedup per (kind,id,user,action) so refresh/back-forward never double count.
    Only registered users are counted (no anonymous tracking)."""
    if not user:
        return {"ok": True, "counted": False}
    db, now = _d["db"], _now()
    uid = user["user_id"]
    action = "play" if body.action == "play" else "view"
    _id = f"{body.kind}:{body.id}:{action}:{uid}"
    res = await db.content_views.update_one(
        {"_id": _id},
        {"$setOnInsert": {"content_kind": body.kind, "content_id": body.id,
                          "action": action, "user_id": uid, "first_at": now}},
        upsert=True)
    await mark_active(user)
    return {"ok": True, "counted": bool(res.upserted_id)}


class RadioSessionIn(BaseModel):
    session_id: Optional[str] = None


@router.post("/track/radio/start")
async def radio_start(user=Depends(_user_optional)):
    """Start (or resume) a real listening session. Reuses a still-open session for
    the same user (refresh-safe) to avoid inflating listener counts."""
    if not user:
        return {"session_id": None}
    db, now = _d["db"], _now()
    uid = user["user_id"]
    open_sess = await db.radio_sessions.find_one(
        {"user_id": uid, "ended_at": None, "last_beat": {"$gt": now - timedelta(seconds=90)}})
    if open_sess:
        await db.radio_sessions.update_one({"id": open_sess["id"]}, {"$set": {"last_beat": now}})
        await mark_active(user)
        return {"session_id": open_sess["id"]}
    sid = _d["new_id"]("rs")
    await db.radio_sessions.insert_one({
        "id": sid, "user_id": uid, "started_at": now, "last_beat": now,
        "ended_at": None, "seconds": 0})
    await mark_active(user)
    return {"session_id": sid}


@router.post("/track/radio/beat")
async def radio_beat(body: RadioSessionIn, user=Depends(_user_optional)):
    if not user or not body.session_id:
        return {"ok": True}
    db, now = _d["db"], _now()
    sess = await db.radio_sessions.find_one({"id": body.session_id, "user_id": user["user_id"]})
    if sess and sess.get("ended_at") is None:
        delta = (now - _aw(sess["last_beat"])).total_seconds()
        inc = delta if 0 < delta <= 120 else 0  # ignore gaps > 2min (was paused/away)
        await db.radio_sessions.update_one(
            {"id": body.session_id}, {"$set": {"last_beat": now}, "$inc": {"seconds": inc}})
        await mark_active(user)
    return {"ok": True}


@router.post("/track/radio/stop")
async def radio_stop(body: RadioSessionIn, user=Depends(_user_optional)):
    if not user or not body.session_id:
        return {"ok": True}
    db, now = _d["db"], _now()
    await db.radio_sessions.update_one(
        {"id": body.session_id, "user_id": user["user_id"], "ended_at": None},
        {"$set": {"ended_at": now}})
    return {"ok": True}


# =========================================================================
# PUBLIC (aggregated only — never expose names/emails/IPs/individual data)
# =========================================================================
async def _members_and_active():
    db, now = _d["db"], _now()
    members = await db.users.count_documents({})
    active_today = await db.users.count_documents({"last_active_at": {"$gte": _start_of_day(now)}})
    week_ago = now - timedelta(days=7)
    new_week = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    online = await db.users.count_documents({"last_active_at": {"$gte": now - timedelta(minutes=5)}})
    return {"members": members, "active_today": active_today,
            "new_this_week": new_week, "online_now": online}


def _start_of_day(now: datetime) -> datetime:
    return now.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/community/stats")
async def community_stats():
    """Public, aggregated community indicators for the Home. Cached 60s."""
    cached = _cache_get("community")
    if cached:
        return cached
    data = await _members_and_active()
    _cache_set("community", data, 60)
    return data


async def _live_registered_listeners() -> int:
    db, now = _d["db"], _now()
    return await db.radio_sessions.count_documents(
        {"ended_at": None, "last_beat": {"$gt": now - timedelta(seconds=90)}})


@router.get("/community/radio-listeners")
async def radio_listeners():
    """Public: how many REGISTERED users are really listening right now. Cached 10s."""
    cached = _cache_get("radio_listeners")
    if cached is not None:
        return cached
    count = await _live_registered_listeners()
    data = {"listening": count}
    _cache_set("radio_listeners", data, 10)
    return data


@router.get("/content/stats")
async def content_stats(kind: str = Query(...), id: str = Query(...)):
    """Public aggregated social-proof for one content item. Cached 60s."""
    ck = f"cs:{kind}:{id}"
    cached = _cache_get(ck)
    if cached:
        return cached
    db = _d["db"]
    views = await db.content_views.count_documents({"content_kind": kind, "content_id": id, "action": "view"})
    plays = await db.content_views.count_documents({"content_kind": kind, "content_id": id, "action": "play"})
    data = {"views": views, "plays": plays}
    _cache_set(ck, data, 60)
    return data


# =========================================================================
# ADMIN dashboard (protected by the existing admin authorization)
# =========================================================================
def _range_days(rng: str) -> Optional[int]:
    return {"7": 7, "30": 30, "90": 90, "all": None}.get(rng, 30)


async def _registrations_series(days: Optional[int]):
    """Daily new registrations from users.created_at (real, historical)."""
    db, now = _d["db"], _now()
    match = {}
    if days:
        match = {"created_at": {"$gte": _start_of_day(now) - timedelta(days=days - 1)}}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d",
                    "date": {"$toDate": "$created_at"}}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    try:
        rows = await db.users.aggregate(pipeline).to_list(2000)
    except Exception:
        rows = []
    return [{"date": r["_id"], "count": r["count"]} for r in rows if r.get("_id")]


async def _active_series(days: Optional[int]):
    """Daily distinct active users from the daily-active markers (from now on)."""
    db, now = _d["db"], _now()
    match = {}
    if days:
        match = {"day": {"$gte": _day_str(now - timedelta(days=days - 1))}}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    try:
        rows = await db.analytics_daily_active.aggregate(pipeline).to_list(2000)
    except Exception:
        rows = []
    return [{"date": r["_id"], "count": r["count"]} for r in rows]


async def _radio_admin(days: Optional[int]):
    db, now = _d["db"], _now()
    since = None if not days else (_start_of_day(now) - timedelta(days=days - 1))
    q = {} if since is None else {"started_at": {"$gte": since}}
    sessions = await db.radio_sessions.find(q, {"_id": 0, "started_at": 1, "ended_at": 1,
                                                "seconds": 1, "user_id": 1, "last_beat": 1}).to_list(20000)
    total_seconds = sum(s.get("seconds") or 0 for s in sessions)
    n = len(sessions)
    unique_range = len({s["user_id"] for s in sessions})
    sod = _start_of_day(now)
    unique_today = len({s["user_id"] for s in sessions
                        if _aw(s["started_at"]) >= sod})
    # Peak concurrent via sweep-line over (start,+1),(end,-1).
    pts = []
    for s in sessions:
        st = _aw(s["started_at"])
        en = _aw(s.get("ended_at") or s.get("last_beat") or s["started_at"])
        pts.append((st, 1))
        pts.append((en, -1))
    pts.sort(key=lambda x: (x[0], -x[1]))
    cur = peak = 0
    for _, delta in pts:
        cur += delta
        peak = max(peak, cur)
    return {
        "current": await _live_registered_listeners(),
        "stream_listeners": await _stream_listeners(),
        "unique_today": unique_today,
        "unique_range": unique_range,
        "peak_concurrent": peak,
        "avg_minutes": round((total_seconds / n) / 60, 1) if n else 0,
        "total_hours": round(total_seconds / 3600, 1),
        "sessions": n,
    }


async def _stream_listeners():
    try:
        st = await _d["live_status"]()
        return st.get("listeners")
    except Exception:
        return None


async def _content_admin(days: Optional[int]):
    db, now = _d["db"], _now()
    since = None if not days else (_start_of_day(now) - timedelta(days=days - 1))
    base = {} if since is None else {"first_at": {"$gte": since}}

    async def top(kind: str, action: str, limit=5):
        q = {**base, "content_kind": kind, "action": action}
        pipeline = [
            {"$match": q},
            {"$group": {"_id": "$content_id", "unique": {"$sum": 1}}},
            {"$sort": {"unique": -1}}, {"$limit": limit},
        ]
        rows = await db.content_views.aggregate(pipeline).to_list(limit)
        out = []
        coll = {"meditation": "meditations", "podcast": "podcasts", "news": "news"}.get(kind)
        for r in rows:
            title = r["_id"]
            if coll:
                doc = await db[coll].find_one({"id": r["_id"]}, {"_id": 0, "title": 1})
                if doc and doc.get("title"):
                    title = doc["title"]
            out.append({"id": r["_id"], "title": title, "count": r["unique"]})
        return out

    med_views = await db.content_views.count_documents({**base, "content_kind": "meditation", "action": "view"})
    med_users = len(await db.content_views.distinct("user_id", {**base, "content_kind": "meditation"}))
    pod_plays = await db.content_views.count_documents({**base, "content_kind": "podcast", "action": "play"})
    pod_users = len(await db.content_views.distinct("user_id", {**base, "content_kind": "podcast"}))
    return {
        "meditations": {"views": med_views, "unique_users": med_users,
                        "top": await top("meditation", "view")},
        "podcasts": {"plays": pod_plays, "unique_users": pod_users,
                     "top": await top("podcast", "play")},
    }


async def _users_admin():
    db, now = _d["db"], _now()
    sod = _start_of_day(now)
    total = await db.users.count_documents({})
    new_today = await db.users.count_documents({"created_at": {"$gte": sod}})
    new_7 = await db.users.count_documents({"created_at": {"$gte": now - timedelta(days=7)}})
    new_30 = await db.users.count_documents({"created_at": {"$gte": now - timedelta(days=30)}})
    prev_30 = await db.users.count_documents(
        {"created_at": {"$gte": now - timedelta(days=60), "$lt": now - timedelta(days=30)}})
    growth = round(((new_30 - prev_30) / prev_30) * 100, 1) if prev_30 else None
    active_today = await db.users.count_documents({"last_active_at": {"$gte": sod}})
    active_7 = len(await db.analytics_daily_active.distinct(
        "user_id", {"day": {"$gte": _day_str(now - timedelta(days=7))}}))
    active_30 = len(await db.analytics_daily_active.distinct(
        "user_id", {"day": {"$gte": _day_str(now - timedelta(days=30))}}))
    online = await db.users.count_documents({"last_active_at": {"$gte": now - timedelta(minutes=5)}})
    return {
        "total": total, "new_today": new_today, "new_7": new_7, "new_30": new_30,
        "growth_30_pct": growth, "active_today": active_today, "active_7": active_7,
        "active_30": active_30, "online_now": online,
    }


async def _community_admin():
    db = _d["db"]
    prayers = await db.prayer_requests.count_documents({})
    amen_cur = db.prayer_requests.aggregate([{"$group": {"_id": None, "t": {"$sum": "$praying_count"}}}])
    amen_rows = await amen_cur.to_list(1)
    amen = (amen_rows[0]["t"] if amen_rows else 0) or 0
    testimonies = await db.messages.count_documents({"type": "testimony"})
    messages = await db.messages.count_documents({"type": "message"})
    return {"prayer_requests": prayers, "amen_total": amen,
            "testimonies": testimonies, "messages": messages}


@router.get("/admin/analytics")
async def admin_analytics(range: str = Query("30"), admin=Depends(_admin)):
    days = _range_days(range)
    return {
        "range": range,
        "users": await _users_admin(),
        "registrations_series": await _registrations_series(days),
        "active_series": await _active_series(days),
        "radio": await _radio_admin(days),
        "content": await _content_admin(days),
        "community": await _community_admin(),
    }
