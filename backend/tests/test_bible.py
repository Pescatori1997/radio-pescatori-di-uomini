"""Tests for the Bible (Riveduta 1927) endpoints — Phase 1."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://evangelic-stream.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
ADMIN_PASSWORD = "AdminTestPwd1!"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    """Login once to get a Bearer token (auth is rate-limited 10/60s)."""
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code == 429:
        time.sleep(30)
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("session_token") or data.get("token") or data.get("access_token")
    assert tok, f"no token in login response: {data}"
    return tok


# ---------------- translations ----------------
class TestTranslations:
    def test_translations_lists_riveduta_default(self, session):
        r = session.get(f"{API}/bible/translations")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        codes = {t.get("code") for t in items}
        assert "riveduta_1927" in codes, f"missing riveduta_1927: {codes}"
        riv = next(t for t in items if t.get("code") == "riveduta_1927")
        assert riv.get("is_default") is True


# ---------------- books ----------------
class TestBooks:
    def test_books_counts_and_shape(self, session):
        r = session.get(f"{API}/bible/books")
        assert r.status_code == 200
        data = r.json()
        assert "at" in data and "nt" in data
        assert len(data["at"]) == 39, f"AT count = {len(data['at'])}"
        assert len(data["nt"]) == 27, f"NT count = {len(data['nt'])}"
        # shape check
        for b in data["at"][:3] + data["nt"][:3]:
            assert "book_nr" in b
            assert "name" in b
            assert "chapters_count" in b
            assert isinstance(b["book_nr"], int)
            assert isinstance(b["chapters_count"], int)


# ---------------- chapter ----------------
class TestChapter:
    def test_giovanni_chapter_3(self, session):
        r = session.get(f"{API}/bible/chapter", params={"book": 43, "chapter": 3})
        assert r.status_code == 200
        d = r.json()
        assert d["book_name"] == "Giovanni", f"unexpected book_name: {d.get('book_name')}"
        assert d["chapters_count"] == 21
        verses = d["verses"]
        assert isinstance(verses, list) and len(verses) > 0
        v16 = next((v for v in verses if v.get("verse") == 16), None)
        assert v16 is not None, "verse 16 not present"
        assert "Iddio ha tanto amato il mondo" in v16["text"], f"unexpected v16 text: {v16['text']!r}"

    def test_unknown_book_returns_404(self, session):
        r = session.get(f"{API}/bible/chapter", params={"book": 999, "chapter": 1})
        assert r.status_code == 404

    def test_unknown_chapter_returns_404(self, session):
        r = session.get(f"{API}/bible/chapter", params={"book": 43, "chapter": 999})
        assert r.status_code == 404


# ---------------- resolve ----------------
class TestResolve:
    def test_resolve_reference_string(self, session):
        r = session.get(f"{API}/bible/resolve", params={"reference": "Giovanni 3:16"})
        assert r.status_code == 200
        d = r.json()
        assert d["book_nr"] == 43
        assert d["chapter"] == 3
        assert d["verse"] == 16
        assert d["book_name"] == "Giovanni"

    def test_resolve_book_chapter_verse(self, session):
        r = session.get(f"{API}/bible/resolve", params={"book": "Salmi", "chapter": 23, "verse": 1})
        assert r.status_code == 200
        d = r.json()
        assert d["book_nr"] == 19, f"expected 19 got {d.get('book_nr')}"

    def test_resolve_unknown_book_404(self, session):
        r = session.get(f"{API}/bible/resolve", params={"book": "NonEsiste", "chapter": 1, "verse": 1})
        assert r.status_code == 404


# ---------------- search ----------------
class TestSearch:
    def test_search_pescatori_returns_results(self, session):
        r = session.get(f"{API}/bible/search", params={"q": "pescatori"})
        assert r.status_code == 200
        d = r.json()
        results = d["results"]
        assert isinstance(results, list)
        assert len(results) >= 5, f"expected >=5 results, got {len(results)}"
        # shape
        for row in results[:3]:
            for k in ("book_name", "chapter", "verse", "text"):
                assert k in row, f"missing key {k} in row {row}"
        books_hit = {row["book_name"] for row in results}
        assert ("Marco" in books_hit) or ("Matteo" in books_hit), f"no Marco/Matteo hits: {books_hit}"

    def test_search_regex_special_no_500(self, session):
        r = session.get(f"{API}/bible/search", params={"q": "(a+)+"})
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"


# ---------------- me/bible/state ----------------
class TestBibleState:
    def test_state_requires_auth(self, session):
        r = session.get(f"{API}/me/bible/state")
        assert r.status_code == 401
        r2 = session.put(f"{API}/me/bible/state", json={"book_nr": 43, "chapter": 3})
        assert r2.status_code == 401

    def test_state_put_and_get(self, session, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        r = requests.put(f"{API}/me/bible/state", json={"book_nr": 43, "chapter": 3}, headers=headers)
        assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
        assert r.json().get("ok") is True

        r2 = requests.get(f"{API}/me/bible/state", headers=headers)
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("book_nr") == 43, f"expected book_nr=43 got {d}"
        assert d.get("chapter") == 3, f"expected chapter=3 got {d}"
