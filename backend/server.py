from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Request
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
from bson.binary import Binary
from pymongo import ReturnDocument
import os
import re
import json
import base64
import shutil
import subprocess
import logging
import secrets
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from verses_data import VERSES_SEED
try:
    from zoneinfo import ZoneInfo
    ROME_TZ = ZoneInfo("Europe/Rome")
except Exception:
    ROME_TZ = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# GridFS bucket for large uploaded media (video/audio/pdf) + chunked-upload temp dir.
fs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="media")
UPLOAD_TMP = Path("/tmp/pdu_uploads")
UPLOAD_TMP.mkdir(parents=True, exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEMO_STREAM = "https://ice1.somafm.com/christmas-128-mp3"

# ---------------- Real AzuraCast radio ----------------
# AzuraCast control API (station lifecycle). Env is the secure default; DB can override from the panel.
AZURACAST_BASE = os.environ.get("AZURACAST_BASE_URL", "http://84.247.184.136").rstrip("/")
AZURACAST_STATION_ENV = os.environ.get("AZURACAST_STATION", "pescatori")
AZURACAST_API_KEY_ENV = os.environ.get("AZURACAST_API_KEY", "")

# Stream + now-playing defaults derived from the env-backed AzuraCast host/station.
# NOTE: server-side defaults only — clients always receive the HTTPS proxies
# /api/live/stream and /api/live/art, never this origin directly.
AZ_STREAM_URL = os.environ.get("AZURACAST_STREAM_URL") or f"{AZURACAST_BASE}/listen/{AZURACAST_STATION_ENV}/radio.mp3"
AZ_NOWPLAYING_URL = os.environ.get("AZURACAST_NOWPLAYING_URL") or f"{AZURACAST_BASE}/api/nowplaying/{AZURACAST_STATION_ENV}"
DEFAULT_ART = "https://images.unsplash.com/photo-1592818868295-f527dbac420d?w=600&q=85"


async def _az_conf():
    doc = await db.live_status.find_one({"_id": "current"}) or {}
    key = doc.get("azuracast_api_key") or AZURACAST_API_KEY_ENV
    station = doc.get("station_shortcode") or AZURACAST_STATION_ENV
    return key, station, doc


async def az_api(method: str, path: str, key: str):
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as hc:
        r = await hc.request(method, f"{AZURACAST_BASE}/api{path}", headers={"X-API-Key": key})
        r.raise_for_status()
        try:
            return r.json()
        except Exception:
            return {}


def now_utc():
    return datetime.now(timezone.utc)


try:
    from zoneinfo import ZoneInfo
    _ROME_TZ = ZoneInfo("Europe/Rome")
except Exception:  # pragma: no cover
    _ROME_TZ = timezone.utc

DAYS_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]


def _normalize_program(d: dict) -> dict:
    """Map a program document to the rich, forward-compatible shape used by the
    app, filling gaps from legacy fields (name/time/day/host) so old data keeps
    working after the palinsesto redesign."""
    title = d.get("title") or d.get("name") or ""
    presenters = d.get("presenters")
    if not presenters:
        host = (d.get("host") or "").strip()
        presenters = [{"name": host, "image": ""}] if host else []
    presenters = [{"name": (p or {}).get("name", ""), "image": (p or {}).get("image", "")} for p in presenters]
    start = d.get("start_time") or d.get("time") or ""
    weekdays = d.get("weekdays")
    if not weekdays:
        weekdays = [d.get("day")] if d.get("day") else []
    weekdays = [w for w in weekdays if w in DAYS_IT]
    images = d.get("images")
    if not images:
        images = [p["image"] for p in presenters if p.get("image")]
    host_str = ", ".join([p["name"] for p in presenters if p.get("name")])
    return {
        "id": d.get("id"),
        "title": title,
        "name": title,
        "presenters": presenters,
        "host": host_str,
        "description": d.get("description") or "",
        "start_time": start,
        "time": start,
        "end_time": d.get("end_time") or "",
        "weekdays": weekdays,
        "images": images,
        "color": d.get("color") or "",
        "active": d.get("active", True),
        "type": d.get("type") or "regular",
        "date": d.get("date") or "",
    }


def _is_on_air(p: dict, now=None) -> bool:
    """True if the (normalized) program is currently on air in Italian time."""
    if not p.get("active", True):
        return False
    start = p.get("start_time")
    end = p.get("end_time")
    weekdays = p.get("weekdays") or []
    if not start or not end:
        return False
    now = now or datetime.now(_ROME_TZ)
    today = DAYS_IT[now.weekday()]
    cur = now.strftime("%H:%M")
    if end > start:
        return today in weekdays and start <= cur < end
    # crosses midnight
    prev_day = DAYS_IT[(now.weekday() - 1) % 7]
    return (today in weekdays and cur >= start) or (prev_day in weekdays and cur < end)


def new_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------- Models ----------------
class PrayerRequest(BaseModel):
    text: str
    name: Optional[str] = None
    anonymous: bool = False


class ContactMessage(BaseModel):
    name: str
    email: str
    message: str


class MessageIn(BaseModel):
    text: str
    name: Optional[str] = None
    type: str = "message"  # message | testimony


class SessionIn(BaseModel):
    session_token: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


# ---------------- Auth helpers ----------------
import bcrypt


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


async def create_session(user_id: str) -> str:
    token = uuid.uuid4().hex + uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    return token


async def get_current_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = sess["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Normalize RBAC fields (admins from allowlist always win)
    email = (user.get("email") or "").lower()
    if email in ADMIN_EMAILS:
        user["role"] = ROLE_ADMIN
    elif not user.get("role"):
        user["role"] = ROLE_LISTENER
    user["permissions"] = user.get("permissions") or []
    user["status"] = user.get("status") or "active"
    # Suspended accounts are blocked (allowlist admins can never be suspended)
    if user["status"] == "suspended" and email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Account sospeso. Contatta l'amministrazione.")
    return user


# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    uid = new_id("user")
    email_l = body.email.lower()
    # Admin allowlist accounts must authenticate via Google OAuth, not
    # email/password — this prevents an attacker from claiming an admin email.
    if email_l in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Questo indirizzo deve accedere con Google.")
    role = ROLE_ADMIN if email_l in ADMIN_EMAILS else ROLE_LISTENER
    await db.users.insert_one({
        "user_id": uid,
        "email": email_l,
        "name": body.name,
        "password": hash_pw(body.password),
        "picture": None,
        "provider": "email",
        "role": role,
        "permissions": [],
        "status": "active",
        "created_at": now_utc(),
        "last_login": now_utc(),
    })
    token = await create_session(uid)
    return {"token": token, "user": {"user_id": uid, "email": email_l, "name": body.name, "picture": None, "role": role, "permissions": []}}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password") or not check_pw(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    email_l = (user.get("email") or "").lower()
    if (user.get("status") == "suspended") and email_l not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Account sospeso. Contatta l'amministrazione.")
    token = await create_session(user["user_id"])
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_login": now_utc()}})
    role = ROLE_ADMIN if email_l in ADMIN_EMAILS else (user.get("role") or ROLE_LISTENER)
    return {"token": token, "user": {"user_id": user["user_id"], "email": user["email"], "name": user["name"], "picture": user.get("picture"), "role": role, "permissions": user.get("permissions") or []}}


@api_router.post("/auth/session")
async def auth_session(body: SessionIn):
    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_token},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Sessione OAuth non valida")
    data = r.json()
    email = data["email"].lower()
    role = ROLE_ADMIN if email in ADMIN_EMAILS else ROLE_LISTENER
    user = await db.users.find_one({"email": email})
    if user:
        uid = user["user_id"]
        # Keep admin role in sync with allowlist; otherwise preserve stored role
        if email in ADMIN_EMAILS and user.get("role") != ROLE_ADMIN:
            await db.users.update_one({"user_id": uid}, {"$set": {"role": ROLE_ADMIN}})
        role = ROLE_ADMIN if email in ADMIN_EMAILS else (user.get("role") or ROLE_LISTENER)
        permissions = user.get("permissions") or []
        if (user.get("status") == "suspended") and email not in ADMIN_EMAILS:
            raise HTTPException(status_code=403, detail="Account sospeso. Contatta l'amministrazione.")
        await db.users.update_one({"user_id": uid}, {"$set": {"last_login": now_utc()}})
    else:
        uid = new_id("user")
        permissions = []
        await db.users.insert_one({
            "user_id": uid,
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "provider": "google",
            "role": role,
            "permissions": [],
            "status": "active",
            "created_at": now_utc(),
            "last_login": now_utc(),
        })
    token = await create_session(uid)
    return {"token": token, "user": {"user_id": uid, "email": email, "name": data.get("name"), "picture": data.get("picture"), "role": role, "permissions": permissions}}


@api_router.get("/auth/me")
async def me(authorization: Optional[str] = Header(None)):
    return await get_current_user(authorization)


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------- Live status ----------------
@api_router.get("/live/status")
async def live_status():
    """Live radio metadata proxied from AzuraCast (server-side to avoid CORS / mixed-content).
    Never raises: if the Now Playing API is unreachable the stored fallback is returned and
    the stream keeps playing with an "In Diretta" label."""
    doc = await db.live_status.find_one({"_id": "current"}) or {}
    meta_url = doc.get("metadata_url") or AZ_NOWPLAYING_URL
    stream = doc.get("stream_url") or AZ_STREAM_URL
    refresh = int(doc.get("refresh_interval") or 15)
    result = {
        "is_live": True,
        "is_online": False,
        "title": doc.get("title") or "In Diretta",
        "artist": doc.get("artist") or doc.get("station_name") or "Pescatori di Uomini",
        "album": "",
        "artwork": doc.get("artwork") or DEFAULT_ART,
        "listeners": None,
        "stream_url": stream,
        "refresh_interval": refresh if refresh > 0 else 15,
        "station_name": doc.get("station_name") or "Pescatori di Uomini",
        "live_mode": bool(doc.get("live_mode")),
        "live_watch_url": doc.get("live_watch_url") or "",
        "live_links": doc.get("live_links") or {},
    }
    try:
        async with httpx.AsyncClient(timeout=8) as hc:
            r = await hc.get(meta_url)
            r.raise_for_status()
            data = r.json()
        np = data.get("now_playing") or {}
        song = np.get("song") or {}
        live = data.get("live") or {}
        listeners = (data.get("listeners") or {}).get("current")
        title = (song.get("title") or "").strip()
        artist = (song.get("artist") or "").strip()
        if live.get("is_live") and live.get("streamer_name"):
            artist = live.get("streamer_name")
        result.update({
            "is_online": bool(data.get("is_online", True)),
            "is_live": True,
            "title": title or result["title"],
            "artist": artist or result["artist"],
            "album": (song.get("album") or ""),
            "artwork": song.get("art") or result["artwork"],
            "listeners": listeners,
        })
    except Exception as e:
        logger.warning("Now Playing fetch failed: %s", e)
    # When a scheduled program is on air, let the palinsesto drive the player
    # label. Kept lightweight (no base64 image here — the widgets/player fetch
    # /programs/current for the presenter photo).
    try:
        pdocs = await db.programs.find({}, {"_id": 0}).to_list(500)
        for d in pdocs:
            pr = _normalize_program(d)
            if _is_on_air(pr):
                result["current_program"] = {
                    "id": pr["id"], "title": pr["title"], "host": pr["host"],
                    "start_time": pr["start_time"], "end_time": pr["end_time"],
                }
                if pr["title"]:
                    result["title"] = pr["title"]
                if pr["host"]:
                    result["artist"] = pr["host"]
                break
    except Exception as e:
        logger.warning("current program lookup failed: %s", e)
    return result


@api_router.get("/live/stream")
async def live_stream():
    """HTTPS pass-through proxy for the AzuraCast MP3 stream so it plays on web (no mixed
    content) and native alike. Errors return 503 without crashing the app."""
    doc = await db.live_status.find_one({"_id": "current"}) or {}
    stream = doc.get("stream_url") or AZ_STREAM_URL
    client = httpx.AsyncClient(timeout=httpx.Timeout(15.0, read=None), follow_redirects=True)
    try:
        req = client.build_request("GET", stream)
        upstream = await client.send(req, stream=True)
    except Exception as e:
        await client.aclose()
        logger.warning("Stream connect failed: %s", e)
        raise HTTPException(status_code=503, detail="Stream non disponibile")
    if upstream.status_code != 200:
        code = upstream.status_code
        await upstream.aclose()
        await client.aclose()
        logger.warning("Stream upstream status %s", code)
        raise HTTPException(status_code=503, detail="Stream offline")

    async def gen():
        try:
            async for chunk in upstream.aiter_bytes(chunk_size=16384):
                yield chunk
        except Exception as e:
            logger.info("Stream ended: %s", e)
        finally:
            await upstream.aclose()
            await client.aclose()

    media = upstream.headers.get("content-type", "audio/mpeg")
    return StreamingResponse(gen(), media_type=media, headers={"Cache-Control": "no-cache"})


@api_router.get("/live/art")
async def live_art(u: str):
    """HTTPS proxy for now-playing artwork (AzuraCast serves it over HTTP)."""
    if not u.startswith("http"):
        raise HTTPException(status_code=400, detail="URL non valido")
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as hc:
            r = await hc.get(u)
            r.raise_for_status()
    except Exception:
        raise HTTPException(status_code=503, detail="Copertina non disponibile")
    return Response(content=r.content, media_type=r.headers.get("content-type", "image/jpeg"),
                    headers={"Cache-Control": "public, max-age=60"})


# ---------------- Content routes ----------------
def _pub_filter(extra: dict = None):
    q = {"published": {"$ne": False}}
    if extra:
        q.update(extra)
    return q


def _reading_time(text: str) -> int:
    words = len((text or "").split())
    return max(1, round(words / 200))


@api_router.get("/podcasts")
async def get_podcasts(search: Optional[str] = None, category: Optional[str] = None):
    query = _pub_filter()
    if category and category != "Tutti":
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": re.escape(search), "$options": "i"}},
            {"description": {"$regex": re.escape(search), "$options": "i"}},
            {"subtitle": {"$regex": re.escape(search), "$options": "i"}},
        ]
    docs = await db.podcasts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/podcasts/featured")
async def featured_podcasts():
    docs = await db.podcasts.find(_pub_filter({"featured": True}), {"_id": 0}).sort("featured_order", 1).to_list(50)
    return docs


@api_router.get("/podcasts/categories")
async def podcast_categories():
    cats = await db.podcasts.distinct("category", _pub_filter())
    return ["Tutti"] + sorted([c for c in cats if c])


@api_router.get("/podcasts/{podcast_id}")
async def get_podcast(podcast_id: str):
    doc = await db.podcasts.find_one({"id": podcast_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Podcast non trovato")
    return doc


@api_router.get("/news")
async def get_news():
    docs = await db.news.find(_pub_filter(), {"_id": 0}).sort("date", -1).to_list(500)
    for d in docs:
        d["reading_time"] = _reading_time(d.get("body", ""))
    return docs


@api_router.get("/news/featured")
async def featured_news():
    docs = await db.news.find(_pub_filter({"featured": True}), {"_id": 0}).sort("date", -1).to_list(50)
    for d in docs:
        d["reading_time"] = _reading_time(d.get("body", ""))
    return docs


@api_router.get("/news/categories")
async def news_categories():
    cats = await db.news.distinct("category", _pub_filter())
    return ["Tutte"] + sorted([c for c in cats if c])


@api_router.get("/news/{news_id}")
async def get_news_item(news_id: str):
    doc = await db.news.find_one({"id": news_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Notizia non trovata")
    doc["reading_time"] = _reading_time(doc.get("body", ""))
    return doc


@api_router.get("/programs")
async def get_programs():
    docs = await db.programs.find({}, {"_id": 0}).to_list(500)
    progs = [_normalize_program(d) for d in docs]
    progs.sort(key=lambda p: (p.get("start_time") or "99:99"))
    return progs


@api_router.get("/programs/current")
async def get_current_program():
    docs = await db.programs.find({}, {"_id": 0}).to_list(500)
    for d in docs:
        p = _normalize_program(d)
        if _is_on_air(p):
            return p
    return None


@api_router.get("/programs/day/{weekday}")
async def get_programs_by_day(weekday: str):
    docs = await db.programs.find({}, {"_id": 0}).to_list(500)
    out = []
    for d in docs:
        p = _normalize_program(d)
        if p.get("active", True) and weekday in (p.get("weekdays") or []):
            out.append(p)
    out.sort(key=lambda p: (p.get("start_time") or "99:99"))
    return out


@api_router.get("/collaborators")
async def get_collaborators():
    docs = await db.collaborators.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return docs


# ---------------- Crew (L'Equipaggio) ----------------
class ApplicationIn(BaseModel):
    name: str
    surname: str
    age: Optional[int] = None
    city: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    desired_role: str
    testimony: Optional[str] = None
    motivation: str
    experience: Optional[str] = None
    portrait: Optional[str] = None  # base64 data URI (optional)


@api_router.get("/crew")
async def get_crew():
    docs = await db.crew.find({"published": True}, {"_id": 0}).sort("order", 1).to_list(200)
    return docs


@api_router.get("/crew/{member_id}")
async def get_crew_member(member_id: str):
    doc = await db.crew.find_one({"id": member_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Membro non trovato")
    return doc


@api_router.post("/crew/applications")
async def create_application(body: ApplicationIn):
    doc = {
        "id": new_id("app"),
        "name": body.name, "surname": body.surname, "age": body.age,
        "city": body.city, "email": body.email.lower(), "phone": body.phone,
        "desired_role": body.desired_role, "testimony": body.testimony,
        "motivation": body.motivation, "experience": body.experience,
        "portrait": body.portrait, "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.crew_applications.insert_one(dict(doc))
    return {"ok": True}


@api_router.post("/prayer-requests")
async def create_prayer(body: PrayerRequest):
    doc = {"id": new_id("pray"), "text": body.text,
           "name": None if body.anonymous else body.name,
           "anonymous": body.anonymous, "created_at": now_utc().isoformat(), "status": "new"}
    await db.prayer_requests.insert_one(dict(doc))
    return {"ok": True}


@api_router.post("/messages")
async def create_message(body: MessageIn):
    doc = {"id": new_id("msg"), "text": body.text, "name": body.name,
           "type": body.type, "created_at": now_utc().isoformat(), "status": "new"}
    await db.messages.insert_one(dict(doc))
    return {"ok": True}


@api_router.post("/contact")
async def contact(body: ContactMessage):
    doc = {"id": new_id("ct"), "name": body.name, "email": body.email,
           "message": body.message, "created_at": now_utc().isoformat()}
    await db.contact_messages.insert_one(dict(doc))
    return {"ok": True}


# ---------------- Favorites / History (auth) ----------------
@api_router.get("/me/favorites")
async def get_favorites(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    favs = await db.favorites.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    ids = [f["podcast_id"] for f in favs]
    docs = await db.podcasts.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200)
    return docs


@api_router.post("/me/favorites/{podcast_id}")
async def toggle_favorite(podcast_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    existing = await db.favorites.find_one({"user_id": user["user_id"], "podcast_id": podcast_id})
    if existing:
        await db.favorites.delete_one({"_id": existing["_id"]})
        return {"favorited": False}
    await db.favorites.insert_one({"user_id": user["user_id"], "podcast_id": podcast_id, "created_at": now_utc()})
    return {"favorited": True}


@api_router.get("/me/favorite-ids")
async def favorite_ids(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    favs = await db.favorites.find({"user_id": user["user_id"]}, {"_id": 0, "podcast_id": 1}).to_list(500)
    return [f["podcast_id"] for f in favs]


@api_router.post("/me/history/{podcast_id}")
async def add_history(podcast_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.history.update_one(
        {"user_id": user["user_id"], "podcast_id": podcast_id},
        {"$set": {"played_at": now_utc()}}, upsert=True)
    return {"ok": True}


@api_router.get("/me/history")
async def get_history(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    hist = await db.history.find({"user_id": user["user_id"]}, {"_id": 0}).sort("played_at", -1).to_list(50)
    ids = [h["podcast_id"] for h in hist]
    docs = await db.podcasts.find({"id": {"$in": ids}}, {"_id": 0}).to_list(50)
    order = {pid: i for i, pid in enumerate(ids)}
    docs.sort(key=lambda d: order.get(d["id"], 999))
    return docs


# ---------------- Admin (RBAC) ----------------
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
ROLE_ADMIN, ROLE_COLLAB, ROLE_LISTENER = "administrator", "collaborator", "listener"
# Sections that can be delegated to a collaborator (each maps to an existing admin area).
PERM_SECTIONS = ["podcasts", "meditations", "news", "merch", "schedule", "prayers", "messages", "team", "radio", "verses"]

# ---------------- Email (Emergent-managed Resend) ----------------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Pescatori di Uomini")
APP_BASE_URL = (os.environ.get("preview_endpoint") or os.environ.get("APP_BASE_URL") or "").rstrip("/")


async def send_email(to_email: str, subject: str, html: str) -> bool:
    """Best-effort transactional email. Returns True if accepted, False otherwise.
    Never raises so invitation creation keeps working even without a provisioned key."""
    if not EMAIL_KEY:
        logger.info("EMERGENT_EMAIL_KEY not set; skipping email send to %s", to_email)
        return False
    try:
        async with httpx.AsyncClient(timeout=30) as hc:
            resp = await hc.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [to_email], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME},
            )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Email send failed: %s", e)
        return False


async def log_activity(actor: dict, action: str, target: str = "", meta: Optional[dict] = None):
    """Append an entry to the audit trail. actor is the acting admin/collaborator user doc."""
    await db.activity_log.insert_one({
        "id": new_id("act"),
        "actor_id": actor.get("user_id"),
        "actor_name": actor.get("name") or actor.get("email"),
        "action": action,
        "target": target,
        "meta": meta or {},
        "created_at": now_utc(),
    })


def role_for_email(email: str) -> str:
    return ROLE_ADMIN if (email or "").lower() in ADMIN_EMAILS else ROLE_LISTENER


async def require_admin(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    email = (user.get("email") or "").lower()
    if user.get("role") == ROLE_ADMIN or email in ADMIN_EMAILS:
        return user
    raise HTTPException(status_code=403, detail="Accesso negato: non sei un amministratore")


def require_perm(section: str):
    async def dep(authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        email = (user.get("email") or "").lower()
        if user.get("role") == ROLE_ADMIN or email in ADMIN_EMAILS:
            return user
        if user.get("role") == ROLE_COLLAB and section in (user.get("permissions") or []):
            return user
        raise HTTPException(status_code=403, detail="Non hai i permessi per questa sezione")
    return dep


async def require_uploader(authorization: Optional[str] = Header(None)):
    """Generic media upload access: admins, or any collaborator that manages at
    least one section. The section endpoints (podcasts/meditations/...) still
    enforce their own per-section permission when the uploaded media is saved."""
    user = await get_current_user(authorization)
    email = (user.get("email") or "").lower()
    if user.get("role") == ROLE_ADMIN or email in ADMIN_EMAILS:
        return user
    if user.get("role") == ROLE_COLLAB and (user.get("permissions") or []):
        return user
    raise HTTPException(status_code=403, detail="Non hai i permessi per caricare file")


class ApplicationEdit(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    age: Optional[int] = None
    desired_role: Optional[str] = None
    testimony: Optional[str] = None
    motivation: Optional[str] = None
    experience: Optional[str] = None
    portrait: Optional[str] = None
    # crew-style overrides used at approval
    display_name: Optional[str] = None
    role: Optional[str] = None
    mission: Optional[str] = None
    bio: Optional[str] = None
    ministry: Optional[str] = None
    programs: Optional[List[str]] = None
    verse: Optional[str] = None
    verse_ref: Optional[str] = None


class CrewEdit(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    mission: Optional[str] = None
    bio: Optional[str] = None
    ministry: Optional[str] = None
    programs: Optional[List[str]] = None
    verse: Optional[str] = None
    verse_ref: Optional[str] = None
    portrait: Optional[str] = None
    published: Optional[bool] = None


class PortraitIn(BaseModel):
    portrait: str


def build_crew_from_app(a: dict, order: int) -> dict:
    return {
        "id": new_id("crew"),
        "name": a.get("display_name") or f"{a.get('name','')} {a.get('surname','')}".strip(),
        "role": a.get("role") or a.get("desired_role") or "Collaboratore",
        "mission": a.get("mission") or (a.get("motivation") or "")[:140],
        "bio": a.get("bio") or a.get("experience") or "",
        "ministry": a.get("ministry") or "",
        "programs": a.get("programs") or [],
        "verse": a.get("verse") or "",
        "verse_ref": a.get("verse_ref") or "",
        "testimony": a.get("testimony") or "",
        "portrait_key": None,
        "portrait": a.get("portrait"),
        "poster": False,
        "order": order,
        "published": True,
    }


@api_router.get("/admin/me")
async def admin_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    email = (user.get("email") or "").lower()
    role = user.get("role")
    if role == ROLE_ADMIN or email in ADMIN_EMAILS:
        return {"is_admin": True, "role": ROLE_ADMIN, "permissions": PERM_SECTIONS,
                "user": {"email": user.get("email"), "name": user.get("name"), "picture": user.get("picture")}}
    if role == ROLE_COLLAB and (user.get("permissions") or []):
        return {"is_admin": False, "role": ROLE_COLLAB, "permissions": user.get("permissions") or [],
                "user": {"email": user.get("email"), "name": user.get("name"), "picture": user.get("picture")}}
    raise HTTPException(status_code=403, detail="Accesso negato: non hai i permessi per il pannello")


@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    return {
        "pending_applications": await db.crew_applications.count_documents({"status": "pending"}),
        "approved_members": await db.crew.count_documents({"published": True}),
        "total_users": await db.users.count_documents({}),
        "prayer_requests": await db.prayer_requests.count_documents({}),
        "new_prayers": await db.prayer_requests.count_documents({"status": "new"}),
        "messages": await db.messages.count_documents({"type": "message"}),
        "testimonies": await db.messages.count_documents({"type": "testimony"}),
        "new_messages": await db.messages.count_documents({"status": "new"}),
        "programs": await db.programs.count_documents({}),
        "news": await db.news.count_documents({}),
        "podcasts": await db.podcasts.count_documents({}),
        "meditations": await db.meditations.count_documents({}),
        "products": await db.products.count_documents({}),
        "donations": await db.donation_transactions.count_documents({"payment_status": "paid"}),
        "notifications": await db.notifications_log.count_documents({}),
        "reports": await db.reports.count_documents({}),
        "reports_new": await db.reports.count_documents({"read": {"$ne": True}}),
        "verses": await db.verses.count_documents({}),
    }


@api_router.get("/admin/applications")
async def admin_applications(status: Optional[str] = None, sort: Optional[str] = "newest",
                             search: Optional[str] = None, admin=Depends(require_perm("team"))):
    query = {}
    if status and status in ("pending", "approved", "rejected"):
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": re.escape(search), "$options": "i"}},
            {"surname": {"$regex": re.escape(search), "$options": "i"}},
            {"email": {"$regex": re.escape(search), "$options": "i"}},
        ]
    direction = 1 if sort == "oldest" else -1
    docs = await db.crew_applications.find(query, {"_id": 0}).sort("created_at", direction).to_list(500)
    return docs


@api_router.get("/admin/applications/{app_id}")
async def admin_application(app_id: str, admin=Depends(require_perm("team"))):
    doc = await db.crew_applications.find_one({"id": app_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Candidatura non trovata")
    return doc


@api_router.patch("/admin/applications/{app_id}")
async def admin_edit_application(app_id: str, body: ApplicationEdit, admin=Depends(require_perm("team"))):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        return {"ok": True}
    await db.crew_applications.update_one({"id": app_id}, {"$set": updates})
    # keep public profile in sync if already approved
    doc = await db.crew_applications.find_one({"id": app_id})
    if doc and doc.get("crew_id"):
        crew_updates = {}
        mapping = {"role": "role", "mission": "mission", "bio": "bio", "ministry": "ministry",
                   "programs": "programs", "verse": "verse", "verse_ref": "verse_ref",
                   "testimony": "testimony", "portrait": "portrait", "display_name": "name"}
        for src, dst in mapping.items():
            if src in updates:
                crew_updates[dst] = updates[src]
        if "portrait" in crew_updates:
            crew_updates["portrait_key"] = None
            crew_updates["poster"] = False
        if crew_updates:
            await db.crew.update_one({"id": doc["crew_id"]}, {"$set": crew_updates})
    return {"ok": True}


@api_router.post("/admin/applications/{app_id}/approve")
async def admin_approve(app_id: str, admin=Depends(require_perm("team"))):
    a = await db.crew_applications.find_one({"id": app_id})
    if not a:
        raise HTTPException(status_code=404, detail="Candidatura non trovata")
    if a.get("crew_id"):
        await db.crew.update_one({"id": a["crew_id"]}, {"$set": {"published": True}})
        crew_id = a["crew_id"]
    else:
        order = await db.crew.count_documents({})
        member = build_crew_from_app(a, order)
        await db.crew.insert_one(dict(member))
        crew_id = member["id"]
    await db.crew_applications.update_one({"id": app_id}, {"$set": {"status": "approved", "crew_id": crew_id}})
    return {"ok": True, "crew_id": crew_id}


@api_router.post("/admin/applications/{app_id}/reject")
async def admin_reject(app_id: str, admin=Depends(require_perm("team"))):
    a = await db.crew_applications.find_one({"id": app_id})
    if not a:
        raise HTTPException(status_code=404, detail="Candidatura non trovata")
    if a.get("crew_id"):
        await db.crew.delete_one({"id": a["crew_id"]})
    await db.crew_applications.update_one({"id": app_id}, {"$set": {"status": "rejected", "crew_id": None}})
    return {"ok": True}


@api_router.delete("/admin/applications/{app_id}")
async def admin_delete_application(app_id: str, admin=Depends(require_perm("team"))):
    a = await db.crew_applications.find_one({"id": app_id})
    if a and a.get("crew_id"):
        await db.crew.delete_one({"id": a["crew_id"]})
    await db.crew_applications.delete_one({"id": app_id})
    return {"ok": True}


@api_router.get("/admin/crew")
async def admin_crew(admin=Depends(require_perm("team"))):
    docs = await db.crew.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return docs


@api_router.patch("/admin/crew/{member_id}")
async def admin_edit_crew(member_id: str, body: CrewEdit, admin=Depends(require_perm("team"))):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if "portrait" in updates:
        updates["portrait_key"] = None
        updates["poster"] = False
    if updates:
        await db.crew.update_one({"id": member_id}, {"$set": updates})
    return {"ok": True}


@api_router.post("/admin/crew/{member_id}/portrait")
async def admin_crew_portrait(member_id: str, body: PortraitIn, admin=Depends(require_perm("team"))):
    await db.crew.update_one({"id": member_id}, {"$set": {"portrait": body.portrait, "portrait_key": None, "poster": False}})
    return {"ok": True}


@api_router.delete("/admin/crew/{member_id}")
async def admin_delete_crew(member_id: str, admin=Depends(require_perm("team"))):
    await db.crew.delete_one({"id": member_id})
    await db.crew_applications.update_many({"crew_id": member_id}, {"$set": {"crew_id": None}})
    return {"ok": True}


# ---------------- Admin: Podcast CMS ----------------
class PodcastIn(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    description: Optional[str] = ""
    author: Optional[str] = ""
    category: Optional[str] = "Generale"
    tags: Optional[List[str]] = []
    artwork: Optional[str] = None
    audio_url: Optional[str] = None
    episode_number: Optional[int] = None
    duration: Optional[str] = ""
    publish_date: Optional[str] = None
    featured: Optional[bool] = False
    published: Optional[bool] = False


class PodcastEdit(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    artwork: Optional[str] = None
    audio_url: Optional[str] = None
    episode_number: Optional[int] = None
    duration: Optional[str] = None
    publish_date: Optional[str] = None
    featured: Optional[bool] = None
    published: Optional[bool] = None


@api_router.get("/admin/podcasts")
async def admin_podcasts(status: Optional[str] = None, search: Optional[str] = None, admin=Depends(require_perm("podcasts"))):
    query = {}
    if status == "published":
        query["published"] = True
    elif status == "draft":
        query["published"] = {"$ne": True}
    if search:
        query["$or"] = [{"title": {"$regex": re.escape(search), "$options": "i"}}, {"author": {"$regex": re.escape(search), "$options": "i"}}]
    docs = await db.podcasts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/admin/podcasts", status_code=201)
async def admin_create_podcast(body: PodcastIn, admin=Depends(require_perm("podcasts"))):
    doc = body.model_dump()
    doc["id"] = new_id("pod")
    doc["created_at"] = now_utc()
    doc["featured_order"] = await db.podcasts.count_documents({})
    if not doc.get("publish_date"):
        doc["publish_date"] = now_utc().isoformat()
    await db.podcasts.insert_one(dict(doc))
    doc.pop("_id", None)
    await log_activity(admin, f"ha caricato il podcast \"{doc.get('title', '')}\"", "podcasts", {"id": doc["id"]})
    # Auto push: distinguish meditations from regular podcasts by category.
    cat = (doc.get("category") or "").lower()
    is_meditation = "meditaz" in cat
    ntf_cat = "meditations" if is_meditation else "podcasts"
    label = "Nuova meditazione" if is_meditation else "Nuovo podcast"
    await notify_category(ntf_cat, label, doc.get("title", ""), action_url=f"/podcast/{doc['id']}",
                          admin_email=admin.get("email"))
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/podcasts/{pid}")
async def admin_edit_podcast(pid: str, body: PodcastEdit, admin=Depends(require_perm("podcasts"))):
    updates = body.model_dump(exclude_unset=True)
    if updates:
        await db.podcasts.update_one({"id": pid}, {"$set": updates})
    return {"ok": True}


@api_router.delete("/admin/podcasts/{pid}")
async def admin_delete_podcast(pid: str, admin=Depends(require_perm("podcasts"))):
    await db.podcasts.delete_one({"id": pid})
    return {"ok": True}


@api_router.post("/admin/podcasts/featured-order")
async def admin_podcast_featured_order(body: dict, admin=Depends(require_perm("podcasts"))):
    ids = body.get("ids", [])
    for i, pid in enumerate(ids):
        await db.podcasts.update_one({"id": pid}, {"$set": {"featured_order": i}})
    return {"ok": True}


# ---------------- Admin: News CMS ----------------
class NewsIn(BaseModel):
    title: str
    excerpt: Optional[str] = ""
    body: Optional[str] = ""
    category: Optional[str] = "Mondo Cristiano"
    author: Optional[str] = "Redazione"
    image: Optional[str] = None
    date: Optional[str] = None
    featured: Optional[bool] = False
    published: Optional[bool] = False


class NewsEdit(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    image: Optional[str] = None
    date: Optional[str] = None
    featured: Optional[bool] = None
    published: Optional[bool] = None


@api_router.get("/admin/news")
async def admin_news(status: Optional[str] = None, search: Optional[str] = None, admin=Depends(require_perm("news"))):
    query = {}
    if status == "published":
        query["published"] = True
    elif status == "draft":
        query["published"] = {"$ne": True}
    if search:
        query["$or"] = [{"title": {"$regex": re.escape(search), "$options": "i"}}, {"author": {"$regex": re.escape(search), "$options": "i"}}]
    docs = await db.news.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return docs


@api_router.post("/admin/news", status_code=201)
async def admin_create_news(body: NewsIn, admin=Depends(require_perm("news"))):
    doc = body.model_dump()
    doc["id"] = new_id("news")
    if not doc.get("date"):
        doc["date"] = now_utc().isoformat()
    await db.news.insert_one(dict(doc))
    await log_activity(admin, f"ha pubblicato la news \"{doc.get('title', '')}\"", "news", {"id": doc["id"]})
    if doc.get("published"):
        await notify_category("news", "Nuova notizia", doc.get("title", ""),
                              action_url=f"/news/{doc['id']}", admin_email=admin.get("email"))
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/news/{nid}")
async def admin_edit_news(nid: str, body: NewsEdit, admin=Depends(require_perm("news"))):
    updates = body.model_dump(exclude_unset=True)
    prev = await db.news.find_one({"id": nid}, {"published": 1, "title": 1})
    if updates:
        await db.news.update_one({"id": nid}, {"$set": updates})
    # Notify when a draft transitions to published.
    if updates.get("published") is True and prev and not prev.get("published"):
        title = updates.get("title") or (prev.get("title") if prev else "") or ""
        await notify_category("news", "Nuova notizia", title,
                              action_url=f"/news/{nid}", admin_email=admin.get("email"))
    return {"ok": True}


@api_router.delete("/admin/news/{nid}")
async def admin_delete_news(nid: str, admin=Depends(require_perm("news"))):
    await db.news.delete_one({"id": nid})
    return {"ok": True}


# ---------------- Public: Testimonies ----------------
@api_router.get("/testimonies")
async def get_testimonies():
    docs = await db.messages.find(
        {"type": "testimony", "status": "published"},
        {"_id": 0, "admin_notes": 0},
    ).sort("published_at", -1).to_list(200)
    return docs


# ---------------- Public: Settings ----------------
@api_router.get("/settings")
async def get_public_settings():
    doc = await db.settings.find_one({"_id": "general"}) or {}
    doc.pop("_id", None)
    return doc


# ---------------- Admin: Prayer Requests ----------------
PRAYER_STATUSES = ["new", "in_progress", "prayed", "archived"]


class PrayerEdit(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None


@api_router.get("/admin/prayers")
async def admin_prayers(status: Optional[str] = None, search: Optional[str] = None, admin=Depends(require_perm("prayers"))):
    query = {}
    if status and status in PRAYER_STATUSES:
        query["status"] = status
    if search:
        query["$or"] = [{"text": {"$regex": re.escape(search), "$options": "i"}}, {"name": {"$regex": re.escape(search), "$options": "i"}}]
    docs = await db.prayer_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        d.setdefault("status", "new")
    return docs


@api_router.get("/admin/prayers/{pid}")
async def admin_prayer(pid: str, admin=Depends(require_perm("prayers"))):
    doc = await db.prayer_requests.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    doc.setdefault("status", "new")
    return doc


@api_router.patch("/admin/prayers/{pid}")
async def admin_edit_prayer(pid: str, body: PrayerEdit, admin=Depends(require_perm("prayers"))):
    updates = body.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] not in PRAYER_STATUSES:
        raise HTTPException(status_code=400, detail="Stato non valido")
    if updates:
        await db.prayer_requests.update_one({"id": pid}, {"$set": updates})
    return {"ok": True}


@api_router.delete("/admin/prayers/{pid}")
async def admin_delete_prayer(pid: str, admin=Depends(require_perm("prayers"))):
    await db.prayer_requests.delete_one({"id": pid})
    return {"ok": True}


# ---------------- Admin: Messages & Testimonies ----------------
MESSAGE_STATUSES = ["new", "reviewed", "published", "archived"]


class MessageEdit(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    text: Optional[str] = None
    name: Optional[str] = None


@api_router.get("/admin/messages")
async def admin_messages(status: Optional[str] = None, type: Optional[str] = None,
                         search: Optional[str] = None, admin=Depends(require_perm("messages"))):
    query = {}
    if status and status in MESSAGE_STATUSES:
        query["status"] = status
    if type in ("message", "testimony"):
        query["type"] = type
    if search:
        query["$or"] = [{"text": {"$regex": re.escape(search), "$options": "i"}}, {"name": {"$regex": re.escape(search), "$options": "i"}}]
    docs = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        d.setdefault("status", "new")
    return docs


@api_router.get("/admin/messages/{mid}")
async def admin_message(mid: str, admin=Depends(require_perm("messages"))):
    doc = await db.messages.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Messaggio non trovato")
    doc.setdefault("status", "new")
    return doc


@api_router.patch("/admin/messages/{mid}")
async def admin_edit_message(mid: str, body: MessageEdit, admin=Depends(require_perm("messages"))):
    updates = body.model_dump(exclude_unset=True)
    if "status" in updates:
        if updates["status"] not in MESSAGE_STATUSES:
            raise HTTPException(status_code=400, detail="Stato non valido")
        if updates["status"] == "published":
            updates["published_at"] = now_utc().isoformat()
    if updates:
        await db.messages.update_one({"id": mid}, {"$set": updates})
    return {"ok": True}


@api_router.delete("/admin/messages/{mid}")
async def admin_delete_message(mid: str, admin=Depends(require_perm("messages"))):
    await db.messages.delete_one({"id": mid})
    return {"ok": True}


# ---------------- Admin: Users ----------------
@api_router.get("/admin/users")
async def admin_users(search: Optional[str] = None, role: Optional[str] = None,
                      status: Optional[str] = None, sort: Optional[str] = "recent",
                      admin=Depends(require_admin)):
    query = {}
    if search:
        query["$or"] = [{"name": {"$regex": re.escape(search), "$options": "i"}}, {"email": {"$regex": re.escape(search), "$options": "i"}}]
    if status in ("active", "suspended"):
        query["status"] = status if status == "suspended" else {"$ne": "suspended"}
    sort_field, sort_dir = ("created_at", -1)
    if sort == "name":
        sort_field, sort_dir = ("name", 1)
    elif sort == "last_login":
        sort_field, sort_dir = ("last_login", -1)
    docs = await db.users.find(query, {"_id": 0, "password": 0}).sort(sort_field, sort_dir).to_list(2000)
    out = []
    for d in docs:
        email_l = (d.get("email") or "").lower()
        d["is_admin"] = email_l in ADMIN_EMAILS
        d["role"] = ROLE_ADMIN if email_l in ADMIN_EMAILS else (d.get("role") or ROLE_LISTENER)
        d["permissions"] = d.get("permissions") or []
        d["status"] = d.get("status") or "active"
        if role and d["role"] != role:
            continue
        out.append(d)
    return out


class UserRoleIn(BaseModel):
    role: str  # administrator | collaborator | listener
    permissions: Optional[List[str]] = None


@api_router.put("/admin/users/{uid}/role")
async def admin_set_user_role(uid: str, body: UserRoleIn, admin=Depends(require_admin)):
    u = await db.users.find_one({"user_id": uid})
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if (u.get("email") or "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Il ruolo degli amministratori dell'allowlist non è modificabile")
    if body.role not in (ROLE_ADMIN, ROLE_COLLAB, ROLE_LISTENER):
        raise HTTPException(status_code=400, detail="Ruolo non valido")
    # Administrators implicitly have every permission; collaborators get the selected subset.
    perms: List[str] = []
    if body.role == ROLE_COLLAB:
        perms = [p for p in (body.permissions or []) if p in PERM_SECTIONS]
    elif body.role == ROLE_ADMIN:
        perms = list(PERM_SECTIONS)
    await db.users.update_one({"user_id": uid}, {"$set": {"role": body.role, "permissions": perms}})
    label = {ROLE_ADMIN: "Amministratore", ROLE_COLLAB: "Collaboratore"}.get(body.role, "Ascoltatore")
    await log_activity(admin, f"ha impostato {u.get('name') or u.get('email')} come {label}", "utenti",
                       {"user_id": uid, "role": body.role, "permissions": perms})
    return {"ok": True, "role": body.role, "permissions": perms}


class UserStatusIn(BaseModel):
    status: str  # active | suspended


@api_router.put("/admin/users/{uid}/status")
async def admin_set_user_status(uid: str, body: UserStatusIn, admin=Depends(require_admin)):
    u = await db.users.find_one({"user_id": uid})
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if (u.get("email") or "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Non puoi sospendere un amministratore")
    if body.status not in ("active", "suspended"):
        raise HTTPException(status_code=400, detail="Stato non valido")
    await db.users.update_one({"user_id": uid}, {"$set": {"status": body.status}})
    if body.status == "suspended":
        await db.user_sessions.delete_many({"user_id": uid})  # force logout
    verb = "ha sospeso" if body.status == "suspended" else "ha riattivato"
    await log_activity(admin, f"{verb} l'account di {u.get('name') or u.get('email')}", "utenti", {"user_id": uid})
    return {"ok": True, "status": body.status}


@api_router.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, admin=Depends(require_admin)):
    u = await db.users.find_one({"user_id": uid})
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if (u.get("email") or "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Non puoi eliminare un amministratore")
    await db.users.delete_one({"user_id": uid})
    await db.user_sessions.delete_many({"user_id": uid})
    await log_activity(admin, f"ha eliminato l'utente {u.get('name') or u.get('email')}", "utenti", {"user_id": uid})
    return {"ok": True}


# ---------------- Admin: Invitations ----------------
class InvitationIn(BaseModel):
    email: EmailStr
    role: str = ROLE_COLLAB  # collaborator | listener
    permissions: Optional[List[str]] = None


@api_router.get("/admin/invitations")
async def admin_invitations(admin=Depends(require_admin)):
    docs = await db.invitations.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        d["accept_url"] = f"{APP_BASE_URL}/invite?token={d['token']}" if APP_BASE_URL else f"/invite?token={d['token']}"
    return docs


@api_router.post("/admin/invitations", status_code=201)
async def admin_create_invitation(body: InvitationIn, admin=Depends(require_admin)):
    email_l = body.email.lower()
    existing_user = await db.users.find_one({"email": email_l})
    if existing_user:
        raise HTTPException(status_code=400, detail="Esiste già un utente con questa email")
    role = body.role if body.role in (ROLE_COLLAB, ROLE_LISTENER) else ROLE_COLLAB
    perms = [p for p in (body.permissions or []) if p in PERM_SECTIONS] if role == ROLE_COLLAB else []
    token = uuid.uuid4().hex + uuid.uuid4().hex
    inv = {
        "id": new_id("inv"),
        "email": email_l,
        "role": role,
        "permissions": perms,
        "token": token,
        "status": "pending",
        "invited_by": admin.get("name") or admin.get("email"),
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    }
    # Replace any previous pending invite for the same email.
    await db.invitations.delete_many({"email": email_l, "status": "pending"})
    await db.invitations.insert_one(dict(inv))
    accept_url = f"{APP_BASE_URL}/invite?token={token}" if APP_BASE_URL else f"/invite?token={token}"
    label = "Collaboratore" if role == ROLE_COLLAB else "Ascoltatore"
    html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1128;padding:32px 0;font-family:Arial,Helvetica,sans-serif">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#16213E;border-radius:16px;padding:32px">
          <tr><td style="color:#ffffff;font-size:22px;font-weight:bold;padding-bottom:8px">Pescatori di Uomini</td></tr>
          <tr><td style="color:#94A3B8;font-size:14px;padding-bottom:24px">Sei stato invitato come <b style="color:#0EA5E9">{label}</b></td></tr>
          <tr><td style="color:#E2E8F0;font-size:15px;line-height:22px;padding-bottom:24px">Ciao! {inv['invited_by']} ti ha invitato a collaborare alla gestione della radio evangelica <b>Pescatori di Uomini</b>. Clicca il pulsante qui sotto per creare il tuo account e attivare i permessi.</td></tr>
          <tr><td align="center" style="padding-bottom:24px"><a href="{accept_url}" style="background:#0EA5E9;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold;font-size:15px;display:inline-block">Accetta l'invito</a></td></tr>
          <tr><td style="color:#64748B;font-size:12px">Se il pulsante non funziona, copia questo link: {accept_url}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding-top:8px">L'invito scade tra 7 giorni.</td></tr>
        </table>
      </td></tr>
    </table>
    """
    sent = await send_email(email_l, "Invito a collaborare · Pescatori di Uomini", html)
    await log_activity(admin, f"ha invitato {email_l} come {label}", "inviti", {"email": email_l, "role": role})
    return {"ok": True, "invitation": {**inv, "created_at": inv["created_at"].isoformat(), "expires_at": inv["expires_at"].isoformat()},
            "accept_url": accept_url, "email_sent": sent}


@api_router.delete("/admin/invitations/{inv_id}")
async def admin_delete_invitation(inv_id: str, admin=Depends(require_admin)):
    await db.invitations.delete_one({"id": inv_id})
    return {"ok": True}


@api_router.get("/invitations/{token}")
async def get_invitation(token: str):
    inv = await db.invitations.find_one({"token": token}, {"_id": 0})
    if not inv or inv.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Invito non valido o già utilizzato")
    exp = inv.get("expires_at")
    if exp and (exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp) < now_utc():
        raise HTTPException(status_code=400, detail="Invito scaduto")
    return {"email": inv["email"], "role": inv["role"], "permissions": inv.get("permissions") or [], "invited_by": inv.get("invited_by")}


class AcceptInvitationIn(BaseModel):
    name: str
    password: str


@api_router.post("/invitations/{token}/accept")
async def accept_invitation(token: str, body: AcceptInvitationIn):
    inv = await db.invitations.find_one({"token": token})
    if not inv or inv.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Invito non valido o già utilizzato")
    exp = inv.get("expires_at")
    if exp and (exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp) < now_utc():
        raise HTTPException(status_code=400, detail="Invito scaduto")
    email_l = inv["email"].lower()
    if await db.users.find_one({"email": email_l}):
        raise HTTPException(status_code=400, detail="Email già registrata")
    uid = new_id("user")
    role = ROLE_ADMIN if email_l in ADMIN_EMAILS else inv.get("role", ROLE_COLLAB)
    perms = inv.get("permissions") or []
    await db.users.insert_one({
        "user_id": uid,
        "email": email_l,
        "name": body.name,
        "password": hash_pw(body.password),
        "picture": None,
        "provider": "email",
        "role": role,
        "permissions": perms,
        "status": "active",
        "created_at": now_utc(),
        "last_login": now_utc(),
    })
    await db.invitations.update_one({"token": token}, {"$set": {"status": "accepted", "accepted_at": now_utc()}})
    session_token = await create_session(uid)
    return {"token": session_token, "user": {"user_id": uid, "email": email_l, "name": body.name, "picture": None, "role": role, "permissions": perms}}


# ---------------- Admin: Activity log ----------------
@api_router.get("/admin/activity")
async def admin_activity(limit: int = 100, admin=Depends(require_admin)):
    docs = await db.activity_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(min(max(limit, 1), 500))
    return docs


# ---------------- Admin: Programs (Palinsesto) ----------------
class PresenterIn(BaseModel):
    name: Optional[str] = ""
    image: Optional[str] = ""


class ProgramIn(BaseModel):
    title: str
    start_time: str
    end_time: Optional[str] = ""
    weekdays: List[str] = []
    presenters: List[PresenterIn] = []
    description: Optional[str] = ""
    images: List[str] = []
    color: Optional[str] = ""
    active: bool = True
    type: Optional[str] = "regular"
    date: Optional[str] = ""


class ProgramEdit(BaseModel):
    title: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    weekdays: Optional[List[str]] = None
    presenters: Optional[List[PresenterIn]] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    color: Optional[str] = None
    active: Optional[bool] = None
    type: Optional[str] = None
    date: Optional[str] = None


@api_router.get("/admin/programs")
async def admin_programs(admin=Depends(require_perm("schedule"))):
    docs = await db.programs.find({}, {"_id": 0}).to_list(500)
    progs = [_normalize_program(d) for d in docs]
    progs.sort(key=lambda p: (p.get("start_time") or "99:99"))
    return progs


@api_router.post("/admin/programs", status_code=201)
async def admin_create_program(body: ProgramIn, admin=Depends(require_perm("schedule"))):
    doc = body.model_dump()
    doc["presenters"] = [p for p in doc.get("presenters", [])]
    doc["id"] = new_id("prog")
    doc["created_at"] = now_utc()
    doc["updated_at"] = now_utc()
    await db.programs.insert_one(dict(doc))
    await log_activity(admin, f"ha aggiunto il programma \"{doc.get('title', '')}\" al palinsesto", "schedule", {"id": doc["id"]})
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/programs/{prog_id}")
async def admin_edit_program(prog_id: str, body: ProgramEdit, admin=Depends(require_perm("schedule"))):
    updates = body.model_dump(exclude_unset=True)
    if updates:
        updates["updated_at"] = now_utc()
        await db.programs.update_one({"id": prog_id}, {"$set": updates})
    await log_activity(admin, "ha aggiornato il palinsesto", "schedule", {"id": prog_id})
    return {"ok": True}


@api_router.delete("/admin/programs/{prog_id}")
async def admin_delete_program(prog_id: str, admin=Depends(require_perm("schedule"))):
    await db.programs.delete_one({"id": prog_id})
    return {"ok": True}


# ---------------- Admin: Radio Settings ----------------
class RadioSettings(BaseModel):
    station_name: Optional[str] = None
    stream_url: Optional[str] = None
    backup_url: Optional[str] = None
    metadata_url: Optional[str] = None
    refresh_interval: Optional[int] = None
    is_live: Optional[bool] = None
    title: Optional[str] = None
    artist: Optional[str] = None
    artwork: Optional[str] = None
    live_watch_url: Optional[str] = None
    live_links: Optional[Dict[str, str]] = None
    azuracast_api_key: Optional[str] = None
    station_shortcode: Optional[str] = None


def _mask_radio(doc: dict) -> dict:
    doc.pop("_id", None)
    key = doc.pop("azuracast_api_key", None) or AZURACAST_API_KEY_ENV
    doc["has_api_key"] = bool(key)
    doc["station_shortcode"] = doc.get("station_shortcode") or AZURACAST_STATION_ENV
    return doc


@api_router.get("/admin/radio")
async def admin_get_radio(admin=Depends(require_perm("radio"))):
    doc = await db.live_status.find_one({"_id": "current"}) or {}
    return _mask_radio(doc)


@api_router.put("/admin/radio")
async def admin_update_radio(body: RadioSettings, admin=Depends(require_perm("radio"))):
    updates = body.model_dump(exclude_unset=True)
    # Blank api-key input must not wipe an existing/env key.
    if "azuracast_api_key" in updates and not (updates["azuracast_api_key"] or "").strip():
        updates.pop("azuracast_api_key")
    if updates:
        await db.live_status.update_one({"_id": "current"}, {"$set": updates}, upsert=True)
    doc = await db.live_status.find_one({"_id": "current"}) or {}
    return _mask_radio(doc)


# ---------------- Radio Control Center ----------------
async def _radio_status_payload():
    key, station, doc = await _az_conf()
    out = {
        "controls_available": bool(key),
        "backend_running": None,
        "frontend_running": None,
        "is_online": False,
        "listeners": None,
        "title": doc.get("title") or "In Diretta",
        "artist": doc.get("artist") or doc.get("station_name") or "Pescatori di Uomini",
        "artwork": doc.get("artwork") or DEFAULT_ART,
        "live_mode": bool(doc.get("live_mode")),
        "live_watch_url": doc.get("live_watch_url") or "",
        "live_links": doc.get("live_links") or {},
        "station_shortcode": station,
        "status_error": None,
    }
    # Public now-playing (no key required)
    try:
        async with httpx.AsyncClient(timeout=8) as hc:
            r = await hc.get(doc.get("metadata_url") or AZ_NOWPLAYING_URL)
            r.raise_for_status()
            data = r.json()
        song = (data.get("now_playing") or {}).get("song") or {}
        out["is_online"] = bool(data.get("is_online", False))
        out["listeners"] = (data.get("listeners") or {}).get("current")
        if song.get("title"):
            out["title"] = song.get("title")
        if song.get("artist"):
            out["artist"] = song.get("artist")
        if song.get("art"):
            out["artwork"] = song.get("art")
    except Exception as e:
        logger.info("radio status nowplaying failed: %s", e)
    # Icecast (frontend) + Liquidsoap (backend) service state — needs the API key
    if key:
        try:
            st = await az_api("GET", f"/station/{station}/status", key)
            out["backend_running"] = st.get("backendRunning")
            out["frontend_running"] = st.get("frontendRunning")
        except Exception as e:
            out["status_error"] = f"{e}"
    return out


@api_router.get("/admin/radio/status")
async def admin_radio_status(admin=Depends(require_perm("radio"))):
    return await _radio_status_payload()


class RadioControlIn(BaseModel):
    action: str  # start | stop | restart


@api_router.post("/admin/radio/control")
async def admin_radio_control(body: RadioControlIn, admin=Depends(require_perm("radio"))):
    key, station, _ = await _az_conf()
    if not key:
        raise HTTPException(status_code=400, detail="API key AzuraCast non configurata")
    a = body.action
    label = {"start": "avviato", "stop": "fermato", "restart": "riavviato"}.get(a)
    if not label:
        raise HTTPException(status_code=400, detail="Azione non valida")
    try:
        if a == "restart":
            await az_api("POST", f"/station/{station}/restart", key)
        elif a == "start":
            # Idempotent: only start services that are not already running.
            try:
                st = await az_api("GET", f"/station/{station}/status", key)
            except Exception:
                st = {}
            if not st.get("backendRunning"):
                await az_api("POST", f"/station/{station}/backend/start", key)
            if not st.get("frontendRunning"):
                await az_api("POST", f"/station/{station}/frontend/start", key)
        else:  # stop
            try:
                st = await az_api("GET", f"/station/{station}/status", key)
            except Exception:
                st = {"backendRunning": True, "frontendRunning": True}
            if st.get("frontendRunning"):
                await az_api("POST", f"/station/{station}/frontend/stop", key)
            if st.get("backendRunning"):
                await az_api("POST", f"/station/{station}/backend/stop", key)
    except Exception as e:
        logger.error("radio control %s failed: %s", a, e)
        raise HTTPException(status_code=502, detail=f"Errore AzuraCast: {e}")
    await log_activity(admin, f"ha {label} la radio", "radio", {"action": a})
    return {"ok": True, "status": await _radio_status_payload()}


class LiveModeIn(BaseModel):
    action: str  # start | end
    watch_url: Optional[str] = None


@api_router.post("/admin/radio/live")
async def admin_radio_live(body: LiveModeIn, admin=Depends(require_perm("radio"))):
    key, station, _ = await _az_conf()
    if body.action == "start":
        if key:
            try:
                await az_api("POST", f"/station/{station}/backend/stop", key)  # pause AutoDJ
            except Exception as e:
                logger.warning("live start backend/stop failed: %s", e)
        updates = {"live_mode": True}
        if body.watch_url is not None:
            updates["live_watch_url"] = body.watch_url.strip()
        await db.live_status.update_one({"_id": "current"}, {"$set": updates}, upsert=True)
        await log_activity(admin, "ha avviato la Diretta LIVE", "radio")
        await notify_category("live", "Siamo in diretta! 🔴",
                              "La radio è in diretta ora. Tocca per ascoltare o guardare.",
                              action_url="/", admin_email=admin.get("email"))
    elif body.action == "end":
        if key:
            try:
                await az_api("POST", f"/station/{station}/backend/start", key)  # resume AutoDJ
            except Exception as e:
                logger.warning("live end backend/start failed: %s", e)
        await db.live_status.update_one({"_id": "current"}, {"$set": {"live_mode": False}}, upsert=True)
        await log_activity(admin, "ha terminato la Diretta LIVE", "radio")
    else:
        raise HTTPException(status_code=400, detail="Azione non valida")
    return {"ok": True, "status": await _radio_status_payload()}


# ---------------- Admin: General Settings ----------------
class GeneralSettings(BaseModel):
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    whatsapp: Optional[str] = None
    website: Optional[str] = None
    about_short: Optional[str] = None
    # "Chi Siamo" page content (editable from Admin)
    about_title: Optional[str] = None
    about_verse: Optional[str] = None
    about_description: Optional[str] = None
    about_card1_title: Optional[str] = None
    about_card1_text: Optional[str] = None
    about_card2_title: Optional[str] = None
    about_card2_text: Optional[str] = None
    about_card3_title: Optional[str] = None
    about_card3_text: Optional[str] = None
    about_quote: Optional[str] = None


# Default "Chi Siamo" content (seeded once; fully editable from Admin > Impostazioni).
ABOUT_DEFAULTS = {
    "about_title": "Pescatori di Uomini",
    "about_verse": "\"Venite dietro a me e vi farò pescatori di uomini.\" — Matteo 4:19",
    "about_description": (
        "Pescatori di Uomini è una web radio cristiana nata per annunciare il Vangelo attraverso la musica, la Parola di Dio, i podcast e le dirette.\n\n"
        "Il nostro desiderio è utilizzare gli strumenti digitali per raggiungere chiunque abbia bisogno di speranza, incoraggiamento e di un incontro autentico con Gesù Cristo.\n\n"
        "Ogni giorno vogliamo offrire contenuti che edificano la fede, accompagnano il cammino spirituale e fanno sentire ogni ascoltatore parte di una grande famiglia cristiana.\n\n"
        "La radio è aperta a tutti: a chi già vive la fede, a chi è in ricerca e a chi desidera semplicemente fermarsi qualche minuto per ascoltare una parola di speranza."
    ),
    "about_card1_title": "La Parola al centro",
    "about_card1_text": "Ogni trasmissione nasce dalla Sacra Scrittura e desidera mettere Gesù Cristo al centro di ogni messaggio, perché la Bibbia è la nostra guida e il fondamento di tutto ciò che condividiamo.",
    "about_card2_title": "Una comunità per tutti",
    "about_card2_text": "Pescatori di Uomini è un luogo di incontro, ascolto e condivisione. Giovani, famiglie, bambini e adulti possono trovare musica cristiana, insegnamenti biblici, testimonianze, momenti di preghiera e dirette pensate per crescere insieme nella fede.",
    "about_card3_title": "La nostra missione",
    "about_card3_text": "Annunciare il Vangelo attraverso la radio e i mezzi digitali, portando un messaggio di speranza, amore e salvezza ovunque ci sia una persona pronta ad ascoltare.",
    "about_quote": "\"Una voce che porta il Vangelo, una radio che unisce nella fede.\"",
}


@api_router.get("/admin/settings")
async def admin_get_settings(admin=Depends(require_admin)):
    doc = await db.settings.find_one({"_id": "general"}) or {}
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/settings")
async def admin_update_settings(body: GeneralSettings, admin=Depends(require_admin)):
    updates = body.model_dump(exclude_unset=True)
    if updates:
        await db.settings.update_one({"_id": "general"}, {"$set": updates}, upsert=True)
    doc = await db.settings.find_one({"_id": "general"}) or {}
    doc.pop("_id", None)
    return doc


# ---------------- Merchandising: Products ----------------
MERCH_CATEGORIES = ["Abbigliamento", "Cappelli", "Tazze", "Accessori", "Libri", "Altro"]
PRODUCT_AVAILABILITY = ["available", "coming_soon", "sold_out"]


class ProductIn(BaseModel):
    name: str
    description: Optional[str] = ""
    long_description: Optional[str] = ""
    category: Optional[str] = "Altro"
    price: Optional[str] = ""
    images: Optional[List[str]] = []
    colors: Optional[List[str]] = []
    sizes: Optional[List[str]] = []
    availability: Optional[str] = "available"
    featured: Optional[bool] = False
    published: Optional[bool] = True


class ProductEdit(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    long_description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[str] = None
    images: Optional[List[str]] = None
    colors: Optional[List[str]] = None
    sizes: Optional[List[str]] = None
    availability: Optional[str] = None
    featured: Optional[bool] = None
    published: Optional[bool] = None


# ---- Public ----
@api_router.get("/products")
async def get_products(search: Optional[str] = None, category: Optional[str] = None):
    query = {"published": {"$ne": False}}
    if category and category != "Tutti":
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": re.escape(search), "$options": "i"}},
            {"description": {"$regex": re.escape(search), "$options": "i"}},
            {"category": {"$regex": re.escape(search), "$options": "i"}},
        ]
    docs = await db.products.find(query, {"_id": 0}).sort([("featured", -1), ("order", 1)]).to_list(500)
    return docs


@api_router.get("/products/categories")
async def product_categories():
    return ["Tutti"] + MERCH_CATEGORIES


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return doc


# ---- Admin ----
@api_router.get("/admin/products")
async def admin_products(status: Optional[str] = None, category: Optional[str] = None,
                         search: Optional[str] = None, admin=Depends(require_perm("merch"))):
    query = {}
    if status == "published":
        query["published"] = True
    elif status == "hidden":
        query["published"] = {"$ne": True}
    elif status == "featured":
        query["featured"] = True
    if category and category != "Tutti":
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": re.escape(search), "$options": "i"}},
            {"description": {"$regex": re.escape(search), "$options": "i"}},
        ]
    docs = await db.products.find(query, {"_id": 0}).sort([("featured", -1), ("order", 1)]).to_list(500)
    return docs


@api_router.get("/admin/products/{product_id}")
async def admin_get_product(product_id: str, admin=Depends(require_perm("merch"))):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return doc


@api_router.post("/admin/products", status_code=201)
async def admin_create_product(body: ProductIn, admin=Depends(require_perm("merch"))):
    if body.availability not in PRODUCT_AVAILABILITY:
        raise HTTPException(status_code=400, detail="Disponibilità non valida")
    doc = body.model_dump()
    doc["id"] = new_id("prod")
    doc["created_at"] = now_utc()
    doc["order"] = await db.products.count_documents({})
    await db.products.insert_one(dict(doc))
    await log_activity(admin, f"ha aggiunto il prodotto \"{doc.get('name', '')}\" al merchandising", "merch", {"id": doc["id"]})
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/products/{product_id}")
async def admin_edit_product(product_id: str, body: ProductEdit, admin=Depends(require_perm("merch"))):
    updates = body.model_dump(exclude_unset=True)
    if "availability" in updates and updates["availability"] not in PRODUCT_AVAILABILITY:
        raise HTTPException(status_code=400, detail="Disponibilità non valida")
    if updates:
        await db.products.update_one({"id": product_id}, {"$set": updates})
    await log_activity(admin, "ha modificato un prodotto del merchandising", "merch", {"id": product_id})
    return {"ok": True}


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin=Depends(require_perm("merch"))):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


@api_router.post("/admin/products/reorder")
async def admin_reorder_products(body: dict, admin=Depends(require_perm("merch"))):
    ids = body.get("ids", [])
    for i, pid in enumerate(ids):
        await db.products.update_one({"id": pid}, {"$set": {"order": i}})
    return {"ok": True}

# ---------------- Donations (Stripe, test mode) ----------------
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)
from fastapi import Request

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
PRESET_AMOUNTS = [5.0, 10.0, 25.0, 50.0, 100.0]
MIN_DONATION = 1.0
MAX_DONATION = 5000.0

# Official Stripe SDK — used for subscriptions (monthly donations) and multi-line-item
# merch orders, which the emergentintegrations helper does not cover. Same env key.
import asyncio
import stripe as stripe_sdk
if STRIPE_API_KEY:
    stripe_sdk.api_key = STRIPE_API_KEY
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Monthly donation plans (EUR/month) -> Stripe recurring prices, provisioned lazily & idempotently.
MONTHLY_PLANS = {"5": 500, "10": 1000, "20": 2000}
_price_cache: Dict[str, str] = {}


async def _get_or_create_monthly_price(plan: str) -> str:
    """Return the Stripe Price ID for a monthly plan, creating Product+Price once (idempotent via lookup_key)."""
    if plan in _price_cache:
        return _price_cache[plan]
    lookup = f"pdu_monthly_{plan}"

    def _work():
        found = stripe_sdk.Price.list(lookup_keys=[lookup], active=True, limit=1)
        if found.data:
            return found.data[0].id
        product = stripe_sdk.Product.create(name=f"Sostegno mensile €{plan}/mese - Pescatori di Uomini")
        price = stripe_sdk.Price.create(
            product=product.id, unit_amount=MONTHLY_PLANS[plan], currency="eur",
            recurring={"interval": "month"}, lookup_key=lookup,
        )
        return price.id

    pid = await asyncio.to_thread(_work)
    _price_cache[plan] = pid
    return pid


def _parse_price_eur(s: Optional[str]) -> Optional[float]:
    """Extract a EUR amount from a free-form product price string (e.g. '€15', '15,00 €')."""
    m = re.search(r"(\d+(?:[.,]\d{1,2})?)", s or "")
    if not m:
        return None
    return round(float(m.group(1).replace(",", ".")), 2)


async def get_optional_user(authorization: Optional[str]):
    """Return the authenticated user doc if a valid token is present, else None."""
    if not authorization:
        return None
    try:
        return await get_current_user(authorization)
    except Exception:
        return None


def _stripe_client(request: Request) -> StripeCheckout:
    # Build the absolute webhook URL from the incoming request (behind the /api ingress).
    base = str(request.base_url).rstrip("/")
    webhook_url = f"{base}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


class DonationCheckoutIn(BaseModel):
    amount: float
    origin_url: str
    donor_name: Optional[str] = None
    donor_email: Optional[str] = None
    message: Optional[str] = None
    anonymous: bool = False


@api_router.post("/donations/checkout")
async def create_donation_checkout(body: DonationCheckoutIn, request: Request,
                                    authorization: Optional[str] = Header(None)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Donazioni non configurate")
    # SECURITY: the amount is validated server-side; never trust arbitrary client values.
    amount = round(float(body.amount), 2)
    if amount < MIN_DONATION or amount > MAX_DONATION:
        raise HTTPException(status_code=400, detail=f"Importo non valido (min €{MIN_DONATION:.0f}, max €{MAX_DONATION:.0f})")

    user = await get_optional_user(authorization)
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/donation-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/donate"

    metadata = {
        "type": "donation",
        "anonymous": "true" if body.anonymous else "false",
    }
    if user:
        metadata["user_id"] = user["user_id"]
    if body.donor_email:
        metadata["donor_email"] = body.donor_email[:120]

    def _create():
        return stripe_sdk.checkout.Session.create(
            mode="payment",
            line_items=[{
                "quantity": 1,
                "price_data": {
                    "currency": "eur",
                    "unit_amount": int(round(amount * 100)),
                    "product_data": {"name": "Donazione - Pescatori di Uomini"},
                },
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
            **({"customer_email": body.donor_email} if body.donor_email else {}),
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error("Stripe donation error: %s", e)
        raise HTTPException(status_code=400, detail="Impossibile avviare la donazione")

    await db.donation_transactions.insert_one({
        "id": new_id("don"),
        "session_id": session.id,
        "user_id": user["user_id"] if user else None,
        "donor_name": (body.donor_name or (user.get("name") if user else None)),
        "donor_email": (body.donor_email or (user.get("email") if user else None)),
        "message": body.message,
        "anonymous": bool(body.anonymous),
        "amount": amount,
        "currency": "eur",
        "frequency": "one_time",
        "payment_status": "initiated",
        "status": "open",
        "processed": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    })

    return {"url": session.url, "session_id": session.id}


async def _finalize_donation(session_id: str, payment_status: str, status: str,
                             amount_total: Optional[int] = None, currency: Optional[str] = None):
    """Idempotently update a donation transaction from a Stripe status/webhook event."""
    tx = await db.donation_transactions.find_one({"session_id": session_id})
    if not tx:
        return None
    update = {"payment_status": payment_status, "status": status, "updated_at": now_utc()}
    newly_paid = payment_status == "paid" and not tx.get("processed")
    if newly_paid:
        update["processed"] = True
        update["paid_at"] = now_utc()
        if amount_total is not None:
            update["amount"] = round(amount_total / 100, 2)
        if currency:
            update["currency"] = currency
    await db.donation_transactions.update_one({"session_id": session_id}, {"$set": update})
    return {**tx, **update}


@api_router.get("/donations/status/{session_id}")
async def donation_status(session_id: str, request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Donazioni non configurate")

    def _retrieve():
        return stripe_sdk.checkout.Session.retrieve(session_id)

    try:
        s = await asyncio.to_thread(_retrieve)
    except Exception as e:
        logger.error("Stripe status error: %s", e)
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    payment_status = s.get("payment_status") or "unpaid"
    status = s.get("status") or "open"
    amount_total = s.get("amount_total")
    currency = s.get("currency")
    await _finalize_donation(session_id, payment_status, status, amount_total, currency)
    return {
        "session_id": session_id,
        "status": status,
        "payment_status": payment_status,
        "amount": round((amount_total or 0) / 100, 2),
        "currency": currency,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    # Confirmation also happens via status polling; the webhook is a secure backup.
    if not STRIPE_WEBHOOK_SECRET:
        return {"received": True, "verified": False}
    try:
        event = stripe_sdk.Webhook.construct_event(body, signature, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.error("Stripe webhook error: %s", e)
        raise HTTPException(status_code=400, detail="Webhook non valido")
    if event.get("type", "").startswith("checkout.session"):
        obj = event["data"]["object"]
        session_id = obj.get("id")
        payment_status = obj.get("payment_status") or "unpaid"
        status = "complete" if payment_status == "paid" else (obj.get("status") or "open")
        await _finalize_donation(session_id, payment_status, status,
                                 obj.get("amount_total"), obj.get("currency"))
        # Also finalize merch orders (no-op if the session is not an order).
        await _finalize_order(session_id)
    return {"received": True}


# ---------------- Monthly donation subscriptions (Stripe subscription mode) ----------------
class SubscribeIn(BaseModel):
    plan: str  # "5" | "10" | "20"
    origin_url: str
    donor_email: Optional[str] = None


@api_router.post("/donations/subscribe")
async def create_subscription_checkout(body: SubscribeIn, request: Request,
                                       authorization: Optional[str] = Header(None)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Donazioni non configurate")
    if body.plan not in MONTHLY_PLANS:
        raise HTTPException(status_code=400, detail="Piano non valido")
    user = await get_optional_user(authorization)
    origin = body.origin_url.rstrip("/")
    metadata = {"type": "subscription", "plan": body.plan}
    if user:
        metadata["user_id"] = user["user_id"]

    try:
        price_id = await _get_or_create_monthly_price(body.plan)

        def _create():
            return stripe_sdk.checkout.Session.create(
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=f"{origin}/donation-success?session_id={{CHECKOUT_SESSION_ID}}&type=sub",
                cancel_url=f"{origin}/donate",
                metadata=metadata,
                **({"customer_email": body.donor_email} if body.donor_email else {}),
            )

        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error("Stripe subscribe error: %s", e)
        raise HTTPException(status_code=400, detail="Impossibile avviare l'abbonamento")

    await db.donation_transactions.insert_one({
        "id": new_id("don"), "session_id": session.id,
        "user_id": user["user_id"] if user else None,
        "donor_email": body.donor_email or (user.get("email") if user else None),
        "amount": MONTHLY_PLANS[body.plan] / 100, "currency": "eur",
        "frequency": "monthly", "plan": body.plan,
        "payment_status": "initiated", "status": "open", "processed": False,
        "created_at": now_utc(), "updated_at": now_utc(),
    })
    return {"url": session.url, "session_id": session.id}


# ---------------- Merchandising orders (Stripe payment mode, multi line-item) ----------------
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = 1
    size: Optional[str] = None
    color: Optional[str] = None


class DeliveryIn(BaseModel):
    method: str  # "shipping" | "pickup"
    name: str
    surname: Optional[str] = ""
    phone: str
    address: Optional[str] = ""
    cap: Optional[str] = ""
    city: Optional[str] = ""
    province: Optional[str] = ""


class OrderCheckoutIn(BaseModel):
    items: List[OrderItemIn]
    delivery: DeliveryIn
    origin_url: str
    note: Optional[str] = ""


def _order_number() -> str:
    return f"PDU-{now_utc().strftime('%y%m%d')}-{secrets.token_hex(2).upper()}"


@api_router.post("/orders/checkout")
async def create_order_checkout(body: OrderCheckoutIn, request: Request,
                                authorization: Optional[str] = Header(None)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Pagamenti non configurati")
    if not body.items:
        raise HTTPException(status_code=400, detail="Carrello vuoto")
    if body.delivery.method not in ("shipping", "pickup"):
        raise HTTPException(status_code=400, detail="Metodo di consegna non valido")
    if not body.delivery.name.strip() or not body.delivery.phone.strip():
        raise HTTPException(status_code=400, detail="Nome e telefono sono obbligatori")
    if body.delivery.method == "shipping":
        d = body.delivery
        if not all([(d.surname or "").strip(), (d.address or "").strip(), (d.cap or "").strip(),
                    (d.city or "").strip(), (d.province or "").strip()]):
            raise HTTPException(status_code=400, detail="Compila tutti i dati di spedizione")

    user = await get_optional_user(authorization)
    line_items = []
    order_items = []
    total = 0.0
    for it in body.items:
        prod = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not prod or prod.get("published") is False:
            raise HTTPException(status_code=404, detail="Prodotto non disponibile")
        if prod.get("availability") == "sold_out":
            raise HTTPException(status_code=400, detail=f"'{prod.get('name')}' è esaurito")
        # SECURITY: price is taken from the DB, never from the client.
        eur = _parse_price_eur(prod.get("price"))
        if not eur or eur <= 0:
            raise HTTPException(status_code=400, detail=f"Prezzo non disponibile per '{prod.get('name')}'")
        qty = max(1, min(int(it.quantity or 1), 99))
        opts = " · ".join([x for x in [it.size, it.color] if x])
        name = prod.get("name", "Prodotto") + (f" ({opts})" if opts else "")
        line_items.append({
            "quantity": qty,
            "price_data": {
                "currency": "eur", "unit_amount": int(round(eur * 100)),
                "product_data": {"name": name, **({"images": prod["images"][:1]} if prod.get("images") and str(prod["images"][0]).startswith("http") else {})},
            },
        })
        order_items.append({"product_id": it.product_id, "name": prod.get("name"), "options": opts,
                            "size": it.size, "color": it.color, "quantity": qty,
                            "unit_price": eur, "line_total": round(eur * qty, 2)})
        total += eur * qty

    order_number = _order_number()
    origin = body.origin_url.rstrip("/")
    metadata = {"type": "order", "order_number": order_number}
    if user:
        metadata["user_id"] = user["user_id"]

    def _create():
        return stripe_sdk.checkout.Session.create(
            mode="payment", line_items=line_items,
            success_url=f"{origin}/order-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/merch",
            metadata=metadata,
            phone_number_collection={"enabled": False},
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error("Stripe order error: %s", e)
        raise HTTPException(status_code=400, detail="Impossibile avviare il pagamento")

    order_doc = {
        "id": new_id("ord"), "order_number": order_number, "session_id": session.id,
        "user_id": user["user_id"] if user else None,
        "items": order_items, "total": round(total, 2), "currency": "eur",
        "delivery": body.delivery.model_dump(), "note": body.note or "",
        "customer_name": body.delivery.name, "customer_phone": body.delivery.phone,
        "payment_status": "initiated", "status": "pending", "processed": False,
        "created_at": now_utc(), "updated_at": now_utc(),
    }
    await db.orders.insert_one(dict(order_doc))
    return {"url": session.url, "session_id": session.id, "order_number": order_number}


async def _finalize_order(session_id: str):
    order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if not order:
        return None

    def _retrieve():
        return stripe_sdk.checkout.Session.retrieve(session_id)

    try:
        s = await asyncio.to_thread(_retrieve)
    except Exception:
        return order
    payment_status = "paid" if s.get("payment_status") == "paid" else (s.get("payment_status") or "unpaid")
    update = {"payment_status": payment_status, "updated_at": now_utc()}
    if payment_status == "paid" and not order.get("processed"):
        update.update({"processed": True, "status": "paid", "paid_at": now_utc()})
    await db.orders.update_one({"session_id": session_id}, {"$set": update})
    return {**order, **update}


@api_router.get("/orders/status/{session_id}")
async def order_status(session_id: str):
    order = await _finalize_order(session_id)
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    return {
        "order_number": order.get("order_number"), "payment_status": order.get("payment_status"),
        "status": order.get("status"), "items": order.get("items", []),
        "total": order.get("total"), "currency": order.get("currency", "eur"),
        "delivery": order.get("delivery"), "note": order.get("note", ""),
        "created_at": order.get("created_at"),
    }


@api_router.get("/admin/orders")
async def admin_orders(status: Optional[str] = None, admin=Depends(require_perm("merch"))):
    query: dict = {}
    if status:
        query["status"] = status
    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.patch("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, body: dict, admin=Depends(require_perm("merch"))):
    allowed = {k: v for k, v in body.items() if k in ("status", "tracking", "note")}
    if allowed:
        allowed["updated_at"] = now_utc()
        await db.orders.update_one({"id": order_id}, {"$set": allowed})
    return {"ok": True}


@api_router.get("/me/donations")
async def my_donations(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    docs = await db.donation_transactions.find(
        {"user_id": user["user_id"], "payment_status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return docs


@api_router.get("/admin/donations")
async def admin_donations(admin=Depends(require_admin)):
    docs = await db.donation_transactions.find(
        {"payment_status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/admin/donations/stats")
async def admin_donation_stats(admin=Depends(require_admin)):
    paid = await db.donation_transactions.find({"payment_status": "paid"}, {"_id": 0}).to_list(5000)
    total = round(sum(d.get("amount", 0) for d in paid), 2)
    count = len(paid)
    avg = round(total / count, 2) if count else 0.0
    donors = len({d.get("user_id") or d.get("donor_email") or d.get("id") for d in paid})
    # Last 30 days
    cutoff = now_utc() - timedelta(days=30)
    recent = 0.0
    for d in paid:
        ts = d.get("paid_at") or d.get("created_at")
        if ts and (ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts) >= cutoff:
            recent += d.get("amount", 0)
    return {
        "total": total,
        "count": count,
        "average": avg,
        "donors": donors,
        "last_30_days": round(recent, 2),
        "currency": "eur",
    }




# ==================== Notifications & Account extras ====================

# ---- Emergent managed push relay (SuprSend) ----
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
push_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)

NOTIF_CATEGORIES = ["podcasts", "meditations", "news", "live", "announcements", "events", "prayers", "verse"]
CATEGORY_LABELS = {
    "podcasts": "Podcast", "meditations": "Meditazioni", "news": "Notizie",
    "live": "Dirette", "announcements": "Annunci", "events": "Eventi in programma",
    "prayers": "Richieste di preghiera", "verse": "Versetto del Giorno",
}


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    try:
        resp = await push_client.post("/api/v1/push/users/register", json=body.model_dump())
    except Exception as e:
        logger.warning("register-push relay error: %s", e)
        raise HTTPException(502, "Push provider non raggiungibile")
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY mancante o non valida")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider non disponibile")
    resp.raise_for_status()
    return {"status": "registered"}


async def send_push(recipients: List[str], data: dict, idempotency_key: Optional[str] = None) -> None:
    """Relay a push to the Emergent managed service. Recipients are user_ids (max 100/call)."""
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    for i in range(0, len(recipients), 100):
        chunk = recipients[i:i + 100]
        payload: dict = {"recipients": chunk, "data": data}
        if idempotency_key:
            payload["$idempotency_key"] = f"{idempotency_key}:{i}"
        resp = await push_client.post("/api/v1/push/trigger", json=payload)
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY mancante o non valida")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider non disponibile")
        resp.raise_for_status()


async def _recipients_for_category(category: str) -> List[str]:
    # Enabled by default: only exclude users who explicitly disabled the category or are suspended.
    users = await db.users.find(
        {"status": {"$ne": "suspended"}, f"notif_prefs.{category}": {"$ne": False}},
        {"_id": 0, "user_id": 1},
    ).to_list(10000)
    return [u["user_id"] for u in users if u.get("user_id")]


async def notify_category(category: str, title: str, message: str, action_url: Optional[str] = None,
                          admin_email: Optional[str] = None) -> int:
    """Send a category push to all opted-in users and record it in the log. Never raises."""
    recipients = await _recipients_for_category(category)
    data = {"title": title, "message": message}
    if action_url:
        data["action_url"] = action_url
    status = "sent"
    try:
        await send_push(recipients, data, idempotency_key=new_id("ntf"))
    except Exception as e:
        logger.warning("Push nativa non inviata (%s): %s", category, e)
        status = "failed"
    # Web Push (PWA) — independent channel, never blocks or raises.
    web_sent = 0
    try:
        web_sent = await send_web_push(recipients, data)
    except Exception as e:
        logger.warning("Web push non inviata (%s): %s", category, e)
    await db.notifications_log.insert_one({
        "id": new_id("nlog"),
        "category": category,
        "title": title,
        "message": message,
        "action_url": action_url,
        "recipients": len(recipients),
        "web_delivered": web_sent,
        "status": status,
        "sent_by": admin_email,
        "created_at": now_utc(),
    })
    return len(recipients)


# ---- Web Push (PWA / VAPID) — standard self-hosted push for the installed web app ----
# Keys are generated once and stored in `app_config` so they stay stable per
# environment (regenerating would invalidate existing browser subscriptions).
_vapid_cache: dict = {}


async def _get_vapid() -> dict:
    if _vapid_cache.get("private_pem"):
        return _vapid_cache
    doc = await db.app_config.find_one({"_id": "webpush_vapid"})
    if not doc:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization
        priv = ec.generate_private_key(ec.SECP256R1())
        priv_pem = priv.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode()
        nums = priv.public_key().public_numbers()
        raw_pub = b"\x04" + nums.x.to_bytes(32, "big") + nums.y.to_bytes(32, "big")
        public_key = base64.urlsafe_b64encode(raw_pub).rstrip(b"=").decode()
        doc = {"_id": "webpush_vapid", "private_pem": priv_pem, "public_key": public_key}
        await db.app_config.insert_one(doc)
    _vapid_cache["private_pem"] = doc["private_pem"]
    _vapid_cache["public_key"] = doc["public_key"]
    return _vapid_cache


class WebPushSubscribeBody(BaseModel):
    user_id: Optional[str] = None
    subscription: dict


@api_router.get("/webpush/public-key")
async def webpush_public_key():
    v = await _get_vapid()
    return {"public_key": v["public_key"]}


@api_router.post("/webpush/subscribe", status_code=201)
async def webpush_subscribe(body: WebPushSubscribeBody):
    endpoint = (body.subscription or {}).get("endpoint")
    if not endpoint:
        raise HTTPException(400, "Subscription non valida")
    await _get_vapid()  # ensure keys exist
    await db.web_push_subs.update_one(
        {"endpoint": endpoint},
        {"$set": {
            "endpoint": endpoint,
            "user_id": body.user_id,
            "subscription": body.subscription,
            "updated_at": now_utc(),
        }, "$setOnInsert": {"id": new_id("wps"), "created_at": now_utc()}},
        upsert=True,
    )
    return {"status": "subscribed"}


@api_router.post("/webpush/unsubscribe")
async def webpush_unsubscribe(body: WebPushSubscribeBody):
    endpoint = (body.subscription or {}).get("endpoint")
    if endpoint:
        await db.web_push_subs.delete_one({"endpoint": endpoint})
    return {"status": "unsubscribed"}


@api_router.get("/admin/webpush/stats")
async def webpush_stats(admin=Depends(require_admin)):
    """Diagnostics: how many web-push devices are registered (total / logged-in / guest)."""
    total = await db.web_push_subs.count_documents({})
    anon = await db.web_push_subs.count_documents({"user_id": None})
    return {"total_devices": total, "registered_users": total - anon, "guest_devices": anon}


def _send_one_webpush(sub: dict, payload: str, vapid, claims: dict):
    from pywebpush import webpush, WebPushException
    try:
        # NOTE: vapid_private_key must be a Vapid object (or a base64 DER string).
        # Passing a PEM string here makes py-vapid's from_string fail to parse, so
        # we build the Vapid object from PEM in send_web_push and pass it through.
        webpush(subscription_info=sub, data=payload, vapid_private_key=vapid, vapid_claims=dict(claims), ttl=86400)
        return True, None
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        return False, code
    except Exception:
        return False, None


async def send_web_push(recipients: List[str], data: dict) -> int:
    """Deliver a Web Push to browser subscriptions. Targets both registered users
    who are recipients of this category AND anonymous (guest) devices that opted
    in via the notifications screen. Returns successful deliveries; prunes expired."""
    rec = recipients or []
    subs = await db.web_push_subs.find(
        {"$or": [{"user_id": {"$in": rec}}, {"user_id": None}]},
        {"_id": 0},
    ).to_list(10000)
    if not subs:
        return 0
    from py_vapid import Vapid01
    v = await _get_vapid()
    vapid = Vapid01.from_pem(v["private_pem"].encode())
    claims = {"sub": "mailto:pescatoridiuomini@outlook.it"}
    payload = json.dumps({
        "title": data.get("title", "Pescatori di Uomini"),
        "message": data.get("message", ""),
        "action_url": data.get("action_url", "/"),
    })
    delivered = 0
    stale: List[str] = []
    for s in subs:
        ok, code = await asyncio.to_thread(_send_one_webpush, s["subscription"], payload, vapid, claims)
        if ok:
            delivered += 1
        elif code in (404, 410):
            stale.append(s["endpoint"])
    if stale:
        await db.web_push_subs.delete_many({"endpoint": {"$in": stale}})
    return delivered


# ---- Password reset (email fallback shows code in response until Resend key is active) ----
class ForgotPwIn(BaseModel):
    email: str


class ResetPwIn(BaseModel):
    email: str
    code: str
    new_password: str


class ChangePwIn(BaseModel):
    current_password: Optional[str] = None
    new_password: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None


@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPwIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        # Do not reveal whether the email exists.
        return {"ok": True, "delivered": False}
    code = f"{secrets.randbelow(1000000):06d}"
    await db.password_resets.update_one(
        {"email": email},
        {"$set": {"email": email, "code": code, "expires_at": now_utc() + timedelta(minutes=30),
                  "created_at": now_utc()}},
        upsert=True,
    )
    html = (f"<p>Ciao {user.get('name') or ''},</p>"
            f"<p>Hai richiesto di reimpostare la password di <b>Pescatori di Uomini</b>.</p>"
            f"<p>Il tuo codice di verifica è: <b style='font-size:22px'>{code}</b></p>"
            f"<p>Il codice scade tra 30 minuti. Se non hai richiesto tu il reset, ignora questa email.</p>")
    delivered = await send_email(email, "Reimposta la tua password", html)
    # Fallback: expose the code in the response when email delivery is not configured.
    resp = {"ok": True, "delivered": delivered}
    if not delivered:
        resp["code"] = code
    return resp


@api_router.post("/auth/reset-password")
async def reset_password(body: ResetPwIn):
    email = body.email.lower().strip()
    rec = await db.password_resets.find_one({"email": email})
    if not rec or rec.get("code") != body.code.strip():
        raise HTTPException(status_code=400, detail="Codice non valido")
    exp = rec["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=400, detail="Codice scaduto. Richiedine uno nuovo.")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="La password deve avere almeno 6 caratteri")
    await db.users.update_one({"email": email}, {"$set": {"password": hash_pw(body.new_password)}})
    await db.password_resets.delete_one({"email": email})
    # Invalidate existing sessions for safety.
    user = await db.users.find_one({"email": email}, {"user_id": 1})
    if user:
        await db.user_sessions.delete_many({"user_id": user["user_id"]})
    return {"ok": True}


@api_router.post("/auth/change-password")
async def change_password(body: ChangePwIn, authorization: Optional[str] = Header(None)):
    current = await get_current_user(authorization)
    full = await db.users.find_one({"user_id": current["user_id"]})
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="La password deve avere almeno 6 caratteri")
    if full.get("password"):
        if not body.current_password or not check_pw(body.current_password, full["password"]):
            raise HTTPException(status_code=400, detail="Password attuale non corretta")
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": {"password": hash_pw(body.new_password)}})
    return {"ok": True}


@api_router.put("/auth/profile")
async def update_profile(body: ProfileIn, authorization: Optional[str] = Header(None)):
    current = await get_current_user(authorization)
    updates = {}
    if body.name is not None and body.name.strip():
        updates["name"] = body.name.strip()
    if body.picture is not None:
        updates["picture"] = body.picture
    if updates:
        await db.users.update_one({"user_id": current["user_id"]}, {"$set": updates})
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "password": 0})
    return user


# ---- Notification preferences ----
@api_router.delete("/auth/account")
async def delete_account(authorization: Optional[str] = Header(None)):
    """User-initiated account deletion (App Store / Play requirement)."""
    user = await get_current_user(authorization)
    uid = user["user_id"]
    # Preserve financial records but detach personal link.
    await db.donation_transactions.update_many({"user_id": uid}, {"$set": {"user_id": None, "anonymous": True}})
    await db.user_sessions.delete_many({"user_id": uid})
    if user.get("email"):
        await db.password_resets.delete_many({"email": user["email"].lower()})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True}


@api_router.get("/me/notifications")
async def get_notif_prefs(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    prefs = user.get("notif_prefs") or {}
    return {c: bool(prefs.get(c, True)) for c in NOTIF_CATEGORIES}


@api_router.put("/me/notifications")
async def set_notif_prefs(body: dict, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    prefs = {c: bool(body.get(c, True)) for c in NOTIF_CATEGORIES}
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"notif_prefs": prefs}})
    return prefs


# ---- Admin: manual notifications + delivery log ----
class AdminNotifyIn(BaseModel):
    category: str = "announcements"
    title: str
    message: str
    action_url: Optional[str] = None


@api_router.post("/admin/notifications/send")
async def admin_send_notification(body: AdminNotifyIn, admin=Depends(require_admin)):
    if body.category not in NOTIF_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoria non valida")
    if not body.title.strip() or not body.message.strip():
        raise HTTPException(status_code=400, detail="Titolo e messaggio sono obbligatori")
    count = await notify_category(body.category, body.title.strip(), body.message.strip(),
                                  body.action_url, admin_email=admin.get("email"))
    await log_activity(admin, f"ha inviato una notifica \"{body.title.strip()}\"", "notifications")
    return {"ok": True, "recipients": count}


@api_router.get("/admin/notifications")
async def admin_notifications_log(admin=Depends(require_admin)):
    docs = await db.notifications_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Mongo returns naive UTC datetimes; emit them with an explicit UTC offset so
    # the client converts to the device's local timezone (Europe/Rome) correctly.
    for d in docs:
        ca = d.get("created_at")
        if isinstance(ca, datetime):
            d["created_at"] = (ca.replace(tzinfo=timezone.utc) if ca.tzinfo is None else ca).isoformat()
    return docs


@api_router.get("/admin/notifications/audience")
async def admin_notification_audience(admin=Depends(require_admin)):
    """Recipient count per category for the admin preview."""
    out = {}
    for c in NOTIF_CATEGORIES:
        out[c] = len(await _recipients_for_category(c))
    return out



# ==================== Meditazioni (multi-format media) ====================
# Backward compatible with legacy docs that only had video_url + thumbnail.
class MeditationIn(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    speaker: Optional[str] = ""
    verse: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = "Generale"
    duration: Optional[str] = ""
    # Content: either an external link (video_url) OR an uploaded media_id.
    video_url: Optional[str] = ""
    media_id: Optional[str] = None
    media_type: Optional[str] = None   # video | audio | pdf | embed
    media_mime: Optional[str] = None
    media_filename: Optional[str] = None
    thumbnail: Optional[str] = None
    downloadable: Optional[bool] = True
    attachments: Optional[List[Dict]] = None  # [{id,name,mime,size}]
    published: Optional[bool] = False
    publish_date: Optional[str] = None


class MeditationEdit(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    speaker: Optional[str] = None
    verse: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    duration: Optional[str] = None
    video_url: Optional[str] = None
    media_id: Optional[str] = None
    media_type: Optional[str] = None
    media_mime: Optional[str] = None
    media_filename: Optional[str] = None
    thumbnail: Optional[str] = None
    downloadable: Optional[bool] = None
    attachments: Optional[List[Dict]] = None
    published: Optional[bool] = None
    publish_date: Optional[str] = None


def detect_provider(url: str) -> Optional[str]:
    """Recognise a public video/audio provider from a URL for in-app embedding."""
    if not url:
        return None
    u = url.lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "vimeo.com" in u:
        return "vimeo"
    if "tiktok.com" in u:
        return "tiktok"
    if "instagram.com" in u:
        return "instagram"
    if "facebook.com" in u or "fb.watch" in u:
        return "facebook"
    if "spotify.com" in u:
        return "spotify"
    return None


def _media_type_from_mime(mime: str) -> str:
    mime = (mime or "").lower()
    if mime.startswith("video"):
        return "video"
    if mime.startswith("audio"):
        return "audio"
    if mime.startswith("image"):
        return "image"
    if "pdf" in mime:
        return "pdf"
    return "file"


# Security: only these media kinds may be uploaded by admins.
ALLOWED_MEDIA_EXT = {
    "mp3", "wav", "m4a", "aac", "ogg", "flac",           # audio
    "mp4", "mov", "m4v", "webm",                          # video
    "jpg", "jpeg", "png", "webp",                         # image
    "pdf",                                                # documents
}
ALLOWED_MEDIA_MIME_PREFIX = ("audio/", "video/", "image/", "application/pdf")


def _validate_media(filename: str, mime: str):
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    mime = (mime or "").lower()
    if ext and ext not in ALLOWED_MEDIA_EXT:
        raise HTTPException(status_code=400, detail=f"Estensione non consentita: .{ext}")
    if not any(mime.startswith(p) or mime == p for p in ALLOWED_MEDIA_MIME_PREFIX):
        raise HTTPException(status_code=400, detail="Tipo di file non consentito")


def _optimize_image(path: Path) -> tuple:
    """Resize (max 1600px) + convert images to WebP for performance. Returns (new_path, mime, filename)."""
    try:
        from PIL import Image as _PImage
        img = _PImage.open(path)
        img = img.convert("RGBA") if img.mode in ("P", "LA") else img.convert("RGB") if img.mode != "RGB" else img
        w, h = img.size
        if max(w, h) > 1600:
            ratio = 1600 / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), _PImage.LANCZOS)
        out = path.with_suffix(".webp")
        img.save(out, "WEBP", quality=82, method=4)
        if out.exists() and out.stat().st_size > 0:
            return out, "image/webp", out.name
    except Exception:
        pass
    return path, None, None


def _ffmpeg_probe_duration(path: Path) -> str:
    """Return a human duration mm:ss / h:mm:ss using ffprobe (best-effort)."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=20,
        )
        secs = int(float(out.stdout.strip()))
        h, rem = divmod(secs, 3600)
        m, s = divmod(rem, 60)
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
    except Exception:
        return ""


def _ffmpeg_grab_frame(path: Path) -> Optional[str]:
    """Extract a poster frame ~1s in as a base64 JPEG (best-effort)."""
    try:
        out_path = path.with_suffix(".jpg")
        subprocess.run(
            ["ffmpeg", "-y", "-ss", "00:00:01", "-i", str(path),
             "-frames:v", "1", "-vf", "scale=640:-1", "-q:v", "4", str(out_path)],
            capture_output=True, timeout=25,
        )
        if out_path.exists() and out_path.stat().st_size > 0:
            data = out_path.read_bytes()
            out_path.unlink(missing_ok=True)
            return "data:image/jpeg;base64," + base64.b64encode(data).decode()
    except Exception:
        pass
    return None


async def _gridfs_delete(media_id: Optional[str]):
    if not media_id:
        return
    try:
        await fs_bucket.delete(ObjectId(media_id))
    except Exception:
        pass


# ---------------- Chunked upload (admin) ----------------
# Chunks are stored in MongoDB (shared by every worker/replica) keyed by
# (upload_id, offset). This makes uploads reliable regardless of how many
# backend processes/pods are running and behind any load balancer — the local
# /tmp filesystem is NOT shared, which caused "Upload non trovato" errors.
@api_router.post("/admin/uploads/init")
async def upload_init(body: Dict, admin=Depends(require_uploader)):
    filename = (body.get("filename") or "file").strip()
    mime = body.get("mime") or "application/octet-stream"
    _validate_media(filename, mime)
    upload_id = uuid.uuid4().hex
    await db.upload_sessions.insert_one({
        "_id": upload_id, "filename": filename, "mime": mime, "created_at": now_utc(),
    })
    return {"upload_id": upload_id}


@api_router.put("/admin/uploads/{upload_id}/chunk")
async def upload_chunk(upload_id: str, request: Request, admin=Depends(require_uploader)):
    sess = await db.upload_sessions.find_one({"_id": upload_id})
    if not sess:
        raise HTTPException(status_code=404, detail="Upload non trovato")
    data = await request.body()
    offset_h = request.headers.get("x-chunk-offset")
    if offset_h is not None:
        offset = int(offset_h)
    else:
        # Legacy client (no offset header): append sequentially via a running
        # counter kept on the session, so old frontends still upload correctly.
        prev = await db.upload_sessions.find_one_and_update(
            {"_id": upload_id},
            {"$inc": {"next_offset": len(data)}},
            return_document=ReturnDocument.BEFORE,
        )
        offset = (prev or {}).get("next_offset", 0)
    # Upsert by (upload_id, offset): a retried chunk overwrites the same region
    # instead of duplicating it, so retries are always safe.
    await db.upload_chunks.update_one(
        {"upload_id": upload_id, "offset": offset},
        {"$set": {"data": Binary(data), "size": len(data), "created_at": now_utc()}},
        upsert=True,
    )
    return {"ok": True}


_finalize_tasks: set = set()


async def _finalize_upload(upload_id: str):
    """Heavy finalization (assemble chunks + ffmpeg + write to GridFS) runs in
    the background so the HTTP `/complete` request returns instantly and never
    hits the edge/proxy timeout (which surfaced as a 520 without CORS headers on
    large videos). The client polls `/complete/status` for the result."""
    part = UPLOAD_TMP / (upload_id + ".assemble")
    try:
        sess = await db.upload_sessions.find_one({"_id": upload_id})
        if not sess:
            return
        filename = sess.get("filename") or "file"
        mime = sess.get("mime") or "application/octet-stream"
        media_type = _media_type_from_mime(mime)
        # Assemble the MongoDB chunks (in order) into a local temp file.
        with open(part, "wb") as fh:
            async for ch in db.upload_chunks.find({"upload_id": upload_id}).sort("offset", 1):
                fh.write(bytes(ch["data"]))
        if part.stat().st_size == 0:
            await db.upload_sessions.update_one({"_id": upload_id}, {"$set": {"status": "error", "error": "Nessun dato ricevuto"}})
            return
        duration = ""
        thumbnail = None
        if media_type in ("video", "audio"):
            duration = await asyncio.to_thread(_ffmpeg_probe_duration, part)
        if media_type == "video":
            thumbnail = await asyncio.to_thread(_ffmpeg_grab_frame, part)
        if media_type == "image":
            new_path, new_mime, new_name = await asyncio.to_thread(_optimize_image, part)
            if new_mime:
                if new_path != part:
                    part.unlink(missing_ok=True)
                    part = new_path
                mime, filename = new_mime, new_name
        grid_in = fs_bucket.open_upload_stream(filename, metadata={"contentType": mime})
        with open(part, "rb") as fh:
            while True:
                block = fh.read(8 * 1024 * 1024)
                if not block:
                    break
                await grid_in.write(block)
        await grid_in.close()
        size = part.stat().st_size
        await db.upload_sessions.update_one({"_id": upload_id}, {"$set": {
            "status": "done",
            "media_id": str(grid_in._id),
            "media_type": media_type,
            "media_mime": mime,
            "media_filename": filename,
            "size": size,
            "duration": duration,
            "thumbnail": thumbnail,
            "finished_at": now_utc(),
        }})
    except Exception as e:
        logger.exception("Upload finalization failed for %s", upload_id)
        await db.upload_sessions.update_one({"_id": upload_id}, {"$set": {"status": "error", "error": str(e)[:300]}})
    finally:
        part.unlink(missing_ok=True)
        await db.upload_chunks.delete_many({"upload_id": upload_id})


@api_router.post("/admin/uploads/{upload_id}/complete")
async def upload_complete(upload_id: str, admin=Depends(require_uploader)):
    sess = await db.upload_sessions.find_one({"_id": upload_id})
    if not sess:
        raise HTTPException(status_code=404, detail="Upload non trovato")
    filename = sess.get("filename") or "file"
    mime = sess.get("mime") or "application/octet-stream"
    _validate_media(filename, mime)
    # Kick off finalization in the background and return immediately so the
    # request cannot time out at the edge on large files.
    if sess.get("status") not in ("processing", "done"):
        await db.upload_sessions.update_one({"_id": upload_id}, {"$set": {"status": "processing"}})
        task = asyncio.create_task(_finalize_upload(upload_id))
        _finalize_tasks.add(task)
        task.add_done_callback(_finalize_tasks.discard)
    return {"status": "processing", "upload_id": upload_id}


@api_router.get("/admin/uploads/{upload_id}/complete/status")
async def upload_complete_status(upload_id: str, admin=Depends(require_uploader)):
    sess = await db.upload_sessions.find_one({"_id": upload_id})
    if not sess:
        raise HTTPException(status_code=404, detail="Upload non trovato")
    status = sess.get("status") or "pending"
    if status == "error":
        raise HTTPException(status_code=500, detail=sess.get("error") or "Errore durante la finalizzazione")
    resp = {"status": status}
    if status == "done":
        for k in ("media_id", "media_type", "media_mime", "media_filename", "size", "duration", "thumbnail"):
            resp[k] = sess.get(k)
        # Result delivered; drop the session so it doesn't linger.
        await db.upload_sessions.delete_one({"_id": upload_id})
    return resp


# ---------------- Media streaming (public, Range support) ----------------
@api_router.get("/media/{media_id}")
async def stream_media(media_id: str, request: Request, download: Optional[int] = 0):
    try:
        oid = ObjectId(media_id)
        grid_out = await fs_bucket.open_download_stream(oid)
    except Exception:
        raise HTTPException(status_code=404, detail="File non trovato")
    total = grid_out.length
    mime = (grid_out.metadata or {}).get("contentType") or "application/octet-stream"
    filename = grid_out.filename or "file"
    range_header = request.headers.get("range")
    disp = "attachment" if download else "inline"
    base_headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'{disp}; filename="{filename}"',
        "Cache-Control": "public, max-age=86400",
    }

    if range_header:
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        start = int(m.group(1)) if m else 0
        end = int(m.group(2)) if (m and m.group(2)) else total - 1
        end = min(end, total - 1)
        start = min(start, end)
        length = end - start + 1
        grid_out.seek(start)

        async def ranged():
            remaining = length
            while remaining > 0:
                block = await grid_out.read(min(1024 * 512, remaining))
                if not block:
                    break
                remaining -= len(block)
                yield block

        headers = {**base_headers, "Content-Range": f"bytes {start}-{end}/{total}",
                   "Content-Length": str(length)}
        return StreamingResponse(ranged(), status_code=206, media_type=mime, headers=headers)

    async def full():
        while True:
            block = await grid_out.read(1024 * 512)
            if not block:
                break
            yield block

    return StreamingResponse(full(), media_type=mime,
                             headers={**base_headers, "Content-Length": str(total)})


async def _flush_scheduled_meditations():
    """Fire the push notification for meditations whose scheduled publish time has arrived."""
    now_iso = now_utc().isoformat()
    due = await db.meditations.find(
        {"published": True, "notified": {"$ne": True}, "publish_date": {"$lte": now_iso}},
        {"_id": 0, "id": 1, "title": 1},
    ).to_list(50)
    for m in due:
        await db.meditations.update_one({"id": m["id"]}, {"$set": {"notified": True}})
        await notify_category("meditations", "Nuova meditazione", m.get("title", ""),
                              action_url=f"/meditazioni/{m['id']}")


def _decorate_meditation(doc: dict) -> dict:
    """Compute provider + content_type for the client (non-destructive)."""
    if not doc:
        return doc
    if doc.get("media_id") and doc.get("media_type"):
        doc["content_type"] = doc["media_type"]
        doc["provider"] = "upload"
    else:
        prov = detect_provider(doc.get("video_url") or "")
        doc["provider"] = prov
        doc["content_type"] = "embed" if prov else ("video" if doc.get("video_url") else "")
    return doc


@api_router.get("/meditations")
async def get_meditations(search: Optional[str] = None, category: Optional[str] = None):
    await _flush_scheduled_meditations()
    now_iso = now_utc().isoformat()
    query: dict = {"published": True, "publish_date": {"$lte": now_iso}}
    if category and category != "Tutti":
        query["category"] = category
    if search:
        query["title"] = {"$regex": re.escape(search), "$options": "i"}
    docs = await db.meditations.find(query, {"_id": 0}).sort("publish_date", -1).to_list(300)
    return [_decorate_meditation(d) for d in docs]


@api_router.get("/meditations/categories")
async def get_meditation_categories():
    cats = await db.meditations.distinct("category", {"published": True})
    return [c for c in cats if c]


@api_router.get("/meditations/{mid}")
async def get_meditation(mid: str):
    doc = await db.meditations.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Meditazione non trovata")
    return _decorate_meditation(doc)


@api_router.get("/admin/meditations")
async def admin_meditations(status: Optional[str] = None, search: Optional[str] = None,
                            admin=Depends(require_perm("meditations"))):
    await _flush_scheduled_meditations()
    query: dict = {}
    if status == "published":
        query["published"] = True
    elif status == "draft":
        query["published"] = {"$ne": True}
    if search:
        query["title"] = {"$regex": re.escape(search), "$options": "i"}
    docs = await db.meditations.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_decorate_meditation(d) for d in docs]


@api_router.get("/admin/meditations/{mid}")
async def admin_get_meditation(mid: str, admin=Depends(require_perm("meditations"))):
    doc = await db.meditations.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Meditazione non trovata")
    return _decorate_meditation(doc)


@api_router.post("/admin/meditations", status_code=201)
async def admin_create_meditation(body: MeditationIn, admin=Depends(require_perm("meditations"))):
    doc = body.model_dump()
    doc["id"] = new_id("med")
    doc["created_at"] = now_utc()
    if not doc.get("publish_date"):
        doc["publish_date"] = now_utc().isoformat()
    doc["notified"] = False
    await db.meditations.insert_one(dict(doc))
    await log_activity(admin, f"ha creato la meditazione \"{doc.get('title', '')}\"", "meditations", {"id": doc["id"]})
    if doc.get("published") and doc["publish_date"] <= now_utc().isoformat():
        await db.meditations.update_one({"id": doc["id"]}, {"$set": {"notified": True}})
        await notify_category("meditations", "Nuova meditazione", doc.get("title", ""),
                              action_url=f"/meditazioni/{doc['id']}", admin_email=admin.get("email"))
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/meditations/{mid}")
async def admin_edit_meditation(mid: str, body: MeditationEdit, admin=Depends(require_perm("meditations"))):
    updates = body.model_dump(exclude_unset=True)
    prev = await db.meditations.find_one({"id": mid})
    if not prev:
        raise HTTPException(status_code=404, detail="Meditazione non trovata")
    # If the uploaded media is being replaced, delete the previous GridFS file to avoid orphans.
    if "media_id" in updates and prev.get("media_id") and updates.get("media_id") != prev.get("media_id"):
        await _gridfs_delete(prev.get("media_id"))
    if updates:
        await db.meditations.update_one({"id": mid}, {"$set": updates})
    became_published = updates.get("published") is True and prev and not prev.get("published")
    if became_published and prev and not prev.get("notified"):
        m = await db.meditations.find_one({"id": mid}, {"title": 1, "publish_date": 1})
        if m and (m.get("publish_date") or "") <= now_utc().isoformat():
            await db.meditations.update_one({"id": mid}, {"$set": {"notified": True}})
            await notify_category("meditations", "Nuova meditazione", m.get("title", ""),
                                  action_url=f"/meditazioni/{mid}", admin_email=admin.get("email"))
    return {"ok": True}


@api_router.delete("/admin/meditations/{mid}")
async def admin_delete_meditation(mid: str, admin=Depends(require_perm("meditations"))):
    doc = await db.meditations.find_one({"id": mid}, {"media_id": 1, "attachments": 1})
    if doc:
        await _gridfs_delete(doc.get("media_id"))
        for att in (doc.get("attachments") or []):
            await _gridfs_delete(att.get("id"))
    await db.meditations.delete_one({"id": mid})
    return {"ok": True}


# ==================== Generic CMS content (modular, reusable per section) ====================
# One collection `contents` discriminated by `section`. New sections are enabled by simply
# adding their key here — no code rewrite. Media uses the shared GridFS upload or external URL.
CONTENT_SECTIONS = {
    "studi-biblici": "Studi Biblici",
    "predicazioni": "Predicazioni",
    "video": "Video",
    "eventi": "Eventi",
    "galleria": "Galleria",
    "download": "Download PDF",
}


class ContentIn(BaseModel):
    section: str
    title: str
    subtitle: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = "Generale"
    author: Optional[str] = ""
    tags: Optional[List[str]] = None
    thumbnail: Optional[str] = None
    media_id: Optional[str] = None
    media_type: Optional[str] = None
    media_mime: Optional[str] = None
    media_filename: Optional[str] = None
    video_url: Optional[str] = ""
    duration: Optional[str] = ""
    downloadable: Optional[bool] = True
    visibility: Optional[str] = "public"   # public | private
    order: Optional[int] = 0
    status: Optional[str] = "draft"        # draft | published | archived
    publish_date: Optional[str] = None


class ContentEdit(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    tags: Optional[List[str]] = None
    thumbnail: Optional[str] = None
    media_id: Optional[str] = None
    media_type: Optional[str] = None
    media_mime: Optional[str] = None
    media_filename: Optional[str] = None
    video_url: Optional[str] = None
    duration: Optional[str] = None
    downloadable: Optional[bool] = None
    visibility: Optional[str] = None
    order: Optional[int] = None
    status: Optional[str] = None
    publish_date: Optional[str] = None


def _check_section(section: str):
    if section not in CONTENT_SECTIONS:
        raise HTTPException(status_code=404, detail="Sezione non valida")


@api_router.get("/content-sections")
async def content_sections():
    return [{"key": k, "label": v} for k, v in CONTENT_SECTIONS.items()]


@api_router.get("/contents")
async def get_contents(section: str, search: Optional[str] = None,
                       category: Optional[str] = None, tag: Optional[str] = None):
    _check_section(section)
    now_iso = now_utc().isoformat()
    query: dict = {"section": section, "status": "published", "visibility": {"$ne": "private"},
                   "$or": [{"publish_date": {"$lte": now_iso}}, {"publish_date": None}]}
    if category and category != "Tutti":
        query["category"] = category
    if tag:
        query["tags"] = tag
    if search:
        query["title"] = {"$regex": re.escape(search), "$options": "i"}
    docs = await db.contents.find(query, {"_id": 0}).sort([("order", 1), ("publish_date", -1)]).to_list(300)
    return [_decorate_meditation(d) for d in docs]


@api_router.get("/contents/{cid}")
async def get_content(cid: str):
    doc = await db.contents.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    return _decorate_meditation(doc)


@api_router.get("/admin/contents")
async def admin_contents(section: str, status: Optional[str] = None, search: Optional[str] = None,
                         admin=Depends(require_admin)):
    _check_section(section)
    query: dict = {"section": section}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [{"title": {"$regex": re.escape(search), "$options": "i"}},
                        {"author": {"$regex": re.escape(search), "$options": "i"}},
                        {"category": {"$regex": re.escape(search), "$options": "i"}},
                        {"tags": {"$regex": re.escape(search), "$options": "i"}}]
    docs = await db.contents.find(query, {"_id": 0}).sort([("order", 1), ("created_at", -1)]).to_list(500)
    return [_decorate_meditation(d) for d in docs]


@api_router.get("/admin/contents/item/{cid}")
async def admin_get_content(cid: str, admin=Depends(require_admin)):
    doc = await db.contents.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    return _decorate_meditation(doc)


@api_router.post("/admin/contents", status_code=201)
async def admin_create_content(body: ContentIn, admin=Depends(require_admin)):
    _check_section(body.section)
    doc = body.model_dump()
    doc["id"] = new_id("cnt")
    doc["created_at"] = now_utc()
    if not doc.get("publish_date"):
        doc["publish_date"] = now_utc().isoformat()
    doc["notified"] = False
    await db.contents.insert_one(dict(doc))
    await log_activity(admin, f"ha creato \"{doc.get('title','')}\" in {CONTENT_SECTIONS[body.section]}", body.section, {"id": doc["id"]})
    if doc.get("status") == "published" and doc["publish_date"] <= now_utc().isoformat():
        await db.contents.update_one({"id": doc["id"]}, {"$set": {"notified": True}})
        await notify_category("meditations", CONTENT_SECTIONS[body.section], doc.get("title", ""),
                              action_url=f"/c/{body.section}/{doc['id']}", admin_email=admin.get("email"))
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/contents/{cid}")
async def admin_edit_content(cid: str, body: ContentEdit, admin=Depends(require_admin)):
    prev = await db.contents.find_one({"id": cid})
    if not prev:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    updates = body.model_dump(exclude_unset=True)
    if "media_id" in updates and prev.get("media_id") and updates.get("media_id") != prev.get("media_id"):
        await _gridfs_delete(prev.get("media_id"))
    if updates:
        await db.contents.update_one({"id": cid}, {"$set": updates})
    return {"ok": True}


@api_router.post("/admin/contents/{cid}/duplicate", status_code=201)
async def admin_duplicate_content(cid: str, admin=Depends(require_admin)):
    doc = await db.contents.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    doc["id"] = new_id("cnt")
    doc["title"] = f"{doc.get('title','')} (copia)"
    doc["status"] = "draft"
    doc["notified"] = False
    doc["created_at"] = now_utc()
    # Note: shares the same media_id as the original (no file duplication needed).
    await db.contents.insert_one(dict(doc))
    return {"ok": True, "id": doc["id"]}


@api_router.delete("/admin/contents/{cid}")
async def admin_delete_content(cid: str, admin=Depends(require_admin)):
    doc = await db.contents.find_one({"id": cid}, {"media_id": 1})
    if doc:
        # Only delete the GridFS file if no other content references it (duplicates share it).
        others = await db.contents.count_documents({"media_id": doc.get("media_id"), "id": {"$ne": cid}}) if doc.get("media_id") else 0
        if doc.get("media_id") and others == 0:
            await _gridfs_delete(doc.get("media_id"))
    await db.contents.delete_one({"id": cid})
    return {"ok": True}



# ==================== Segnalazioni / Feedback ====================
REPORT_CATEGORIES = ["bug", "suggestion", "technical", "other"]
REPORT_STATUSES = ["new", "in_progress", "resolved", "closed"]


class ReportIn(BaseModel):
    category: str
    title: str
    description: str
    screenshot: Optional[str] = None
    video: Optional[str] = None


class ReportStatusIn(BaseModel):
    status: str


@api_router.post("/reports", status_code=201)
async def create_report(body: ReportIn, authorization: Optional[str] = Header(None)):
    if body.category not in REPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoria non valida")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Il titolo è obbligatorio")
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="La descrizione è obbligatoria")
    # Reject oversized attachments (base64) to stay within proxy limits (~8MB raw ≈ 11MB b64).
    for att in (body.screenshot, body.video):
        if att and len(att) > 12_000_000:
            raise HTTPException(status_code=413, detail="Allegato troppo grande (max ~8MB)")
    user = await get_optional_user(authorization)
    doc = {
        "id": new_id("rep"),
        "category": body.category,
        "title": body.title.strip(),
        "description": body.description.strip(),
        "screenshot": body.screenshot,
        "video": body.video,
        "status": "new",
        "read": False,
        "user_id": user["user_id"] if user else None,
        "user_name": (user.get("name") if user else None),
        "user_email": (user.get("email") if user else None),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.reports.insert_one(dict(doc))
    return {"ok": True, "id": doc["id"]}


@api_router.get("/admin/reports")
async def admin_reports(status: Optional[str] = None, category: Optional[str] = None,
                        search: Optional[str] = None, sort: Optional[str] = "desc",
                        admin=Depends(require_admin)):
    query: dict = {}
    if status and status in REPORT_STATUSES:
        query["status"] = status
    if category and category in REPORT_CATEGORIES:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": re.escape(search), "$options": "i"}},
            {"description": {"$regex": re.escape(search), "$options": "i"}},
            {"user_name": {"$regex": re.escape(search), "$options": "i"}},
            {"user_email": {"$regex": re.escape(search), "$options": "i"}},
        ]
    order = 1 if sort == "asc" else -1
    # Exclude heavy base64 attachments from the list payload.
    docs = await db.reports.find(query, {"_id": 0, "screenshot": 0, "video": 0}).sort("created_at", order).to_list(500)
    return docs


@api_router.get("/admin/reports/unread-count")
async def admin_reports_unread(admin=Depends(require_admin)):
    return {"count": await db.reports.count_documents({"read": {"$ne": True}})}


@api_router.get("/admin/reports/{rid}")
async def admin_get_report(rid: str, admin=Depends(require_admin)):
    doc = await db.reports.find_one({"id": rid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Segnalazione non trovata")
    # Opening a report marks it as read.
    if not doc.get("read"):
        await db.reports.update_one({"id": rid}, {"$set": {"read": True}})
        doc["read"] = True
    return doc


@api_router.patch("/admin/reports/{rid}")
async def admin_update_report(rid: str, body: ReportStatusIn, admin=Depends(require_admin)):
    if body.status not in REPORT_STATUSES:
        raise HTTPException(status_code=400, detail="Stato non valido")
    res = await db.reports.update_one({"id": rid}, {"$set": {"status": body.status, "read": True, "updated_at": now_utc()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segnalazione non trovata")
    await log_activity(admin, f"ha aggiornato lo stato di una segnalazione a \"{body.status}\"", "reports")
    return {"ok": True}


@api_router.delete("/admin/reports/{rid}")
async def admin_delete_report(rid: str, admin=Depends(require_admin)):
    await db.reports.delete_one({"id": rid})
    return {"ok": True}


# ---------------- Versetto del Giorno ----------------
class VerseIn(BaseModel):
    text: str
    reference: str
    book: Optional[str] = None
    chapter: Optional[int] = None
    verse: Optional[int] = None
    active: bool = True
    order: Optional[int] = None


class VerseEdit(BaseModel):
    text: Optional[str] = None
    reference: Optional[str] = None
    book: Optional[str] = None
    chapter: Optional[int] = None
    verse: Optional[int] = None
    active: Optional[bool] = None
    order: Optional[int] = None
    meditation: Optional[str] = None
    reflection: Optional[str] = None


def _rome_day_ordinal() -> int:
    """Ordinal day number in Italian (Europe/Rome) time — increments at 00:00 Rome."""
    if ROME_TZ is not None:
        return datetime.now(ROME_TZ).date().toordinal()
    # Fallback: approximate Rome as UTC+1 (no DST) if zoneinfo is unavailable.
    return (datetime.now(timezone.utc) + timedelta(hours=1)).date().toordinal()


@api_router.get("/verse/today")
async def verse_today():
    """Deterministic daily verse (Europe/Rome). Cycles through the whole active
    archive one per day so the same verse never repeats until all are shown."""
    verses = await db.verses.find({"active": {"$ne": False}}, {"_id": 0}).sort(
        [("order", 1), ("created_at", 1)]
    ).to_list(2000)
    if not verses:
        raise HTTPException(status_code=404, detail="Nessun versetto disponibile")
    idx = _rome_day_ordinal() % len(verses)
    return verses[idx]


@api_router.get("/verse/{vid}")
async def verse_item(vid: str):
    doc = await db.verses.find_one({"id": vid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Versetto non trovato")
    return doc


@api_router.get("/admin/verses")
async def admin_verses(search: Optional[str] = None, admin=Depends(require_perm("verses"))):
    query = {}
    if search:
        query["$or"] = [
            {"text": {"$regex": re.escape(search), "$options": "i"}},
            {"reference": {"$regex": re.escape(search), "$options": "i"}},
        ]
    docs = await db.verses.find(query, {"_id": 0}).sort([("order", 1), ("created_at", 1)]).to_list(2000)
    return docs


@api_router.post("/admin/verses", status_code=201)
async def admin_create_verse(body: VerseIn, admin=Depends(require_perm("verses"))):
    doc = body.model_dump()
    doc["id"] = new_id("verse")
    if doc.get("order") is None:
        last = await db.verses.find_one({}, {"order": 1}, sort=[("order", -1)])
        doc["order"] = ((last or {}).get("order", 0) or 0) + 1
    doc["created_at"] = now_utc()
    await db.verses.insert_one(dict(doc))
    await log_activity(admin, f"ha aggiunto il versetto \"{doc.get('reference', '')}\"", "verses", {"id": doc["id"]})
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/verses/{vid}")
async def admin_edit_verse(vid: str, body: VerseEdit, admin=Depends(require_perm("verses"))):
    updates = body.model_dump(exclude_unset=True)
    # A manual meditation edit takes priority and must never be overwritten by
    # automatic regeneration → lock it, and invalidate the cached audio.
    if "meditation" in updates:
        updates["meditation_locked"] = bool((updates.get("meditation") or "").strip())
        updates["meditation_audio_ready"] = False
        updates["meditation_audio_b64"] = None
    if updates:
        res = await db.verses.update_one({"id": vid}, {"$set": updates})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Versetto non trovato")
    await log_activity(admin, f"ha modificato un versetto", "verses", {"id": vid})
    return {"ok": True}


@api_router.delete("/admin/verses/{vid}")
async def admin_delete_verse(vid: str, admin=Depends(require_perm("verses"))):
    await db.verses.delete_one({"id": vid})
    await log_activity(admin, "ha eliminato un versetto", "verses", {"id": vid})
    return {"ok": True}


async def _generate_meditation(verse: dict) -> dict:
    """Generate a short, faithful devotional meditation + a personal reflection
    prompt for a verse, using Claude via the Emergent universal key. Returns
    {"meditation": str, "reflection": str}. Raises on failure."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Servizio meditazione non configurato")
    system = (
        "Sei un assistente che scrive brevi meditazioni bibliche quotidiane in italiano "
        "per un'app di radio evangelica cristiana. Scrivi in modo semplice, caldo e incoraggiante, "
        "rimanendo fedele al significato e al contesto del versetto, senza aggiungere interpretazioni "
        "arbitrarie, polemiche dottrinali o contenuti confessionali specifici. Il focus è il significato "
        "del versetto e la sua applicazione pratica nella vita di ogni giorno. "
        "NON scrivere preghiere gia' formulate. "
        "Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con due campi: "
        "\"meditation\" (una riflessione di 100-200 parole) e "
        "\"reflection\" (una singola frase motivazionale breve o una domanda di riflessione personale, "
        "es. 'In che modo puoi vivere oggi questa Parola?'). Nessun testo fuori dal JSON."
    )
    chat = LlmChat(api_key=key, session_id=f"verse-{verse.get('id')}", system_message=system).with_model("anthropic", "claude-sonnet-4-6")
    prompt = f"Versetto: \"{verse.get('text','')}\"\nRiferimento: {verse.get('reference','')}\n\nScrivi la meditazione di oggi."
    raw = await chat.send_message(UserMessage(text=prompt))
    txt = (raw or "").strip()
    # Strip markdown code fences if present.
    if txt.startswith("```"):
        txt = re.sub(r"^```[a-zA-Z]*\n?", "", txt).rsplit("```", 1)[0].strip()
    try:
        data = json.loads(txt)
        meditation = (data.get("meditation") or "").strip()
        reflection = (data.get("reflection") or "").strip()
    except Exception:
        # Fallback: treat the whole output as the meditation.
        meditation = txt
        reflection = "In che modo puoi vivere oggi questa Parola?"
    if not meditation:
        raise HTTPException(status_code=502, detail="Meditazione non disponibile, riprova")
    return {"meditation": meditation, "reflection": reflection}


@api_router.get("/verse/{vid}/meditation")
async def verse_meditation(vid: str):
    """Return the verse's meditation, generating & caching it on first access."""
    verse = await db.verses.find_one({"id": vid})
    if not verse:
        raise HTTPException(status_code=404, detail="Versetto non trovato")
    if not (verse.get("meditation") or "").strip():
        gen = await _generate_meditation(verse)
        await db.verses.update_one(
            {"id": vid},
            {"$set": {"meditation": gen["meditation"], "reflection": gen["reflection"],
                      "meditation_locked": False, "meditation_generated": True}},
        )
        verse = {**verse, **gen}
    # Kick off audio generation in the background if not ready (best-effort, optional).
    audio_ready = bool(verse.get("meditation_audio_ready"))
    if not audio_ready and os.environ.get("EMERGENT_LLM_KEY"):
        asyncio.create_task(_ensure_meditation_audio(vid))
    return {"meditation": verse["meditation"], "reflection": verse.get("reflection") or "", "audio": audio_ready}


async def _generate_meditation_audio(verse: dict) -> bytes:
    """Generate an MP3 of the meditation via OpenAI TTS (Emergent key)."""
    from emergentintegrations.llm.openai.text_to_speech import OpenAITextToSpeech
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("TTS non configurato")
    text = (verse.get("meditation") or "").strip()
    refl = (verse.get("reflection") or "").strip()
    if refl:
        text = f"{text}\n\n{refl}"
    text = text[:4000]
    tts = OpenAITextToSpeech(api_key=key)
    return await tts.generate_speech(text=text, model="tts-1", voice="nova", response_format="mp3")


async def _ensure_meditation_audio(vid: str) -> bool:
    """Generate & cache the meditation audio if missing. Never raises."""
    try:
        verse = await db.verses.find_one({"id": vid})
        if not verse or verse.get("meditation_audio_ready") or not (verse.get("meditation") or "").strip():
            return bool(verse and verse.get("meditation_audio_ready"))
        audio = await _generate_meditation_audio(verse)
        await db.verses.update_one(
            {"id": vid},
            {"$set": {"meditation_audio_b64": base64.b64encode(audio).decode(), "meditation_audio_ready": True}},
        )
        return True
    except Exception as e:
        logger.warning("meditation audio gen failed (%s): %s", vid, e)
        return False


@api_router.get("/verse/{vid}/meditation/audio")
async def verse_meditation_audio(vid: str):
    verse = await db.verses.find_one({"id": vid}, {"meditation_audio_b64": 1, "meditation_audio_ready": 1})
    if not verse or not verse.get("meditation_audio_ready") or not verse.get("meditation_audio_b64"):
        raise HTTPException(status_code=404, detail="Audio non disponibile")
    data = base64.b64decode(verse["meditation_audio_b64"])
    return Response(content=data, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=86400"})


@api_router.post("/admin/verses/{vid}/regenerate-meditation")
async def admin_regenerate_meditation(vid: str, admin=Depends(require_perm("verses"))):
    verse = await db.verses.find_one({"id": vid})
    if not verse:
        raise HTTPException(status_code=404, detail="Versetto non trovato")
    gen = await _generate_meditation(verse)
    await db.verses.update_one(
        {"id": vid},
        {"$set": {"meditation": gen["meditation"], "reflection": gen["reflection"],
                  "meditation_locked": False, "meditation_generated": True,
                  "meditation_audio_ready": False, "meditation_audio_b64": None}},
    )
    await log_activity(admin, "ha rigenerato una meditazione", "verses", {"id": vid})
    return gen


# ---------------- Daily Verse push notification ----------------
VERSE_NOTIF_DEFAULTS = [
    "📖 È disponibile la nuova meditazione di oggi. Aprila e prenditi qualche minuto per riflettere sulla Parola di Dio.",
    "🌅 Nuovo Versetto del Giorno disponibile. Lasciati incoraggiare dalla Parola per affrontare questa giornata.",
    "✨ La meditazione di oggi è pronta. Leggila e dedica un momento alla riflessione sulla Parola di Dio.",
]


VERSE_NOTIF_DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]


async def _today_verse() -> Optional[dict]:
    verses = await db.verses.find({"active": {"$ne": False}}, {"_id": 0}).sort(
        [("order", 1), ("created_at", 1)]
    ).to_list(2000)
    if not verses:
        return None
    return verses[_rome_day_ordinal() % len(verses)]


async def _send_verse_notification(force: bool = False) -> Optional[int]:
    """Send the daily verse notification. Automatic path (force=False) claims the
    Rome day atomically so it fires exactly once per day even with multiple workers."""
    from pymongo.errors import DuplicateKeyError
    cfg = await db.settings.find_one({"_id": "verse_notif"}) or {}
    today = _rome_day_ordinal()
    if not force:
        if cfg.get("enabled") is False:
            return None
        # Respect the configured send time & weekdays (Europe/Rome).
        now_rome = datetime.now(ROME_TZ) if ROME_TZ else (datetime.now(timezone.utc) + timedelta(hours=1))
        send_days = cfg.get("send_days") or VERSE_NOTIF_DAYS
        if VERSE_NOTIF_DAYS[now_rome.weekday()] not in send_days:
            return None
        st = cfg.get("send_time") or "00:00"
        try:
            sh, sm = int(st.split(":")[0]), int(st.split(":")[1])
        except Exception:
            sh, sm = 0, 0
        if (now_rome.hour * 60 + now_rome.minute) < (sh * 60 + sm):
            return None  # not yet time to send today
        try:
            res = await db.settings.update_one(
                {"_id": "verse_notif", "last_sent_day": {"$ne": today}},
                {"$set": {"last_sent_day": today}},
                upsert=True,
            )
        except DuplicateKeyError:
            return None  # another worker already claimed today
        if res.modified_count == 0 and res.upserted_id is None:
            return None  # already sent today
    else:
        await db.settings.update_one({"_id": "verse_notif"}, {"$set": {"last_sent_day": today}}, upsert=True)

    verse = await _today_verse()
    if not verse:
        return None
    # Pre-warm the meditation cache so the content is ready when users tap through.
    if not (verse.get("meditation") or "").strip():
        try:
            gen = await _generate_meditation(verse)
            await db.verses.update_one(
                {"id": verse["id"]},
                {"$set": {"meditation": gen["meditation"], "reflection": gen["reflection"],
                          "meditation_locked": False, "meditation_generated": True}},
            )
        except Exception as e:
            logger.warning("verse notif: meditation gen failed: %s", e)
    # Pre-warm the meditation audio too (best-effort, optional).
    await _ensure_meditation_audio(verse["id"])

    title = (cfg.get("title") or "").strip() or "📖 Versetto del Giorno"
    message = (cfg.get("message") or "").strip()
    if message:
        message = message.replace("{riferimento}", verse.get("reference", "")).replace("{reference}", verse.get("reference", ""))
    else:
        message = VERSE_NOTIF_DEFAULTS[today % len(VERSE_NOTIF_DEFAULTS)]
    return await notify_category("verse", title, message, action_url=f"/bibbia?verseId={verse['id']}")


class VerseNotifSettings(BaseModel):
    enabled: Optional[bool] = None
    title: Optional[str] = None
    message: Optional[str] = None
    send_time: Optional[str] = None
    send_days: Optional[List[str]] = None


@api_router.get("/admin/verse-notification")
async def admin_get_verse_notif(admin=Depends(require_perm("verses"))):
    cfg = await db.settings.find_one({"_id": "verse_notif"}, {"_id": 0}) or {}
    return {
        "enabled": cfg.get("enabled", True),
        "title": cfg.get("title") or "📖 Versetto del Giorno",
        "message": cfg.get("message") or "",
        "send_time": cfg.get("send_time") or "00:00",
        "send_days": cfg.get("send_days") or VERSE_NOTIF_DAYS,
        "all_days": VERSE_NOTIF_DAYS,
        "defaults": VERSE_NOTIF_DEFAULTS,
    }


@api_router.put("/admin/verse-notification")
async def admin_update_verse_notif(body: VerseNotifSettings, admin=Depends(require_perm("verses"))):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if "send_days" in updates:
        updates["send_days"] = [d for d in (updates["send_days"] or []) if d in VERSE_NOTIF_DAYS]
    if updates:
        await db.settings.update_one({"_id": "verse_notif"}, {"$set": updates}, upsert=True)
    await log_activity(admin, "ha aggiornato le notifiche del Versetto del Giorno", "verses")
    return {"ok": True}


@api_router.post("/admin/verses/notify-today")
async def admin_notify_verse_today(admin=Depends(require_perm("verses"))):
    """Manually send today's verse notification now (e.g. after publishing a
    meditation manually). Bypasses the once-a-day guard."""
    count = await _send_verse_notification(force=True)
    if count is None:
        raise HTTPException(status_code=400, detail="Nessun versetto disponibile da notificare")
    await log_activity(admin, "ha inviato manualmente la notifica del Versetto del Giorno", "verses")
    return {"ok": True, "recipients": count}


async def _verse_notif_scheduler():
    """Background loop: sends the daily verse notification once per Rome day."""
    await asyncio.sleep(25)
    while True:
        try:
            await _send_verse_notification(force=False)
        except Exception as e:
            logger.warning("verse notif scheduler error: %s", e)
        await asyncio.sleep(300)



app.include_router(api_router)

# ---------------- Lightweight rate limiting (per IP, sliding window) ----------------
from collections import defaultdict, deque
import time as _time
from starlette.responses import JSONResponse

_rl_store: dict = defaultdict(deque)
# (path_prefix, method_or_None, max_requests, window_seconds)
_RL_RULES = [
    ("/api/auth/login", "POST", 10, 60),
    ("/api/auth/register", "POST", 5, 60),
    ("/api/auth/session", "POST", 20, 60),
    ("/api/contact", "POST", 8, 60),
    ("/api/prayer-requests", "POST", 8, 60),
    ("/api/messages", "POST", 8, 60),
    ("/api/reports", "POST", 8, 60),
]


@app.middleware("http")
async def _rate_limit(request, call_next):
    path, method = request.url.path, request.method
    for pref, meth, limit, window in _RL_RULES:
        if path.startswith(pref) and (meth is None or meth == method):
            xff = request.headers.get("x-forwarded-for", "")
            ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "?")
            key = f"{ip}:{pref}"
            dq = _rl_store[key]
            now = _time.time()
            while dq and now - dq[0] > window:
                dq.popleft()
            if len(dq) >= limit:
                return JSONResponse({"detail": "Troppe richieste, riprova tra qualche istante."}, status_code=429)
            dq.append(now)
            break
    return await call_next(request)


# Token-based API → no cookies, so credentials are disabled (this makes the
# permissive origin valid and safe). Restrict origins via CORS_ORIGINS if set.
_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.invitations.create_index("token", unique=True)
    await db.invitations.create_index("email")
    await db.activity_log.create_index("created_at")
    # Chunked uploads are assembled in MongoDB so they survive across multiple
    # backend workers/replicas (the local /tmp filesystem is not shared).
    await db.upload_sessions.create_index("created_at", expireAfterSeconds=6 * 3600)
    await db.upload_chunks.create_index([("upload_id", 1), ("offset", 1)], unique=True)
    await db.upload_chunks.create_index("created_at", expireAfterSeconds=6 * 3600)
    # Query performance indices (safe/idempotent).
    try:
        await db.contents.create_index([("section", 1), ("created_at", -1)])
        await db.contents.create_index([("section", 1), ("featured", 1)])
        await db.verses.create_index([("order", 1), ("created_at", 1)])
        await db.programs.create_index("weekdays")
        await db.prayer_requests.create_index("created_at")
        await db.messages.create_index("created_at")
    except Exception as e:
        logger.warning("index creation: %s", e)

    if not await db.live_status.find_one({"_id": "current"}):
        await db.live_status.insert_one({
            "_id": "current", "is_live": True,
            "title": "In Diretta", "artist": "Pescatori di Uomini",
            "artwork": DEFAULT_ART,
            "stream_url": AZ_STREAM_URL,
            "station_name": "Pescatori di Uomini",
            "backup_url": "",
            "metadata_url": AZ_NOWPLAYING_URL,
            "refresh_interval": 15,
        })
    else:
        # Migrate any leftover demo stream to the real AzuraCast endpoints.
        cur = await db.live_status.find_one({"_id": "current"})
        patch = {}
        if not cur.get("stream_url") or "somafm" in (cur.get("stream_url") or "") or cur.get("stream_url") == DEMO_STREAM:
            patch["stream_url"] = AZ_STREAM_URL
        if not cur.get("metadata_url"):
            patch["metadata_url"] = AZ_NOWPLAYING_URL
        if not cur.get("refresh_interval"):
            patch["refresh_interval"] = 15
        if patch:
            await db.live_status.update_one({"_id": "current"}, {"$set": patch})

    if not await db.settings.find_one({"_id": "general"}):
        await db.settings.insert_one({
            "_id": "general",
            "contact_email": "info@pescatoridiuomini.it",
            "contact_phone": "",
            "address": "",
            "facebook": "",
            "instagram": "",
            "youtube": "",
            "whatsapp": "",
            "website": "",
            "about_short": "Radio evangelica cristiana. Annunciamo Cristo attraverso la radio e i nuovi media.",
        })

    # Seed/merge the "Chi Siamo" page defaults (fill only missing keys, never overwrite admin edits).
    gen = await db.settings.find_one({"_id": "general"}) or {}
    missing = {k: v for k, v in ABOUT_DEFAULTS.items() if not gen.get(k)}
    if missing:
        await db.settings.update_one({"_id": "general"}, {"$set": missing}, upsert=True)

    # One-time demo seeding: only on a genuinely fresh/empty install. Once the
    # admin has curated content (or on any existing install), demo podcasts/news/
    # programs/team are NEVER re-created — even if the collections are emptied.
    seed_flags = await db.settings.find_one({"_id": "seed_flags"}) or {}
    already_have_data = (
        (await db.users.count_documents({}) > 0)
        or (await db.podcasts.count_documents({}) > 0)
        or (await db.crew.count_documents({}) > 0)
    )
    demo_seeded = bool(seed_flags.get("demo_seeded")) or already_have_data

    if not demo_seeded and await db.podcasts.count_documents({}) == 0:
        covers = [
            "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=600&q=80",
            "https://images.unsplash.com/photo-1476611338391-6f395a0ebc7b?w=600&q=80",
            "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=600&q=80",
            "https://images.unsplash.com/photo-1445445290350-18a3b86e0b5a?w=600&q=80",
            "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&q=80",
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80",
        ]
        cats = ["Studi Biblici", "Testimonianze", "Predicazioni", "Famiglia", "Giovani", "Preghiera"]
        titles = [
            ("Il Sermone sul Monte", "Un viaggio nelle Beatitudini e nel cuore dell'insegnamento di Gesù."),
            ("La mia testimonianza", "Come ho incontrato Cristo e la mia vita è cambiata per sempre."),
            ("La grazia che salva", "Predicazione sull'amore incondizionato di Dio verso l'uomo."),
            ("Famiglia secondo Dio", "Principi biblici per costruire una famiglia solida e serena."),
            ("Giovani e fede", "Vivere il Vangelo nel mondo di oggi, senza compromessi."),
            ("La potenza della preghiera", "Riscoprire l'intimità con Dio attraverso la preghiera quotidiana."),
        ]
        durations = ["32:14", "18:45", "41:02", "27:33", "22:10", "35:58"]
        podcasts = []
        for i in range(6):
            podcasts.append({
                "id": new_id("pod"), "title": titles[i][0], "description": titles[i][1],
                "category": cats[i], "duration": durations[i], "artwork": covers[i],
                "audio_url": DEMO_STREAM, "author": "Pastore Marco Rossi",
                "created_at": now_utc(),
            })
        await db.podcasts.insert_many(podcasts)

    if not demo_seeded and await db.news.count_documents({}) == 0:
        imgs = [
            "https://images.pexels.com/photos/13963623/pexels-photo-13963623.jpeg?auto=compress&cs=tinysrgb&w=940",
            "https://images.unsplash.com/photo-1544427920-c49ccfb85579?w=940&q=80",
            "https://images.unsplash.com/photo-1523803326055-13445d5c1837?w=940&q=80",
            "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=940&q=80",
        ]
        cats = ["Missioni", "Eventi", "Testimonianze", "Mondo Cristiano"]
        titles = [
            ("Nuova missione in Africa orientale", "Un team di volontari italiani porta aiuto e speranza."),
            ("Convegno nazionale a settembre", "Tre giorni di lode, studio e comunione fraterna."),
            ("La storia di Anna: dalla disperazione alla fede", "Una testimonianza che tocca il cuore."),
            ("La Chiesa cresce nel mondo", "Statistiche e storie di risveglio spirituale globale."),
        ]
        news = []
        for i in range(4):
            news.append({
                "id": new_id("news"), "title": titles[i][0], "excerpt": titles[i][1],
                "body": titles[i][1] + " Il Signore è il mio pastore, nulla mi manca. Continueremo a seguire questa storia con aggiornamenti costanti dalla nostra redazione, offrendo approfondimenti e testimonianze dirette da chi vive queste esperienze in prima persona.",
                "category": cats[i], "image": imgs[i], "author": "Redazione",
                "date": (now_utc() - timedelta(days=i)).isoformat(),
            })
        await db.news.insert_many(news)

    if not demo_seeded and await db.programs.count_documents({}) == 0:
        progs = [
            ("Buongiorno con la Parola", "07:00", "Lunedì", "Marco Rossi", "Riflessione mattutina per iniziare la giornata con Dio."),
            ("Lode e Adorazione", "10:00", "Lunedì", "Sara Bianchi", "Un'ora di musica cristiana e worship."),
            ("Studio Biblico", "18:00", "Martedì", "Pastore Luca", "Approfondimento delle Scritture verso per verso."),
            ("Voci dal Mondo", "16:00", "Mercoledì", "Giulia Verdi", "Missioni e testimonianze dai cinque continenti."),
            ("Giovani in Diretta", "20:30", "Giovedì", "Team Giovani", "Spazio dedicato ai giovani della comunità."),
            ("Famiglia e Fede", "17:00", "Venerdì", "Anna e Paolo", "Consigli biblici per la vita familiare."),
            ("Serata di Preghiera", "21:00", "Sabato", "Comunità", "Preghiera e intercessione insieme."),
            ("Il Culto della Domenica", "10:30", "Domenica", "Pastore Marco", "Diretta del culto domenicale."),
        ]
        docs = []
        for name, time, day, host, desc in progs:
            docs.append({"id": new_id("prog"), "name": name, "time": time, "day": day,
                         "host": host, "description": desc})
        await db.programs.insert_many(docs)

    if not demo_seeded and await db.collaborators.count_documents({}) == 0:
        team = [
            ("Marco Rossi", "Direttore & Speaker", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80"),
            ("Sara Bianchi", "Conduttrice Lode e Adorazione", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80"),
            ("Pastore Luca Ferrari", "Studi Biblici", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80"),
            ("Giulia Verdi", "Redazione & Missioni", "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&q=80"),
            ("Paolo Neri", "Tecnico del Suono", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80"),
            ("Anna Costa", "Social & Comunicazione", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80"),
        ]
        docs = []
        for i, (name, role, photo) in enumerate(team):
            docs.append({"id": new_id("collab"), "name": name, "role": role, "photo": photo, "order": i})
        await db.collaborators.insert_many(docs)

    if await db.crew.count_documents({}) == 0:
        await db.crew.insert_one({
            "id": "crew_luigi_volpe",            "name": "Luigi Volpe",
            "role": "Fondatore e Responsabile",
            "mission": "Annunciare Cristo attraverso la radio e i nuovi media.",
            "bio": "Ho fondato Radio Pescatori di Uomini con il desiderio di annunciare il Vangelo e glorificare Dio attraverso contenuti biblici, testimonianze e programmi che possano raggiungere ogni persona. Credo che ognuno possa essere uno strumento nelle mani di Dio per portare speranza in un mondo che ha sete di verità.",
            "ministry": "Direzione della radio, predicazione e sviluppo dei contenuti. Coordina la squadra e cura la visione spirituale del progetto.",
            "programs": ["Buongiorno con la Parola", "Il Culto della Domenica"],
            "verse": "Non voi avete scelto me, ma io ho scelto voi e vi ho costituiti perché andiate e portiate frutto e il vostro frutto rimanga.",
            "verse_ref": "Giovanni 15:16",
            "testimony": "La mia vita è cambiata quando ho incontrato personalmente il Signore. Da allora ho sentito la chiamata a usare ogni mezzo possibile — e in particolare la radio — per raccontare ciò che Dio ha fatto per me e per tanti altri. Pescatori di Uomini è nato da questa chiamata: essere pescatori, gettare le reti e lasciare che sia Lui a fare il resto.",
            "portrait_key": "luigi",
            "portrait": None,
            "poster": True,
            "order": 0,
            "published": True,
        })

    # Mark demo seeding as done so it never runs again on this database.
    if not demo_seeded:
        await db.settings.update_one({"_id": "seed_flags"}, {"$set": {"demo_seeded": True}}, upsert=True)

    # --- CMS migration (idempotent): ensure existing content has publish/feature flags ---
    await db.podcasts.update_many({"published": {"$exists": False}}, {"$set": {"published": True}})
    await db.podcasts.update_many({"featured": {"$exists": False}}, {"$set": {"featured": False}})
    await db.podcasts.update_many({"featured_order": {"$exists": False}}, {"$set": {"featured_order": 0}})
    await db.news.update_many({"published": {"$exists": False}}, {"$set": {"published": True}})
    await db.news.update_many({"featured": {"$exists": False}}, {"$set": {"featured": False}})
    if await db.podcasts.count_documents({"featured": True}) == 0:
        feat = await db.podcasts.find({}, {"id": 1}).sort("created_at", -1).to_list(3)
        for i, d in enumerate(feat):
            await db.podcasts.update_one({"id": d["id"]}, {"$set": {"featured": True, "featured_order": i}})
    if await db.news.count_documents({"featured": True}) == 0:
        fn = await db.news.find_one({}, sort=[("date", -1)])
        if fn:
            await db.news.update_one({"id": fn["id"]}, {"$set": {"featured": True}})

    # --- Workflow status migration (idempotent) ---
    await db.prayer_requests.update_many({"status": {"$exists": False}}, {"$set": {"status": "new"}})
    await db.messages.update_many({"status": {"$exists": False}}, {"$set": {"status": "new"}})

    # --- Seed "Versetto del Giorno" archive (only if empty; admin-managed thereafter) ---
    if await db.verses.count_documents({}) == 0:
        docs = []
        for i, v in enumerate(VERSES_SEED):
            docs.append({
                "id": new_id("verse"),
                "text": v["text"],
                "reference": v["reference"],
                "book": v.get("book"),
                "chapter": v.get("chapter"),
                "verse": v.get("verse"),
                "active": True,
                "order": i,
                "created_at": now_utc(),
            })
        if docs:
            await db.verses.insert_many(docs)

    # Default daily-verse notification config (idempotent).
    if not await db.settings.find_one({"_id": "verse_notif"}):
        await db.settings.insert_one({"_id": "verse_notif", "enabled": True, "title": "📖 Versetto del Giorno", "message": "", "send_time": "07:30", "send_days": VERSE_NOTIF_DAYS})

    # Start the daily verse-notification scheduler (fires once per Rome day).
    asyncio.create_task(_verse_notif_scheduler())
    logger.info("Seed complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
