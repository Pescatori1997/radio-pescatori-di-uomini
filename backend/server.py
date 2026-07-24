from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
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
    return user


# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    uid = new_id("user")
    await db.users.insert_one({
        "user_id": uid,
        "email": body.email.lower(),
        "name": body.name,
        "password": hash_pw(body.password),
        "picture": None,
        "provider": "email",
        "created_at": now_utc(),
    })
    token = await create_session(uid)
    return {"token": token, "user": {"user_id": uid, "email": body.email.lower(), "name": body.name, "picture": None}}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password") or not check_pw(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    token = await create_session(user["user_id"])
    return {"token": token, "user": {"user_id": user["user_id"], "email": user["email"], "name": user["name"], "picture": user.get("picture")}}


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
    user = await db.users.find_one({"email": email})
    if user:
        uid = user["user_id"]
    else:
        uid = new_id("user")
        await db.users.insert_one({
            "user_id": uid,
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "provider": "google",
            "created_at": now_utc(),
        })
    token = await create_session(uid)
    return {"token": token, "user": {"user_id": uid, "email": email, "name": data.get("name"), "picture": data.get("picture")}}


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
    doc = await db.live_status.find_one({"_id": "current"})
    if not doc:
        return {"is_live": True, "title": "Lode e Adorazione", "artist": "Pescatori di Uomini",
                "artwork": "https://images.unsplash.com/photo-1592818868295-f527dbac420d?w=600&q=85",
                "stream_url": DEMO_STREAM}
    doc.pop("_id", None)
    return doc


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


async def require_admin(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if (user.get("email") or "").lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Accesso negato: non sei un amministratore")
    return user


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
async def admin_me(admin=Depends(require_admin)):
    return {"is_admin": True, "user": {"email": admin.get("email"), "name": admin.get("name"), "picture": admin.get("picture")}}


@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    return {
        "pending_applications": await db.crew_applications.count_documents({"status": "pending"}),
        "approved_members": await db.crew.count_documents({"published": True}),
        "total_users": await db.users.count_documents({}),
        "prayer_requests": await db.prayer_requests.count_documents({}),
        "news": await db.news.count_documents({}),
        "podcasts": await db.podcasts.count_documents({}),
    }


@api_router.get("/admin/applications")
async def admin_applications(status: Optional[str] = None, sort: Optional[str] = "newest",
                             search: Optional[str] = None, admin=Depends(require_admin)):
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
async def admin_application(app_id: str, admin=Depends(require_admin)):
    doc = await db.crew_applications.find_one({"id": app_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Candidatura non trovata")
    return doc


@api_router.patch("/admin/applications/{app_id}")
async def admin_edit_application(app_id: str, body: ApplicationEdit, admin=Depends(require_admin)):
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
async def admin_approve(app_id: str, admin=Depends(require_admin)):
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
async def admin_reject(app_id: str, admin=Depends(require_admin)):
    a = await db.crew_applications.find_one({"id": app_id})
    if not a:
        raise HTTPException(status_code=404, detail="Candidatura non trovata")
    if a.get("crew_id"):
        await db.crew.delete_one({"id": a["crew_id"]})
    await db.crew_applications.update_one({"id": app_id}, {"$set": {"status": "rejected", "crew_id": None}})
    return {"ok": True}


@api_router.delete("/admin/applications/{app_id}")
async def admin_delete_application(app_id: str, admin=Depends(require_admin)):
    a = await db.crew_applications.find_one({"id": app_id})
    if a and a.get("crew_id"):
        await db.crew.delete_one({"id": a["crew_id"]})
    await db.crew_applications.delete_one({"id": app_id})
    return {"ok": True}


@api_router.get("/admin/crew")
async def admin_crew(admin=Depends(require_admin)):
    docs = await db.crew.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return docs


@api_router.patch("/admin/crew/{member_id}")
async def admin_edit_crew(member_id: str, body: CrewEdit, admin=Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if "portrait" in updates:
        updates["portrait_key"] = None
        updates["poster"] = False
    if updates:
        await db.crew.update_one({"id": member_id}, {"$set": updates})
    return {"ok": True}


@api_router.post("/admin/crew/{member_id}/portrait")
async def admin_crew_portrait(member_id: str, body: PortraitIn, admin=Depends(require_admin)):
    await db.crew.update_one({"id": member_id}, {"$set": {"portrait": body.portrait, "portrait_key": None, "poster": False}})
    return {"ok": True}


@api_router.delete("/admin/crew/{member_id}")
async def admin_delete_crew(member_id: str, admin=Depends(require_admin)):
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
async def admin_podcasts(status: Optional[str] = None, search: Optional[str] = None, admin=Depends(require_admin)):
    query = {}
    if status == "published":
        query["published"] = True
    elif status == "draft":
        query["published"] = {"$ne": True}
    if search:
        query["$or"] = [{"title": {"$regex": search, "$options": "i"}}, {"author": {"$regex": search, "$options": "i"}}]
    docs = await db.podcasts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/admin/podcasts")
async def admin_create_podcast(body: PodcastIn, admin=Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = new_id("pod")
    doc["created_at"] = now_utc()
    doc["featured_order"] = await db.podcasts.count_documents({})
    if not doc.get("publish_date"):
        doc["publish_date"] = now_utc().isoformat()
    await db.podcasts.insert_one(dict(doc))
    doc.pop("_id", None)
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/podcasts/{pid}")
async def admin_edit_podcast(pid: str, body: PodcastEdit, admin=Depends(require_admin)):
    updates = body.model_dump(exclude_unset=True)
    if updates:
        await db.podcasts.update_one({"id": pid}, {"$set": updates})
    return {"ok": True}


@api_router.delete("/admin/podcasts/{pid}")
async def admin_delete_podcast(pid: str, admin=Depends(require_admin)):
    await db.podcasts.delete_one({"id": pid})
    return {"ok": True}


@api_router.post("/admin/podcasts/featured-order")
async def admin_podcast_featured_order(body: dict, admin=Depends(require_admin)):
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
async def admin_news(status: Optional[str] = None, search: Optional[str] = None, admin=Depends(require_admin)):
    query = {}
    if status == "published":
        query["published"] = True
    elif status == "draft":
        query["published"] = {"$ne": True}
    if search:
        query["$or"] = [{"title": {"$regex": search, "$options": "i"}}, {"author": {"$regex": search, "$options": "i"}}]
    docs = await db.news.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return docs


@api_router.post("/admin/news")
async def admin_create_news(body: NewsIn, admin=Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = new_id("news")
    if not doc.get("date"):
        doc["date"] = now_utc().isoformat()
    await db.news.insert_one(dict(doc))
    return {"ok": True, "id": doc["id"]}


@api_router.patch("/admin/news/{nid}")
async def admin_edit_news(nid: str, body: NewsEdit, admin=Depends(require_admin)):
    updates = body.model_dump(exclude_unset=True)
    if updates:
        await db.news.update_one({"id": nid}, {"$set": updates})
    return {"ok": True}


@api_router.delete("/admin/news/{nid}")
async def admin_delete_news(nid: str, admin=Depends(require_admin)):
    await db.news.delete_one({"id": nid})
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

    if not await db.live_status.find_one({"_id": "current"}):
        await db.live_status.insert_one({
            "_id": "current", "is_live": True,
            "title": "Lode e Adorazione", "artist": "Pescatori di Uomini",
            "artwork": "https://images.unsplash.com/photo-1592818868295-f527dbac420d?w=600&q=85",
            "stream_url": DEMO_STREAM,
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
    logger.info("Seed complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
