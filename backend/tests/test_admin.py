"""Admin RBAC + approval workflow tests for Pescatori di Uomini.

Guardrails:
- Uses admin token ADMINTESTTOKEN123 (seeded by conftest).
- Only creates & mutates ZZTEST_ applications/crew created by these tests.
- MUST NOT touch Luigi Volpe (crew_luigi_volpe) or Concetta Chiofro's application.
"""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
API = f"{BASE}/api"

ADMIN_TOKEN = "ADMINTESTTOKEN123"
ADMIN_H = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}
ADMIN_ADMIN_ENDPOINTS = [
    ("GET", "/admin/me"),
    ("GET", "/admin/stats"),
    ("GET", "/admin/applications"),
    ("GET", "/admin/applications/xyz"),
    ("PATCH", "/admin/applications/xyz"),
    ("POST", "/admin/applications/xyz/approve"),
    ("POST", "/admin/applications/xyz/reject"),
    ("DELETE", "/admin/applications/xyz"),
    ("GET", "/admin/crew"),
    ("PATCH", "/admin/crew/xyz"),
    ("POST", "/admin/crew/xyz/portrait"),
    ("DELETE", "/admin/crew/xyz"),
]

state = {}


def _call(method, path, headers=None, json=None):
    return requests.request(method, f"{API}{path}", headers=headers or {}, json=json, timeout=15)


# ---------------- Security: no auth => 401 ----------------
@pytest.mark.parametrize("method,path", ADMIN_ADMIN_ENDPOINTS)
def test_admin_endpoint_requires_auth(method, path):
    r = _call(method, path, headers={"Content-Type": "application/json"}, json={} if method in ("PATCH", "POST") else None)
    assert r.status_code == 401, f"{method} {path} expected 401 got {r.status_code}"


# ---------------- Security: non-admin => 403 ----------------
def test_non_admin_gets_403():
    email = f"nonadmin_{int(time.time())}@pescatoridiuomini.it"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!", "name": "NonAdmin"}, timeout=15)
    assert r.status_code == 200
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    for method, path in ADMIN_ADMIN_ENDPOINTS:
        r = _call(method, path, headers=h, json={} if method in ("PATCH", "POST") else None)
        assert r.status_code == 403, f"{method} {path} expected 403 got {r.status_code}"


# ---------------- Admin auth ----------------
def test_admin_me():
    r = requests.get(f"{API}/admin/me", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["is_admin"] is True
    assert d["user"]["email"] == "pescatoridiuomini@outlook.it"


def test_admin_stats():
    r = requests.get(f"{API}/admin/stats", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("pending_applications", "approved_members", "total_users", "prayer_requests", "news", "podcasts"):
        assert k in d and isinstance(d[k], int)


# ---------------- Applications filters ----------------
def test_admin_applications_filters():
    for st in ("pending", "approved", "rejected"):
        r = requests.get(f"{API}/admin/applications", params={"status": st}, headers=ADMIN_H, timeout=15)
        assert r.status_code == 200
        for a in r.json():
            assert a.get("status") == st

    r = requests.get(f"{API}/admin/applications", params={"sort": "oldest"}, headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/admin/applications", params={"search": "ZZ"}, headers=ADMIN_H, timeout=15)
    assert r.status_code == 200


# ---------------- Approval workflow ----------------
def _create_app(name_suffix):
    payload = {
        "name": f"ZZTEST_{name_suffix}",
        "surname": "Approve",
        "age": 33,
        "city": "Testcity",
        "email": f"zztest_{name_suffix}_{int(time.time())}@pescatoridiuomini.it",
        "desired_role": "Speaker",
        "motivation": "ZZTEST motivation",
        "testimony": "ZZTEST testimonianza sufficiently long text.",
        "experience": "ZZTEST exp",
    }
    r = requests.post(f"{API}/crew/applications", json=payload, timeout=15)
    assert r.status_code == 200
    # find id via admin list search
    r = requests.get(f"{API}/admin/applications", params={"search": f"ZZTEST_{name_suffix}"}, headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    docs = [d for d in r.json() if d.get("name") == f"ZZTEST_{name_suffix}" and d.get("email") == payload["email"].lower()]
    assert docs, "created application not found"
    return docs[0]["id"], payload


def test_approve_creates_public_crew_member_and_sync_and_delete():
    app_id, payload = _create_app("Approve")
    state["approve_app_id"] = app_id

    # approve
    r = requests.post(f"{API}/admin/applications/{app_id}/approve", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200, r.text
    crew_id = r.json()["crew_id"]
    assert crew_id

    # admin application should now be approved with crew_id
    r = requests.get(f"{API}/admin/applications/{app_id}", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "approved"
    assert d["crew_id"] == crew_id

    # public GET /api/crew must include the new member
    r = requests.get(f"{API}/crew", timeout=15)
    assert r.status_code == 200
    ids = [m["id"] for m in r.json()]
    assert crew_id in ids, "approved application did not create public crew member"

    # PATCH edit application syncs to public crew
    new_role = "ZZTEST Speaker Updated"
    r = requests.patch(f"{API}/admin/applications/{app_id}", headers=ADMIN_H, json={"role": new_role, "mission": "ZZTEST mission"}, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/crew/{crew_id}", timeout=15)
    assert r.status_code == 200
    m = r.json()
    assert m["role"] == new_role
    assert m["mission"] == "ZZTEST mission"

    # PATCH crew directly
    r = requests.patch(f"{API}/admin/crew/{crew_id}", headers=ADMIN_H, json={"ministry": "ZZTEST ministry"}, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/crew/{crew_id}", timeout=15)
    assert r.json()["ministry"] == "ZZTEST ministry"

    # POST portrait
    r = requests.post(f"{API}/admin/crew/{crew_id}/portrait", headers=ADMIN_H, json={"portrait": "data:image/png;base64,ZZTEST"}, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/crew/{crew_id}", timeout=15)
    assert r.json()["portrait"] == "data:image/png;base64,ZZTEST"

    # admin crew list contains our member
    r = requests.get(f"{API}/admin/crew", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    assert any(x["id"] == crew_id for x in r.json())

    # DELETE application removes both the app and the linked crew member
    r = requests.delete(f"{API}/admin/applications/{app_id}", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/crew", timeout=15)
    ids = [m["id"] for m in r.json()]
    assert crew_id not in ids, "public crew still contains deleted member"
    r = requests.get(f"{API}/admin/applications/{app_id}", headers=ADMIN_H, timeout=15)
    assert r.status_code == 404


def test_reject_does_not_publish_and_delete_cleanup():
    app_id, _ = _create_app("Reject")
    r = requests.post(f"{API}/admin/applications/{app_id}/reject", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{API}/admin/applications/{app_id}", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "rejected"
    assert d.get("crew_id") in (None,)

    # public GET /api/crew must NOT contain this application's name
    r = requests.get(f"{API}/crew", timeout=15)
    assert r.status_code == 200
    for m in r.json():
        assert "ZZTEST_Reject" not in m.get("name", ""), "rejected application appeared in public crew"

    # cleanup
    r = requests.delete(f"{API}/admin/applications/{app_id}", headers=ADMIN_H, timeout=15)
    assert r.status_code == 200


# ---------------- Public endpoints unaffected ----------------
@pytest.mark.parametrize("path", ["/crew", "/live/status", "/podcasts", "/news", "/programs"])
def test_public_endpoints_still_work(path):
    r = requests.get(f"{API}{path}", timeout=15)
    assert r.status_code == 200


# ---------------- Data safety guardrails ----------------
def test_luigi_and_concetta_untouched():
    # Luigi still published
    r = requests.get(f"{API}/crew/crew_luigi_volpe", timeout=15)
    assert r.status_code == 200
    assert r.json()["published"] is True

    # Concetta's application still pending
    r = requests.get(f"{API}/admin/applications", params={"search": "Concetta"}, headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    matches = [d for d in r.json() if d.get("surname", "").lower() == "chiofro"]
    assert matches, "Concetta application unexpectedly missing"
    assert matches[0]["status"] == "pending", "Concetta's application must remain pending"


# ---------------- Cleanup: remove any leftover ZZTEST data ----------------
def test_zzz_final_cleanup():
    r = requests.get(f"{API}/admin/applications", params={"search": "ZZTEST"}, headers=ADMIN_H, timeout=15)
    assert r.status_code == 200
    for d in r.json():
        requests.delete(f"{API}/admin/applications/{d['id']}", headers=ADMIN_H, timeout=15)
    r = requests.get(f"{API}/admin/applications", params={"search": "ZZTEST"}, headers=ADMIN_H, timeout=15)
    assert r.json() == []
