"""Backend tests for Timoteo /api/timoteo/chat endpoint.

The LLM is real (GPT-5.5 via Emergent). Tests assert STRUCTURE + safe-action
resolution, not exact copy. Auth is optional; endpoint MUST never 401/500.
"""
import os
import re
import pytest
import requests

def _load_public_url():
    for k in ("EXPO_PUBLIC_BACKEND_URL", "EXPO_BACKEND_URL"):
        v = os.environ.get(k)
        if v:
            return v.rstrip("/")
    # fallback: read frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                line = line.strip()
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    except Exception:
        pass
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL/EXPO_BACKEND_URL must be set")


BASE_URL = _load_public_url()

CHAT_URL = f"{BASE_URL}/api/timoteo/chat"
TIMEOUT = 60  # LLM can be slow


def _post(messages, headers=None):
    return requests.post(CHAT_URL, json={"messages": messages}, headers=headers or {}, timeout=TIMEOUT)


def _valid_shape(data):
    assert isinstance(data, dict), f"resp not dict: {data!r}"
    assert "reply" in data and isinstance(data["reply"], str) and data["reply"].strip(), f"empty reply: {data}"
    assert "actions" in data and isinstance(data["actions"], list), f"missing actions: {data}"
    for a in data["actions"]:
        assert a.get("type") in {"open", "radio_live", "screen"}, f"bad action type: {a}"
        assert "label" in a and isinstance(a["label"], str) and a["label"], f"missing label: {a}"
        if a["type"] == "open":
            assert isinstance(a.get("path"), str) and a["path"].startswith("/"), f"bad path: {a}"
        if a["type"] == "screen":
            assert isinstance(a.get("screen"), str) and a["screen"], f"bad screen: {a}"


# --- Basic guarantees ---
class TestTimoteoBasics:
    def test_no_auth_never_401(self):
        r = _post([{"role": "user", "content": "Ciao"}])
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:400]}"
        _valid_shape(r.json())

    def test_never_500_even_on_empty(self):
        r = _post([])
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:400]}"


# --- Feature specific scenarios ---
class TestTimoteoScenarios:
    def test_open_giovanni_3_16(self):
        r = _post([{"role": "user", "content": "Apri Giovanni 3:16"}])
        assert r.status_code == 200
        data = r.json()
        _valid_shape(data)
        opens = [a for a in data["actions"] if a["type"] == "open"]
        assert opens, f"no 'open' action returned: {data}"
        # At least one action must point to reader with book=43 chapter=3 highlight=16
        good = [a for a in opens if "book=43" in a["path"] and "chapter=3" in a["path"] and "highlight=16" in a["path"]]
        assert good, f"expected book=43 chapter=3 highlight=16 in path, got: {[a['path'] for a in opens]}"

    def test_open_radio(self):
        r = _post([{"role": "user", "content": "Apri la radio"}])
        assert r.status_code == 200
        data = r.json()
        _valid_shape(data)
        assert any(a["type"] == "radio_live" for a in data["actions"]), f"no radio_live: {data}"

    def test_prayer_board_navigation(self):
        r = _post([{"role": "user", "content": "Vai alle richieste di preghiera"}])
        assert r.status_code == 200
        data = r.json()
        _valid_shape(data)
        assert any(a["type"] == "screen" and a.get("screen") in {"prayer", "prayer_board"} for a in data["actions"]), \
            f"no prayer(_board) screen action: {data}"

    def test_hope_verses_grounding(self):
        r = _post([{"role": "user", "content": "Versetti sulla speranza"}])
        assert r.status_code == 200
        data = r.json()
        _valid_shape(data)
        # Reply must reference some Bible book:chapter:verse citation
        assert re.search(r"[A-Za-zÀ-ÿ]+\s+\d+:\d+", data["reply"]), f"no biblical reference in reply: {data['reply']}"
        # Should include at least one open action pointing to lettore/read
        assert any(a["type"] == "open" and "/lettore/read" in a.get("path", "") for a in data["actions"]), \
            f"no bible open action: {data}"

    def test_podcast_search_real_ids_or_none(self):
        r = _post([{"role": "user", "content": "Cerca un podcast sulla fede"}])
        assert r.status_code == 200
        data = r.json()
        _valid_shape(data)
        # Fetch real podcast list to know allowed ids
        pods = requests.get(f"{BASE_URL}/api/podcasts", timeout=15)
        allowed_paths = set()
        if pods.status_code == 200:
            for p in pods.json() if isinstance(pods.json(), list) else pods.json().get("items", []):
                pid = p.get("id")
                if pid:
                    allowed_paths.add(f"/podcast/{pid}")
        # Any content action MUST reference a real podcast id
        for a in data["actions"]:
            if a["type"] == "open" and a.get("path", "").startswith("/podcast/"):
                assert a["path"] in allowed_paths, f"hallucinated podcast path: {a['path']}"

    def test_support_password(self):
        r = _post([{"role": "user", "content": "Come cambio la password?"}])
        assert r.status_code == 200
        _valid_shape(r.json())

    def test_session_memory_chapter_5(self):
        msgs = [
            {"role": "user", "content": "Aprimi Giovanni"},
            {"role": "assistant", "content": "Va bene, quale capitolo di Giovanni vuoi aprire?"},
            {"role": "user", "content": "vai al capitolo 5"},
        ]
        r = _post(msgs)
        assert r.status_code == 200
        data = r.json()
        _valid_shape(data)
        opens = [a for a in data["actions"] if a["type"] == "open" and "/lettore/read" in a.get("path", "")]
        good = [a for a in opens if "book=43" in a["path"] and "chapter=5" in a["path"]]
        assert good, f"expected Giovanni ch.5 (book=43 chapter=5): {[a.get('path') for a in data['actions']]}"
