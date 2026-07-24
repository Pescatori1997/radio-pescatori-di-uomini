"""Podcast + News CMS tests for Pescatori di Uomini.

- Uses admin token ADMINTESTTOKEN123 (seeded by conftest).
- Only creates ZZTEST-prefixed content; cleans up at the end.
- MUST NOT touch existing seeded content.
"""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"

ADMIN = {"Authorization": "Bearer ADMINTESTTOKEN123", "Content-Type": "application/json"}

PODCAST_ADMIN_ENDPOINTS = [
    ("GET", "/admin/podcasts"),
    ("POST", "/admin/podcasts"),
    ("PATCH", "/admin/podcasts/xyz"),
    ("DELETE", "/admin/podcasts/xyz"),
    ("POST", "/admin/podcasts/featured-order"),
]
NEWS_ADMIN_ENDPOINTS = [
    ("GET", "/admin/news"),
    ("POST", "/admin/news"),
    ("PATCH", "/admin/news/xyz"),
    ("DELETE", "/admin/news/xyz"),
]

state = {}


def _call(method, path, headers=None, json=None):
    return requests.request(method, f"{API}{path}", headers=headers or {}, json=json, timeout=15)


# ---------------- Security ----------------
@pytest.mark.parametrize("method,path", PODCAST_ADMIN_ENDPOINTS + NEWS_ADMIN_ENDPOINTS)
def test_cms_endpoint_requires_auth(method, path):
    r = _call(method, path, headers={"Content-Type": "application/json"},
              json={} if method in ("PATCH", "POST") else None)
    assert r.status_code == 401, f"{method} {path} expected 401 got {r.status_code}"


def test_cms_non_admin_gets_403():
    email = f"nonadmin_cms_{int(time.time())}@pescatoridiuomini.it"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!", "name": "N"}, timeout=15)
    assert r.status_code == 200
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    for method, path in PODCAST_ADMIN_ENDPOINTS + NEWS_ADMIN_ENDPOINTS:
        r = _call(method, path, headers=h, json={} if method in ("PATCH", "POST") else None)
        assert r.status_code == 403, f"{method} {path} expected 403 got {r.status_code}"


# ---------------- Podcast CMS ----------------
def test_podcast_full_lifecycle():
    payload = {
        "title": "ZZTEST Podcast Alpha",
        "subtitle": "ZZTEST subtitle",
        "description": "ZZTEST description text",
        "author": "ZZTEST Author",
        "category": "ZZTESTCat",
        "tags": ["zztest", "alpha"],
        "artwork": "https://example.com/a.jpg",
        "audio_url": "https://example.com/a.mp3",
        "episode_number": 42,
        "duration": "12:34",
        "featured": False,
        "published": False,
    }
    # Create draft
    r = requests.post(f"{API}/admin/podcasts", headers=ADMIN, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    state["pid"] = pid

    # NOT in public list while draft
    r = requests.get(f"{API}/podcasts", timeout=15)
    assert r.status_code == 200
    assert pid not in [p["id"] for p in r.json()], "draft podcast leaked to public"

    # Admin list finds it (status=draft, search)
    r = requests.get(f"{API}/admin/podcasts", params={"status": "draft"}, headers=ADMIN, timeout=15)
    assert r.status_code == 200
    assert pid in [p["id"] for p in r.json()]
    r = requests.get(f"{API}/admin/podcasts", params={"search": "ZZTEST Podcast Alpha"}, headers=ADMIN, timeout=15)
    assert pid in [p["id"] for p in r.json()]

    # Publish
    r = requests.patch(f"{API}/admin/podcasts/{pid}", headers=ADMIN, json={"published": True}, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/podcasts", timeout=15)
    ids = [p["id"] for p in r.json()]
    assert pid in ids, "published podcast missing from public list"

    # Ensure CMS fields present on public payload
    pub = next(p for p in r.json() if p["id"] == pid)
    for k in ("subtitle", "tags", "episode_number", "featured"):
        assert k in pub, f"public podcast missing field {k}"
    assert pub["subtitle"] == "ZZTEST subtitle"
    assert pub["episode_number"] == 42

    # Admin list status=published finds it
    r = requests.get(f"{API}/admin/podcasts", params={"status": "published"}, headers=ADMIN, timeout=15)
    assert pid in [p["id"] for p in r.json()]

    # Feature it
    r = requests.patch(f"{API}/admin/podcasts/{pid}", headers=ADMIN, json={"featured": True}, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/podcasts/featured", timeout=15)
    assert r.status_code == 200
    assert pid in [p["id"] for p in r.json()], "featured podcast missing from /podcasts/featured"

    # Featured-order reorder (single-item ok)
    r = requests.post(f"{API}/admin/podcasts/featured-order", headers=ADMIN, json={"ids": [pid]}, timeout=15)
    assert r.status_code == 200

    # Detail
    r = requests.get(f"{API}/podcasts/{pid}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["title"] == payload["title"]
    assert d["episode_number"] == 42

    # Unpublish -> disappears from public
    r = requests.patch(f"{API}/admin/podcasts/{pid}", headers=ADMIN, json={"published": False}, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/podcasts", timeout=15)
    assert pid not in [p["id"] for p in r.json()], "unpublished podcast still appears publicly"

    # Delete
    r = requests.delete(f"{API}/admin/podcasts/{pid}", headers=ADMIN, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/podcasts/{pid}", timeout=15)
    assert r.status_code == 404
    state.pop("pid", None)


# ---------------- News CMS ----------------
def test_news_full_lifecycle():
    body_text = "ZZTEST body " + ("word " * 300)  # ~300 words -> reading_time >=1
    payload = {
        "title": "ZZTEST News Alpha",
        "excerpt": "ZZTEST excerpt",
        "body": body_text,
        "category": "ZZTESTNewsCat",
        "author": "ZZTEST Author",
        "image": "https://example.com/n.jpg",
        "featured": False,
        "published": False,
    }
    r = requests.post(f"{API}/admin/news", headers=ADMIN, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    nid = r.json()["id"]
    state["nid"] = nid

    # Not public while draft
    r = requests.get(f"{API}/news", timeout=15)
    assert r.status_code == 200
    assert nid not in [n["id"] for n in r.json()], "draft news leaked to public"

    # Admin draft filter + search
    r = requests.get(f"{API}/admin/news", params={"status": "draft"}, headers=ADMIN, timeout=15)
    assert nid in [n["id"] for n in r.json()]
    r = requests.get(f"{API}/admin/news", params={"search": "ZZTEST News Alpha"}, headers=ADMIN, timeout=15)
    assert nid in [n["id"] for n in r.json()]

    # Publish
    r = requests.patch(f"{API}/admin/news/{nid}", headers=ADMIN, json={"published": True}, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/news", timeout=15)
    docs = r.json()
    ids = [n["id"] for n in docs]
    assert nid in ids
    item = next(n for n in docs if n["id"] == nid)
    for k in ("excerpt", "featured", "reading_time"):
        assert k in item, f"public news missing {k}"
    assert item["reading_time"] >= 1

    # Feature -> in /news/featured
    r = requests.patch(f"{API}/admin/news/{nid}", headers=ADMIN, json={"featured": True}, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/news/featured", timeout=15)
    assert r.status_code == 200
    assert nid in [n["id"] for n in r.json()]

    # Detail contains reading_time
    r = requests.get(f"{API}/news/{nid}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "reading_time" in d and d["reading_time"] >= 1

    # Categories include our category
    r = requests.get(f"{API}/news/categories", timeout=15)
    assert r.status_code == 200
    cats = r.json()
    assert "ZZTESTNewsCat" in cats

    # Delete
    r = requests.delete(f"{API}/admin/news/{nid}", headers=ADMIN, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/news/{nid}", timeout=15)
    assert r.status_code == 404
    state.pop("nid", None)


# ---------------- Public endpoints unchanged ----------------
def test_public_endpoints_and_regression():
    for path in ["/podcasts", "/news", "/crew", "/live/status", "/programs", "/podcasts/featured",
                 "/news/featured", "/podcasts/categories", "/news/categories"]:
        r = requests.get(f"{API}{path}", timeout=15)
        assert r.status_code == 200, f"{path} -> {r.status_code}"


def test_public_only_published():
    r = requests.get(f"{API}/podcasts", timeout=15)
    for p in r.json():
        assert p.get("published", True) is not False
    r = requests.get(f"{API}/news", timeout=15)
    for n in r.json():
        assert n.get("published", True) is not False


# ---------------- Data safety ----------------
def test_luigi_untouched():
    r = requests.get(f"{API}/crew/crew_luigi_volpe", timeout=15)
    assert r.status_code == 200
    assert r.json()["published"] is True


# ---------------- Final ZZTEST cleanup (safety net) ----------------
def test_zzz_final_cleanup():
    # Podcasts
    r = requests.get(f"{API}/admin/podcasts", params={"search": "ZZTEST"}, headers=ADMIN, timeout=15)
    for d in r.json():
        requests.delete(f"{API}/admin/podcasts/{d['id']}", headers=ADMIN, timeout=15)
    # News
    r = requests.get(f"{API}/admin/news", params={"search": "ZZTEST"}, headers=ADMIN, timeout=15)
    for d in r.json():
        requests.delete(f"{API}/admin/news/{d['id']}", headers=ADMIN, timeout=15)
    r = requests.get(f"{API}/admin/podcasts", params={"search": "ZZTEST"}, headers=ADMIN, timeout=15)
    assert r.json() == []
    r = requests.get(f"{API}/admin/news", params={"search": "ZZTEST"}, headers=ADMIN, timeout=15)
    assert r.json() == []
