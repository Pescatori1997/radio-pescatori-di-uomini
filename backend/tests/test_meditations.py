"""Backend tests for Meditazioni feature (iteration 18)."""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or os.environ.get("EXPO_BACKEND_URL")
            or "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
ADMIN = {"Authorization": "Bearer ADMINTESTTOKEN123", "Content-Type": "application/json"}
UNAUTH = {"Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_ids():
    ids: list[str] = []
    yield ids
    # cleanup
    for mid in ids:
        try:
            requests.delete(f"{BASE_URL}/api/admin/meditations/{mid}", headers=ADMIN, timeout=10)
        except Exception:
            pass


# -------- Auth / permissions --------
class TestAuth:
    def test_admin_list_unauth_403(self):
        r = requests.get(f"{BASE_URL}/api/admin/meditations", timeout=10)
        assert r.status_code in (401, 403)

    def test_admin_create_unauth_403(self):
        r = requests.post(f"{BASE_URL}/api/admin/meditations",
                          headers=UNAUTH, json={"title": "TEST_x"}, timeout=10)
        assert r.status_code in (401, 403)


# -------- Public endpoints --------
class TestPublic:
    def test_public_list_ok(self):
        r = requests.get(f"{BASE_URL}/api/meditations", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_public_categories_ok(self):
        r = requests.get(f"{BASE_URL}/api/meditations/categories", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_public_detail_404(self):
        r = requests.get(f"{BASE_URL}/api/meditations/does_not_exist_xxx", timeout=10)
        assert r.status_code == 404

    def test_public_detail_demo(self):
        r = requests.get(f"{BASE_URL}/api/meditations/med_2a1f82f6f373", timeout=10)
        # If seed exists, should be 200; if not, at least 404
        assert r.status_code in (200, 404)


# -------- CRUD flow (draft, published, scheduled) --------
class TestCRUD:
    def test_create_published_now(self, created_ids):
        title = f"TEST_med_pub_{uuid.uuid4().hex[:8]}"
        payload = {
            "title": title, "speaker": "Test Speaker",
            "verse": "Giovanni 3:16", "description": "desc",
            "category": "TEST_Categoria",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "published": True,
        }
        r = requests.post(f"{BASE_URL}/api/admin/meditations",
                          headers=ADMIN, json=payload, timeout=15)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data.get("ok") is True and data.get("id", "").startswith("med_")
        mid = data["id"]
        created_ids.append(mid)

        # GET admin detail
        r2 = requests.get(f"{BASE_URL}/api/admin/meditations/{mid}", headers=ADMIN, timeout=10)
        assert r2.status_code == 200
        doc = r2.json()
        assert doc["title"] == title
        assert doc["published"] is True

        # Appears in public list
        r3 = requests.get(f"{BASE_URL}/api/meditations", timeout=10)
        assert r3.status_code == 200
        assert any(d["id"] == mid for d in r3.json())

    def test_create_draft_not_public(self, created_ids):
        title = f"TEST_med_draft_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/admin/meditations", headers=ADMIN,
                          json={"title": title, "published": False,
                                "video_url": "https://youtu.be/dQw4w9WgXcQ"}, timeout=15)
        assert r.status_code == 201
        mid = r.json()["id"]
        created_ids.append(mid)

        # Draft absent from public
        r2 = requests.get(f"{BASE_URL}/api/meditations", timeout=10)
        assert r2.status_code == 200
        assert all(d["id"] != mid for d in r2.json())

        # Admin filter status=draft returns it
        r3 = requests.get(f"{BASE_URL}/api/admin/meditations?status=draft",
                         headers=ADMIN, timeout=10)
        assert r3.status_code == 200
        assert any(d["id"] == mid for d in r3.json())

    def test_scheduled_future_not_public(self, created_ids):
        title = f"TEST_med_sched_{uuid.uuid4().hex[:8]}"
        future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        r = requests.post(f"{BASE_URL}/api/admin/meditations", headers=ADMIN,
                          json={"title": title, "published": True,
                                "publish_date": future,
                                "video_url": "https://youtu.be/xxx"}, timeout=15)
        assert r.status_code == 201
        mid = r.json()["id"]
        created_ids.append(mid)

        # Not in public list yet
        r2 = requests.get(f"{BASE_URL}/api/meditations", timeout=10)
        assert all(d["id"] != mid for d in r2.json())

        # Admin sees it with status=published
        r3 = requests.get(f"{BASE_URL}/api/admin/meditations?status=published",
                         headers=ADMIN, timeout=10)
        assert any(d["id"] == mid for d in r3.json())

    def test_search_and_category_filter(self, created_ids):
        marker = uuid.uuid4().hex[:8]
        title = f"TEST_UNIQUE_{marker}"
        cat = f"TEST_CAT_{marker}"
        r = requests.post(f"{BASE_URL}/api/admin/meditations", headers=ADMIN,
                          json={"title": title, "category": cat,
                                "published": True,
                                "video_url": "https://youtu.be/aaa"}, timeout=15)
        assert r.status_code == 201
        mid = r.json()["id"]
        created_ids.append(mid)

        # Public search by title
        r2 = requests.get(f"{BASE_URL}/api/meditations?search={marker}", timeout=10)
        assert r2.status_code == 200
        results = r2.json()
        assert len(results) >= 1 and any(d["id"] == mid for d in results)

        # Public filter by category
        r3 = requests.get(f"{BASE_URL}/api/meditations?category={cat}", timeout=10)
        assert r3.status_code == 200
        assert any(d["id"] == mid for d in r3.json())

        # Admin search
        r4 = requests.get(f"{BASE_URL}/api/admin/meditations?search={marker}",
                         headers=ADMIN, timeout=10)
        assert r4.status_code == 200
        assert any(d["id"] == mid for d in r4.json())

        # categories endpoint includes new category
        r5 = requests.get(f"{BASE_URL}/api/meditations/categories", timeout=10)
        assert cat in r5.json()

    def test_patch_and_delete(self, created_ids):
        r = requests.post(f"{BASE_URL}/api/admin/meditations", headers=ADMIN,
                          json={"title": "TEST_med_edit", "published": False}, timeout=15)
        assert r.status_code == 201
        mid = r.json()["id"]

        # PATCH change title + publish
        rp = requests.patch(f"{BASE_URL}/api/admin/meditations/{mid}",
                           headers=ADMIN, json={"title": "TEST_med_edit_v2",
                                                "published": True}, timeout=15)
        assert rp.status_code == 200
        assert rp.json().get("ok") is True

        # GET verifies update
        rg = requests.get(f"{BASE_URL}/api/admin/meditations/{mid}",
                         headers=ADMIN, timeout=10)
        assert rg.status_code == 200
        assert rg.json()["title"] == "TEST_med_edit_v2"
        assert rg.json()["published"] is True

        # DELETE
        rd = requests.delete(f"{BASE_URL}/api/admin/meditations/{mid}",
                            headers=ADMIN, timeout=10)
        assert rd.status_code == 200

        # GET returns 404
        rg2 = requests.get(f"{BASE_URL}/api/admin/meditations/{mid}",
                          headers=ADMIN, timeout=10)
        assert rg2.status_code == 404


# -------- Notification log --------
class TestNotifications:
    def test_publish_creates_notification_log(self, created_ids):
        title = f"TEST_med_notif_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/admin/meditations", headers=ADMIN,
                          json={"title": title, "published": True,
                                "video_url": "https://youtu.be/bbb"}, timeout=15)
        assert r.status_code == 201
        mid = r.json()["id"]
        created_ids.append(mid)

        # small delay
        time.sleep(1)

        rl = requests.get(f"{BASE_URL}/api/admin/notifications",
                         headers=ADMIN, timeout=10)
        assert rl.status_code == 200
        logs = rl.json()
        matching = [e for e in logs
                    if e.get("category") == "meditations"
                    and (e.get("message") == title or title in (e.get("message") or ""))]
        assert len(matching) >= 1, f"No meditations log entry found for {title}"
        entry = matching[0]
        assert entry.get("title") == "Nuova meditazione"
        # push key is placeholder -> status likely 'failed', but endpoint must not crash
        assert "status" in entry

    def test_draft_does_not_create_log(self, created_ids):
        title = f"TEST_med_no_notif_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/admin/meditations", headers=ADMIN,
                          json={"title": title, "published": False}, timeout=15)
        assert r.status_code == 201
        mid = r.json()["id"]
        created_ids.append(mid)

        time.sleep(0.5)
        rl = requests.get(f"{BASE_URL}/api/admin/notifications",
                         headers=ADMIN, timeout=10)
        logs = rl.json()
        matching = [e for e in logs
                    if e.get("category") == "meditations"
                    and title in (e.get("message") or "")]
        assert len(matching) == 0

    def test_admin_stats_includes_meditations(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=ADMIN, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "meditations" in data
        assert isinstance(data["meditations"], int)
        assert data["meditations"] >= 0
