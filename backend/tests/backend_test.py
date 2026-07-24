"""Backend tests for Pescatori di Uomini API."""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

TEST_EMAIL = f"test_{int(time.time())}@pescatoridiuomini.it"
TEST_PWD = "Test1234!"
TEST_NAME = "Utente Test"

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})
state = {}


# --- Live status ---
def test_live_status():
    r = session.get(f"{API}/live/status", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("is_live", "title", "stream_url"):
        assert k in d


# --- Podcasts ---
def test_podcasts_list():
    r = session.get(f"{API}/podcasts", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    state["pod_id"] = data[0]["id"]
    for k in ("id", "title", "category", "audio_url"):
        assert k in data[0]


def test_podcasts_categories():
    r = session.get(f"{API}/podcasts/categories", timeout=15)
    assert r.status_code == 200
    cats = r.json()
    assert isinstance(cats, list) and "Tutti" in cats


def test_podcasts_search():
    r = session.get(f"{API}/podcasts", params={"search": "grazia"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        assert any("grazia" in (p.get("title", "") + p.get("description", "")).lower() for p in data)


def test_podcasts_category_filter():
    r = session.get(f"{API}/podcasts", params={"category": "Predicazioni"}, timeout=15)
    assert r.status_code == 200
    for p in r.json():
        assert p["category"] == "Predicazioni"


# --- News ---
def test_news_list():
    r = session.get(f"{API}/news", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    state["news_id"] = data[0]["id"]


def test_news_detail():
    r = session.get(f"{API}/news/{state['news_id']}", timeout=15)
    assert r.status_code == 200
    assert r.json()["id"] == state["news_id"]


def test_news_detail_404():
    r = session.get(f"{API}/news/nonexistent_id_xyz", timeout=15)
    assert r.status_code == 404


# --- Programs ---
def test_programs_list():
    r = session.get(f"{API}/programs", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0


# --- Public form endpoints ---
def test_prayer_anonymous():
    r = session.post(f"{API}/prayer-requests",
                     json={"text": "TEST_ Prega per la mia famiglia", "anonymous": True, "name": "Ignored"},
                     timeout=15)
    assert r.status_code == 200 and r.json().get("ok") is True


def test_prayer_named():
    r = session.post(f"{API}/prayer-requests",
                     json={"text": "TEST_ Preghiera nominata", "anonymous": False, "name": "TEST_User"},
                     timeout=15)
    assert r.status_code == 200


def test_messages():
    r = session.post(f"{API}/messages",
                     json={"text": "TEST_ Messaggio dal test", "name": "TEST_Utente", "type": "message"},
                     timeout=15)
    assert r.status_code == 200


def test_contact():
    r = session.post(f"{API}/contact",
                     json={"name": "TEST_Utente", "email": "test@x.it", "message": "TEST_ Ciao"},
                     timeout=15)
    assert r.status_code == 200


# --- Auth ---
def test_register():
    r = session.post(f"{API}/auth/register",
                     json={"email": TEST_EMAIL, "password": TEST_PWD, "name": TEST_NAME},
                     timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "token" in d and d["user"]["email"] == TEST_EMAIL
    state["token"] = d["token"]


def test_register_duplicate():
    r = session.post(f"{API}/auth/register",
                     json={"email": TEST_EMAIL, "password": TEST_PWD, "name": TEST_NAME},
                     timeout=15)
    assert r.status_code == 400


def test_login_bad():
    r = session.post(f"{API}/auth/login",
                     json={"email": TEST_EMAIL, "password": "wrong"}, timeout=15)
    assert r.status_code == 401


def test_login_good():
    r = session.post(f"{API}/auth/login",
                     json={"email": TEST_EMAIL, "password": TEST_PWD}, timeout=15)
    assert r.status_code == 200
    state["token"] = r.json()["token"]


def _auth():
    return {"Authorization": f"Bearer {state['token']}", "Content-Type": "application/json"}


def test_me():
    r = requests.get(f"{API}/auth/me", headers=_auth(), timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == TEST_EMAIL


def test_me_unauth():
    r = requests.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401


# --- Favorites & History ---
def test_favorite_toggle_on():
    pid = state["pod_id"]
    r = requests.post(f"{API}/me/favorites/{pid}", headers=_auth(), timeout=15)
    assert r.status_code == 200 and r.json()["favorited"] is True


def test_favorite_ids_contains():
    r = requests.get(f"{API}/me/favorite-ids", headers=_auth(), timeout=15)
    assert r.status_code == 200 and state["pod_id"] in r.json()


def test_favorites_list():
    r = requests.get(f"{API}/me/favorites", headers=_auth(), timeout=15)
    assert r.status_code == 200
    assert any(p["id"] == state["pod_id"] for p in r.json())


def test_favorite_toggle_off():
    pid = state["pod_id"]
    r = requests.post(f"{API}/me/favorites/{pid}", headers=_auth(), timeout=15)
    assert r.status_code == 200 and r.json()["favorited"] is False


def test_history_add():
    pid = state["pod_id"]
    r = requests.post(f"{API}/me/history/{pid}", headers=_auth(), timeout=15)
    assert r.status_code == 200


def test_history_get():
    r = requests.get(f"{API}/me/history", headers=_auth(), timeout=15)
    assert r.status_code == 200
    assert any(p["id"] == state["pod_id"] for p in r.json())


def test_logout():
    r = requests.post(f"{API}/auth/logout", headers=_auth(), timeout=15)
    assert r.status_code == 200
    # token should now be invalid
    r2 = requests.get(f"{API}/auth/me", headers=_auth(), timeout=15)
    assert r2.status_code == 401


# --- Crew (L'Equipaggio) ---
def test_crew_list():
    r = session.get(f"{API}/crew", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 1
    luigi = next((m for m in data if m["id"] == "crew_luigi_volpe"), None)
    assert luigi is not None, "Luigi Volpe missing from crew list"
    assert luigi.get("poster") is True
    assert luigi.get("published") is True
    for k in ("name", "role", "mission", "bio", "ministry", "programs", "verse", "verse_ref", "testimony"):
        assert k in luigi, f"missing field {k}"
    assert isinstance(luigi["programs"], list)


def test_crew_member_detail():
    r = session.get(f"{API}/crew/crew_luigi_volpe", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == "crew_luigi_volpe"
    assert d["name"] == "Luigi Volpe"
    assert d["poster"] is True
    assert d["verse_ref"] == "Giovanni 15:16"
    assert len(d["testimony"]) > 20
    assert len(d["bio"]) > 20


def test_crew_member_404():
    r = session.get(f"{API}/crew/nonexistent_crew_id", timeout=15)
    assert r.status_code == 404


def test_crew_application_full():
    payload = {
        "name": "TEST_Mario",
        "surname": "TEST_Rossi",
        "age": 30,
        "city": "Roma",
        "email": "test_apply@pescatoridiuomini.it",
        "phone": "+391234567890",
        "desired_role": "Speaker",
        "testimony": "TEST_ La mia testimonianza",
        "motivation": "TEST_ Vorrei servire il Signore attraverso la radio",
        "experience": "TEST_ Nessuna esperienza precedente",
        "portrait": None,
    }
    r = session.post(f"{API}/crew/applications", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True


def test_crew_application_minimal():
    payload = {
        "name": "TEST_Anna",
        "surname": "TEST_Bianchi",
        "email": "test_minimal@pescatoridiuomini.it",
        "desired_role": "Preghiera",
        "motivation": "TEST_ Chiamata alla preghiera",
    }
    r = session.post(f"{API}/crew/applications", json=payload, timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_crew_application_missing_required():
    # missing motivation
    payload = {
        "name": "TEST_x", "surname": "TEST_y",
        "email": "bad@x.it", "desired_role": "Altro",
    }
    r = session.post(f"{API}/crew/applications", json=payload, timeout=15)
    assert r.status_code == 422


def test_crew_applications_not_publicly_listed():
    # No public GET should expose the applications
    r = session.get(f"{API}/crew/applications", timeout=15)
    # Should either be 404 (no route) or 405 (method not allowed) - never 200 with list
    assert r.status_code in (404, 405), f"applications should NOT be publicly listed, got {r.status_code}"
