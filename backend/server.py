from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEMO_STREAM = "https://ice1.somafm.com/christmas-128-mp3"

# ---------------- Real AzuraCast radio ----------------
AZ_STREAM_URL = "http://84.247.184.136/listen/pescatori/radio.mp3"
AZ_NOWPLAYING_URL = "http://84.247.184.136/api/nowplaying/pescatori"
DEFAULT_ART = "https://images.unsplash.com/photo-1592818868295-f527dbac420d?w=600&q=85"

# AzuraCast control API (station lifecycle). Env is the secure default; DB can override from the panel.
AZURACAST_BASE = os.environ.get("AZURACAST_BASE_URL", "http://84.247.184.136").rstrip("/")
AZURACAST_STATION_ENV = os.environ.get("AZURACAST_STATION", "pescatori")
AZURACAST_API_KEY_ENV = os.environ.get("AZURACAST_API_KEY", "")


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
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"subtitle": {"$regex": search, "$options": "i"}},
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
    docs = await db.programs.find({}, {"_id": 0}).to_list(200)
    return docs


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
PERM_SECTIONS = ["podcasts", "news", "merch", "schedule", "prayers", "messages", "team", "radio"]

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
        "products": await db.products.count_documents({}),
    }


@api_router.get("/admin/applications")
async def admin_applications(status: Optional[str] = None, sort: Optional[str] = "newest",
                             search: Optional[str] = None, admin=Depends(require_perm("team"))):
    query = {}
    if status and status in ("pending", "approved", "rejected"):
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"surname": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
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
        query["$or"] = [{"title": {"$regex": search, "$options": "i"}}, {"author": {"$regex": search, "$options": "i"}}]
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
        query["$or"] = [{"title": {"$regex": search, "$options": "i"}}, {"author": {"$regex": search, "$options": "i"}}]
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
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/news/{nid}")
async def admin_edit_news(nid: str, body: NewsEdit, admin=Depends(require_perm("news"))):
    updates = body.model_dump(exclude_unset=True)
    if updates:
        await db.news.update_one({"id": nid}, {"$set": updates})
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
        query["$or"] = [{"text": {"$regex": search, "$options": "i"}}, {"name": {"$regex": search, "$options": "i"}}]
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
        query["$or"] = [{"text": {"$regex": search, "$options": "i"}}, {"name": {"$regex": search, "$options": "i"}}]
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
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
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
    role: str  # collaborator | listener  (administrator is allowlist-only)
    permissions: Optional[List[str]] = None


@api_router.put("/admin/users/{uid}/role")
async def admin_set_user_role(uid: str, body: UserRoleIn, admin=Depends(require_admin)):
    u = await db.users.find_one({"user_id": uid})
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if (u.get("email") or "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Il ruolo degli amministratori è gestito dall'allowlist")
    if body.role == ROLE_ADMIN:
        raise HTTPException(status_code=400, detail="Il ruolo Amministratore si assegna solo dall'allowlist email")
    if body.role not in (ROLE_COLLAB, ROLE_LISTENER):
        raise HTTPException(status_code=400, detail="Ruolo non valido")
    perms = []
    if body.role == ROLE_COLLAB:
        perms = [p for p in (body.permissions or []) if p in PERM_SECTIONS]
    await db.users.update_one({"user_id": uid}, {"$set": {"role": body.role, "permissions": perms}})
    label = "Collaboratore" if body.role == ROLE_COLLAB else "Ascoltatore"
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
class ProgramIn(BaseModel):
    name: str
    time: str
    day: str
    host: Optional[str] = ""
    description: Optional[str] = ""


class ProgramEdit(BaseModel):
    name: Optional[str] = None
    time: Optional[str] = None
    day: Optional[str] = None
    host: Optional[str] = None
    description: Optional[str] = None


@api_router.get("/admin/programs")
async def admin_programs(admin=Depends(require_perm("schedule"))):
    docs = await db.programs.find({}, {"_id": 0}).to_list(500)
    return docs


@api_router.post("/admin/programs", status_code=201)
async def admin_create_program(body: ProgramIn, admin=Depends(require_perm("schedule"))):
    doc = body.model_dump()
    doc["id"] = new_id("prog")
    await db.programs.insert_one(dict(doc))
    await log_activity(admin, f"ha aggiunto il programma \"{doc.get('name', '')}\" al palinsesto", "schedule", {"id": doc["id"]})
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/programs/{prog_id}")
async def admin_edit_program(prog_id: str, body: ProgramEdit, admin=Depends(require_perm("schedule"))):
    updates = body.model_dump(exclude_unset=True)
    if updates:
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
    about_short: Optional[str] = None


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
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
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
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
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


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
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
            "about_short": "Radio evangelica cristiana. Annunciamo Cristo attraverso la radio e i nuovi media.",
        })

    if await db.podcasts.count_documents({}) == 0:
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

    if await db.news.count_documents({}) == 0:
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

    if await db.programs.count_documents({}) == 0:
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

    if await db.collaborators.count_documents({}) == 0:
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
    logger.info("Seed complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
