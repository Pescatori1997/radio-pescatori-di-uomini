from fastapi import FastAPI, APIRouter, HTTPException, Header
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
@api_router.get("/podcasts")
async def get_podcasts(search: Optional[str] = None, category: Optional[str] = None):
    query = {}
    if category and category != "Tutti":
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.podcasts.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/podcasts/categories")
async def podcast_categories():
    cats = await db.podcasts.distinct("category")
    return ["Tutti"] + sorted(cats)


@api_router.get("/news")
async def get_news():
    docs = await db.news.find({}, {"_id": 0}).sort("date", -1).to_list(200)
    return docs


@api_router.get("/news/{news_id}")
async def get_news_item(news_id: str):
    doc = await db.news.find_one({"id": news_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Notizia non trovata")
    return doc


@api_router.get("/programs")
async def get_programs():
    docs = await db.programs.find({}, {"_id": 0}).to_list(200)
    return docs


@api_router.get("/collaborators")
async def get_collaborators():
    docs = await db.collaborators.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return docs


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
    logger.info("Seed complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
