"""Iteration 47 — Admin-managed Biblioteca folders + content assignment.

Covers:
- Admin email login
- GET /api/library-folders (public seeded defaults, sorted, id/name/icon/order)
- Admin CRUD /api/admin/library-folders (list/create/rename/reorder/delete)
- GET /api/admin/content-catalog (per type items with folder_id)
- POST /api/admin/content-folder (assign/toggle-off)
- GET /api/me/library groups favorites by folder (default_types + explicit assignment)
- Reassignment: favorite moves to new folder in /me/library
"""
import os
import pytest
import requests

BASE = os.environ.get("EXPO_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PASS = "Admin1234!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("user", {}).get("role") == "administrator"
    return j["token"]


@pytest.fixture(scope="module")
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- Public folders ----------------
class TestPublicFolders:
    def test_public_folders_seeded(self):
        r = requests.get(f"{BASE}/api/library-folders", timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 6, arr
        for f in arr:
            for k in ("id", "name", "icon", "order"):
                assert k in f, f
        names = {f["name"] for f in arr}
        # default seed names present (may have more added by admin during other tests)
        for n in ["Podcast", "Meditazioni", "Studi Biblici", "Predicazioni", "Video", "Programmi"]:
            assert n in names, names
        # sorted by order asc
        orders = [f["order"] for f in arr]
        assert orders == sorted(orders)


# ---------------- Admin CRUD ----------------
class TestAdminFolderCRUD:
    def test_admin_list(self, H):
        r = requests.get(f"{BASE}/api/admin/library-folders", headers=H, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 6
        # includes default_types
        assert any((f.get("default_types") or []) for f in arr)

    def test_requires_auth(self):
        assert requests.get(f"{BASE}/api/admin/library-folders", timeout=15).status_code == 401
        assert requests.post(f"{BASE}/api/admin/library-folders", json={"name": "x"}, timeout=15).status_code == 401

    def test_create_rename_reorder_delete(self, H):
        # Create
        r = requests.post(f"{BASE}/api/admin/library-folders", headers=H,
                          json={"name": "TEST_Iter47_Folder", "icon": "star"}, timeout=15)
        assert r.status_code == 200, r.text
        doc = r.json()
        fid = doc["id"]
        assert doc["name"] == "TEST_Iter47_Folder"
        assert doc["icon"] == "star"

        # Rename
        r2 = requests.put(f"{BASE}/api/admin/library-folders/{fid}", headers=H,
                          json={"name": "TEST_Iter47_Renamed"}, timeout=15)
        assert r2.status_code == 200

        # Verify rename via admin list
        arr = requests.get(f"{BASE}/api/admin/library-folders", headers=H, timeout=15).json()
        got = next(f for f in arr if f["id"] == fid)
        assert got["name"] == "TEST_Iter47_Renamed"

        # Reorder: set order=99 then read it back (parallel tests may interfere with position asserts)
        requests.put(f"{BASE}/api/admin/library-folders/{fid}", headers=H, json={"order": 99}, timeout=15)
        arr2 = requests.get(f"{BASE}/api/admin/library-folders", headers=H, timeout=15).json()
        got_after = next(f for f in arr2 if f["id"] == fid)
        assert got_after["order"] == 99, got_after

        # Delete
        rd = requests.delete(f"{BASE}/api/admin/library-folders/{fid}", headers=H, timeout=15)
        assert rd.status_code == 200
        arr3 = requests.get(f"{BASE}/api/admin/library-folders", headers=H, timeout=15).json()
        assert not any(f["id"] == fid for f in arr3)


# ---------------- Content catalog + assignment ----------------
class TestContentCatalog:
    def test_catalog_shape(self, H):
        r = requests.get(f"{BASE}/api/admin/content-catalog", headers=H, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert isinstance(j, dict)
        for t in ["podcast", "meditazioni", "studi-biblici", "predicazioni", "video", "programma"]:
            assert t in j, list(j.keys())
            for it in j[t]:
                for k in ("id", "title", "folder_id"):
                    assert k in it, it

    def test_assign_and_toggle(self, H):
        cat = requests.get(f"{BASE}/api/admin/content-catalog", headers=H, timeout=15).json()
        # find a meditazioni item
        meds = cat.get("meditazioni") or []
        if not meds:
            pytest.skip("No meditations in preview DB")
        item = meds[0]
        folders = requests.get(f"{BASE}/api/library-folders", timeout=15).json()
        # pick a non-default folder (not the Meditazioni default)
        target = next(f for f in folders if f["name"] == "Studi Biblici")

        # Assign
        r = requests.post(f"{BASE}/api/admin/content-folder", headers=H,
                          json={"item_type": "meditazioni", "item_id": item["id"], "folder_id": target["id"]}, timeout=15)
        assert r.status_code == 200

        cat2 = requests.get(f"{BASE}/api/admin/content-catalog", headers=H, timeout=15).json()
        got = next(x for x in cat2["meditazioni"] if x["id"] == item["id"])
        assert got["folder_id"] == target["id"]

        # Toggle off (folder_id null)
        r2 = requests.post(f"{BASE}/api/admin/content-folder", headers=H,
                           json={"item_type": "meditazioni", "item_id": item["id"], "folder_id": None}, timeout=15)
        assert r2.status_code == 200
        cat3 = requests.get(f"{BASE}/api/admin/content-catalog", headers=H, timeout=15).json()
        got2 = next(x for x in cat3["meditazioni"] if x["id"] == item["id"])
        assert got2["folder_id"] is None


# ---------------- /me/library grouping ----------------
class TestMyLibrary:
    def _ensure_med_fav(self, H, med_id, on: bool):
        ids = requests.get(f"{BASE}/api/me/content-fav-ids", headers=H, timeout=15).json()
        is_fav = med_id in (ids.get("meditazioni") or [])
        if is_fav != on:
            requests.post(f"{BASE}/api/me/content-fav/meditazioni/{med_id}", headers=H, timeout=15)

    def test_favorite_lands_in_default_folder(self, H):
        meds = requests.get(f"{BASE}/api/meditations", timeout=15).json()
        if not meds:
            pytest.skip("No meditations")
        med_id = meds[0]["id"]

        # clear any old assignment for this item
        requests.post(f"{BASE}/api/admin/content-folder", headers=H,
                      json={"item_type": "meditazioni", "item_id": med_id, "folder_id": None}, timeout=15)
        self._ensure_med_fav(H, med_id, True)

        lib = requests.get(f"{BASE}/api/me/library", headers=H, timeout=15).json()
        groups = lib.get("groups") or []
        found = None
        for g in groups:
            if any(it["id"] == med_id for it in g["items"]):
                found = g
                break
        assert found is not None, lib
        # default_types for meditazioni is 'Meditazioni'
        assert found["label"] == "Meditazioni", found

        # cleanup: unfavorite
        self._ensure_med_fav(H, med_id, False)

    def test_reassignment_moves_favorite(self, H):
        meds = requests.get(f"{BASE}/api/meditations", timeout=15).json()
        if not meds:
            pytest.skip("No meditations")
        med_id = meds[0]["id"]

        # Create a dedicated folder
        folder = requests.post(f"{BASE}/api/admin/library-folders", headers=H,
                               json={"name": "TEST_Iter47_Assign", "icon": "star"}, timeout=15).json()
        fid = folder["id"]
        try:
            # Assign
            requests.post(f"{BASE}/api/admin/content-folder", headers=H,
                          json={"item_type": "meditazioni", "item_id": med_id, "folder_id": fid}, timeout=15)
            self._ensure_med_fav(H, med_id, True)

            lib = requests.get(f"{BASE}/api/me/library", headers=H, timeout=15).json()
            g = next(x for x in lib["groups"] if x["folder_id"] == fid)
            assert any(it["id"] == med_id for it in g["items"]), g
            assert g["label"] == "TEST_Iter47_Assign"
        finally:
            # cleanup
            self._ensure_med_fav(H, med_id, False)
            requests.post(f"{BASE}/api/admin/content-folder", headers=H,
                          json={"item_type": "meditazioni", "item_id": med_id, "folder_id": None}, timeout=15)
            requests.delete(f"{BASE}/api/admin/library-folders/{fid}", headers=H, timeout=15)
