"""CMS Universale Fase 1 - Backend tests
Endpoints under /api/content-sections, /api/contents, /api/admin/contents/*.
Uses admin login with email/password to obtain a Bearer token.
Cleans up all TEST_-prefixed contents; NEVER touches cnt_seed1 / cnt_seed2.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://evangelic-stream.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PWD = "AdminTestPwd1!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # cleanup: delete every content we created (auth using module admin token via new session)
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=15)
        tok = r.json().get("token")
        h = {"Authorization": f"Bearer {tok}"}
        for cid in ids:
            requests.delete(f"{BASE_URL}/api/admin/contents/{cid}", headers=h, timeout=10)
    except Exception as e:
        print("cleanup failed:", e)


# ---------- content-sections ----------
def test_content_sections_returns_six():
    r = requests.get(f"{BASE_URL}/api/content-sections", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 6, f"Expected 6 sections, got {len(data)}: {data}"
    keys = {d["key"] for d in data}
    assert {"studi-biblici", "predicazioni", "video", "eventi", "galleria", "download"} <= keys


# ---------- FIX param undefined: seed studi-biblici ----------
def test_public_studi_biblici_returns_seed_items():
    r = requests.get(f"{BASE_URL}/api/contents", params={"section": "studi-biblici"}, timeout=10)
    assert r.status_code == 200, r.text
    docs = r.json()
    titles = [d.get("title") for d in docs]
    assert "Il Sermone sul Monte" in titles, f"Missing seed 1. Got: {titles}"
    assert "La Fede di Abramo" in titles, f"Missing seed 2. Got: {titles}"


def test_invalid_section_returns_404():
    r = requests.get(f"{BASE_URL}/api/contents", params={"section": "not-a-section"}, timeout=10)
    assert r.status_code == 404


# ---------- draft vs published visibility ----------
def test_draft_hidden_and_published_visible_in_public(auth, created_ids):
    # Create draft in 'predicazioni'
    body = {"section": "predicazioni", "title": "TEST_Draft_Predica", "status": "draft",
            "category": "Domenica", "description": "sermone di prova", "video_url": "https://youtu.be/dQw4w9WgXcQ"}
    r = requests.post(f"{BASE_URL}/api/admin/contents", json=body, headers=auth, timeout=15)
    assert r.status_code == 201, r.text
    did = r.json()["id"]
    created_ids.append(did)

    pub = requests.get(f"{BASE_URL}/api/contents", params={"section": "predicazioni"}, timeout=10)
    assert pub.status_code == 200
    ids = [d.get("id") for d in pub.json()]
    assert did not in ids, "Draft should NOT appear in public list"

    # Create published in 'predicazioni'
    body2 = {"section": "predicazioni", "title": "TEST_Pub_Predica", "status": "published",
             "category": "Domenica", "video_url": "https://youtu.be/dQw4w9WgXcQ"}
    r2 = requests.post(f"{BASE_URL}/api/admin/contents", json=body2, headers=auth, timeout=15)
    assert r2.status_code == 201
    pid = r2.json()["id"]
    created_ids.append(pid)

    pub2 = requests.get(f"{BASE_URL}/api/contents", params={"section": "predicazioni"}, timeout=10)
    ids2 = [d.get("id") for d in pub2.json()]
    assert pid in ids2, f"Published content should appear in public list. Got ids: {ids2}"


# ---------- PATCH ----------
def test_patch_updates_title_and_category(auth, created_ids):
    body = {"section": "predicazioni", "title": "TEST_Patch_Orig", "status": "draft", "category": "OldCat"}
    r = requests.post(f"{BASE_URL}/api/admin/contents", json=body, headers=auth, timeout=15)
    assert r.status_code == 201
    cid = r.json()["id"]
    created_ids.append(cid)

    upd = requests.patch(f"{BASE_URL}/api/admin/contents/{cid}",
                        json={"title": "TEST_Patch_New", "category": "NewCat"}, headers=auth, timeout=15)
    assert upd.status_code == 200

    got = requests.get(f"{BASE_URL}/api/admin/contents/item/{cid}", headers=auth, timeout=10)
    assert got.status_code == 200
    d = got.json()
    assert d["title"] == "TEST_Patch_New"
    assert d["category"] == "NewCat"


# ---------- duplicate ----------
def test_duplicate_creates_draft_copy(auth, created_ids):
    body = {"section": "predicazioni", "title": "TEST_ToDup", "status": "published", "category": "X"}
    r = requests.post(f"{BASE_URL}/api/admin/contents", json=body, headers=auth, timeout=15)
    assert r.status_code == 201
    src = r.json()["id"]
    created_ids.append(src)

    dup = requests.post(f"{BASE_URL}/api/admin/contents/{src}/duplicate", headers=auth, timeout=15)
    assert dup.status_code == 201
    dup_id = dup.json()["id"]
    created_ids.append(dup_id)
    assert dup_id != src

    got = requests.get(f"{BASE_URL}/api/admin/contents/item/{dup_id}", headers=auth, timeout=10)
    assert got.status_code == 200
    d = got.json()
    assert d["status"] == "draft"
    assert "(copia)" in d["title"]


# ---------- delete ----------
def test_delete_removes_content(auth, created_ids):
    body = {"section": "predicazioni", "title": "TEST_ToDelete", "status": "draft"}
    r = requests.post(f"{BASE_URL}/api/admin/contents", json=body, headers=auth, timeout=15)
    assert r.status_code == 201
    cid = r.json()["id"]

    dele = requests.delete(f"{BASE_URL}/api/admin/contents/{cid}", headers=auth, timeout=10)
    assert dele.status_code == 200

    got = requests.get(f"{BASE_URL}/api/admin/contents/item/{cid}", headers=auth, timeout=10)
    assert got.status_code == 404


# ---------- filter category & search ----------
def test_public_filters_category_and_search(auth, created_ids):
    # create two published items with distinct category and title
    a = {"section": "predicazioni", "title": "TEST_FiltroA_Grazia", "status": "published", "category": "Filtri_A"}
    b = {"section": "predicazioni", "title": "TEST_FiltroB_Fede", "status": "published", "category": "Filtri_B"}
    ra = requests.post(f"{BASE_URL}/api/admin/contents", json=a, headers=auth, timeout=15).json()
    rb = requests.post(f"{BASE_URL}/api/admin/contents", json=b, headers=auth, timeout=15).json()
    created_ids.extend([ra["id"], rb["id"]])

    fa = requests.get(f"{BASE_URL}/api/contents",
                     params={"section": "predicazioni", "category": "Filtri_A"}, timeout=10).json()
    ids_fa = {d["id"] for d in fa}
    assert ra["id"] in ids_fa
    assert rb["id"] not in ids_fa

    fs = requests.get(f"{BASE_URL}/api/contents",
                     params={"section": "predicazioni", "search": "FiltroB_Fede"}, timeout=10).json()
    ids_fs = {d["id"] for d in fs}
    assert rb["id"] in ids_fs
    assert ra["id"] not in ids_fs


# ---------- auth guard ----------
def test_admin_routes_require_auth():
    # POST
    r = requests.post(f"{BASE_URL}/api/admin/contents",
                      json={"section": "predicazioni", "title": "no-auth"}, timeout=10)
    assert r.status_code == 401
    # GET admin list
    r2 = requests.get(f"{BASE_URL}/api/admin/contents", params={"section": "predicazioni"}, timeout=10)
    assert r2.status_code == 401
    # PATCH
    r3 = requests.patch(f"{BASE_URL}/api/admin/contents/xxx", json={"title": "x"}, timeout=10)
    assert r3.status_code == 401
    # DELETE
    r4 = requests.delete(f"{BASE_URL}/api/admin/contents/xxx", timeout=10)
    assert r4.status_code == 401


# ---------- seeds not touched (safety) ----------
def test_seed_items_still_present_at_end():
    r = requests.get(f"{BASE_URL}/api/contents", params={"section": "studi-biblici"}, timeout=10)
    titles = [d.get("title") for d in r.json()]
    assert "Il Sermone sul Monte" in titles
    assert "La Fede di Abramo" in titles
