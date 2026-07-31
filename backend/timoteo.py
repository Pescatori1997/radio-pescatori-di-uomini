"""Timoteo — the intelligent guide of the Pescatori di Uomini platform.

Design goals:
- The AI *engine* (LLM provider/model) is decoupled from platform logic. Swap it
  via env `TIMOTEO_PROVIDER` / `TIMOTEO_MODEL` without touching business code.
- Navigation is expressed through a small, extensible ACTION registry. Adding a
  new platform feature = add one entry to SCREEN_MAP (frontend has the twin map).
- Bible Q&A is grounded ONLY on the self-hosted Bible: candidate verses are
  fetched from Mongo and passed to the model as the sole allowed source.

The endpoint layer (server.py) only calls `answer(db, messages, ctx)`.
"""
from __future__ import annotations

import os
import re
import json
import logging
from typing import Any, Optional

logger = logging.getLogger("timoteo")

# ---- Swappable AI engine (config-driven) ----
TIMOTEO_PROVIDER = os.environ.get("TIMOTEO_PROVIDER", "openai")
TIMOTEO_MODEL = os.environ.get("TIMOTEO_MODEL", "gpt-5.5")

DEFAULT_BIBLE = os.environ.get("DEFAULT_BIBLE", "riveduta_1927")

# ---- Navigation registry (logical key -> what it opens). The frontend holds
# the matching path map. Keep both in sync when adding features. ----
SCREENS: dict[str, str] = {
    "home": "La schermata principale",
    "radio": "La radio in diretta (usa però l'azione radio_live per aprire e avviare la radio)",
    "podcast": "L'elenco dei podcast",
    "meditazioni": "L'elenco delle meditazioni",
    "news": "Le ultime notizie",
    "palinsesto": "Il palinsesto / programmazione radio",
    "profilo": "Il profilo dell'utente",
    "prayer": "Crea una nuova richiesta di preghiera",
    "prayer_board": "La bacheca pubblica delle richieste di preghiera",
    "bibbia": "La Bibbia (home con i libri)",
    "bible_search": "La ricerca nella Bibbia",
    "reading_plans": "I piani di lettura della Bibbia",
    "saved_bible": "Versetti e note salvate",
    "studi_biblici": "Gli studi biblici",
    "predicazioni": "Le predicazioni",
    "video": "I video",
    "eventi": "Gli eventi",
    "galleria": "La galleria fotografica",
    "download": "I documenti PDF da scaricare",
    "settings": "Le impostazioni dell'app",
    "donate": "La pagina delle donazioni",
    "weather": "Il meteo",
    "about": "Chi siamo",
    "contact": "Contatti",
}


def _pub(extra: dict | None = None) -> dict:
    q: dict = {"published": {"$ne": False}}
    if extra:
        q.update(extra)
    return q


async def _search_collection(db, collection: str, q: str, path_fn, kind: str,
                             query: dict, limit: int = 4) -> list[dict]:
    try:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query = {**query, "$or": [{"title": rx}, {"description": rx}, {"subtitle": rx}]}
        docs = await db[collection].find(query, {"_id": 0}).limit(limit).to_list(limit)
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("search %s failed: %s", collection, e)
        return []
    out = []
    for d in docs:
        title = d.get("title") or d.get("name") or ""
        if not title:
            continue
        out.append({"kind": kind, "title": title, "path": path_fn(d)})
    return out


async def global_search(db, q: str, limit: int = 12) -> list[dict]:
    """Search across the whole platform (podcasts, meditations, news, generic
    content sections). Returns lightweight candidates with a ready-to-open path."""
    q = (q or "").strip()
    if len(q) < 2:
        return []
    now_iso = __import__("datetime").datetime.utcnow().isoformat()
    results: list[dict] = []
    results += await _search_collection(
        db, "podcasts", q, lambda d: f"/podcast/{d.get('id')}", "Podcast", _pub())
    results += await _search_collection(
        db, "meditations", q, lambda d: f"/meditazioni/{d.get('id')}", "Meditazione",
        {"published": True})
    results += await _search_collection(
        db, "news", q, lambda d: f"/news/{d.get('id')}", "Notizia", _pub())
    results += await _search_collection(
        db, "contents", q, lambda d: f"/c/{d.get('section')}/{d.get('id')}",
        "Contenuto", {"status": "published", "visibility": {"$ne": "private"}})
    return results[:limit]


async def bible_verse_search(db, q: str, limit: int = 8) -> list[dict]:
    """Return grounding verses from the self-hosted Bible for thematic questions."""
    q = (q or "").strip()
    if len(q) < 2:
        return []
    try:
        cur = db.bible_verses.find(
            {"translation": DEFAULT_BIBLE, "$text": {"$search": q}},
            {"_id": 0, "book_name": 1, "chapter": 1, "verse": 1, "text": 1,
             "score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(limit)
        rows = await cur.to_list(limit)
    except Exception:
        rq = {"translation": DEFAULT_BIBLE, "text": {"$regex": re.escape(q), "$options": "i"}}
        rows = await db.bible_verses.find(
            rq, {"_id": 0, "book_name": 1, "chapter": 1, "verse": 1, "text": 1}
        ).limit(limit).to_list(limit)
    return [{"reference": f"{r.get('book_name')} {r.get('chapter')}:{r.get('verse')}",
             "text": r.get("text", "")} for r in rows]


REF_RE = re.compile(r"([1-3]?\s?[A-Za-zÀ-ÿ.]+(?:\s[A-Za-zÀ-ÿ.]+)?)\s+(\d+)(?::(\d+))?")

# Common Italian singular/colloquial book names -> canonical name.
BOOK_SYNONYMS = {
    "salmo": "Salmi",
    "proverbio": "Proverbi",
    "cantico": "Cantico dei Cantici",
    "cantico dei cantici": "Cantico dei Cantici",
}


async def resolve_reference(db, reference: str) -> Optional[dict]:
    """Resolve 'Giovanni 3:16' / 'Salmo 23' to a reader path. Returns None if the
    book is unknown in the self-hosted Bible."""
    if not reference:
        return None
    m = REF_RE.search(reference.strip())
    if not m:
        return None
    name, chapter, verse = m.group(1).strip(), int(m.group(2)), (int(m.group(3)) if m.group(3) else None)
    name = BOOK_SYNONYMS.get(name.lower(), name)
    doc = await db.bible_books.find_one(
        {"translation": DEFAULT_BIBLE, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}},
        {"_id": 0},
    )
    if not doc:
        # try a prefix match (e.g. "Salm" -> "Salmi", "Genes" -> "Genesi")
        stem = name[:-1] if len(name) > 4 else name
        doc = await db.bible_books.find_one(
            {"translation": DEFAULT_BIBLE, "name": {"$regex": f"^{re.escape(stem)}", "$options": "i"}},
            {"_id": 0},
        )
    if not doc:
        return None
    path = f"/lettore/read?book={doc['book_nr']}&chapter={chapter}"
    if verse:
        path += f"&highlight={verse}"
    label = f"📖 Apri {doc['name']} {chapter}" + (f":{verse}" if verse else "")
    return {"path": path, "label": label, "reference": f"{doc['name']} {chapter}" + (f":{verse}" if verse else "")}


SYSTEM_PROMPT = """Sei "Timoteo", la guida intelligente dell'app cristiana evangelica "Pescatori di Uomini" (una radio evangelica). Il tuo nome richiama Timoteo, collaboratore fedele dell'apostolo Paolo: sei un servo premuroso, non un robot. Non definirti mai "bot", "AI", "chatbot" o "assistente virtuale".

RUOLO: aiuti l'utente a trovare contenuti, usare le funzioni dell'app e studiare la Bibbia. Rispondi SEMPRE in italiano, con tono gentile, calmo, rispettoso e accogliente. Risposte BREVI e semplici (max 2-3 frasi). Mai sarcastico, mai invadente.

AGISCI, NON SPIEGARE SOLO: quando una funzione esiste, proponi un'azione che la apre direttamente invece di descrivere il percorso.

BIBBIA (regola ferrea): per domande bibliche usa ESCLUSIVAMENTE i "VERSETTI DISPONIBILI" forniti nel contesto (provengono dalla Bibbia dell'app). Cita sempre i riferimenti dei versetti che usi. Distingui chiaramente il testo biblico (citazione) dalla tua spiegazione. Non inventare dottrine o interpretazioni non sostenute dal testo. Se esistono più interpretazioni, dillo con rispetto. Se i versetti forniti non rispondono chiaramente, dichiaralo apertamente e invita a leggere la Parola e a confrontarsi con la chiesa locale. Non sostituire mai la lettura personale della Bibbia.

FORMATO DELLA RISPOSTA: restituisci SOLO un oggetto JSON valido, senza testo prima o dopo, con questa forma:
{
  "reply": "testo breve per l'utente",
  "actions": [ ...massimo 4 azioni... ]
}
Ogni azione è uno di questi oggetti ESATTI:
- {"type":"radio_live","label":"📻 Ascolta la radio"}
- {"type":"screen","screen":"<CHIAVE>","label":"..."}  (CHIAVE tra quelle elencate in SCHERMATE)
- {"type":"bible","reference":"Giovanni 3:16","label":"📖 Apri Giovanni 3:16"}  (per aprire un capitolo/versetto)
- {"type":"content","id":"<ID>","label":"..."}  (SOLO usando un id dai RISULTATI forniti)

Regole azioni: usa "content" solo con id presenti nei RISULTATI. Usa "bible" con riferimenti reali (dai VERSETTI DISPONIBILI o citati dall'utente). Se non serve nessuna azione, usa "actions": []. Non inventare id o percorsi."""


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {"reply": text or "Sono qui per aiutarti. Come posso guidarti?", "actions": []}


async def _validate_actions(db, raw_actions: list, candidates: dict) -> list[dict]:
    """Turn model-proposed actions into safe, concrete buttons. Drops anything
    that can't be verified (hallucinated ids / unknown screens / unknown books)."""
    out: list[dict] = []
    for a in (raw_actions or [])[:6]:
        if not isinstance(a, dict):
            continue
        t = a.get("type")
        label = (a.get("label") or "").strip()
        if t == "radio_live":
            out.append({"type": "radio_live", "label": label or "📻 Ascolta la radio"})
        elif t == "screen":
            key = a.get("screen")
            if key in SCREENS:
                out.append({"type": "screen", "screen": key, "label": label or key})
        elif t == "bible":
            resolved = await resolve_reference(db, a.get("reference") or "")
            if resolved:
                out.append({"type": "open", "path": resolved["path"], "label": label or resolved["label"]})
        elif t == "content":
            cand = candidates.get(a.get("id"))
            if cand:
                out.append({"type": "open", "path": cand["path"], "label": label or f"{cand['kind']}: {cand['title']}"})
        if len(out) >= 4:
            break
    return out


async def answer(db, messages: list[dict], ctx: dict) -> dict:
    """Main entry: orchestrate grounding search + LLM + safe action resolution."""
    messages = messages or []
    last_user = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user = (m.get("content") or "").strip()
            break

    # Grounding: real content + real verses for the current message.
    content_hits = await global_search(db, last_user)
    verses = await bible_verse_search(db, last_user)
    candidates = {f"C{i+1}": c for i, c in enumerate(content_hits)}

    ctx_lines = []
    ctx_lines.append("SCHERMATE (chiavi per azioni 'screen'):")
    ctx_lines.append(", ".join(f"{k} = {v}" for k, v in SCREENS.items()))
    if candidates:
        ctx_lines.append("\nRISULTATI (usa questi id per azioni 'content'):")
        for cid, c in candidates.items():
            ctx_lines.append(f"[{cid}] ({c['kind']}) {c['title']}")
    else:
        ctx_lines.append("\nRISULTATI: nessun contenuto trovato per questa richiesta.")
    if verses:
        ctx_lines.append("\nVERSETTI DISPONIBILI (unica fonte per risposte bibliche):")
        for v in verses:
            ctx_lines.append(f"- {v['reference']}: {v['text']}")
    else:
        ctx_lines.append("\nVERSETTI DISPONIBILI: nessuno per questa richiesta.")

    # Recent conversation memory (kept compact).
    history = messages[-8:]
    convo = "\n".join(
        f"{'Utente' if m.get('role') == 'user' else 'Timoteo'}: {(m.get('content') or '').strip()}"
        for m in history if (m.get("content") or "").strip()
    )
    name = (ctx or {}).get("name")
    who = f"L'utente si chiama {name}." if name else "L'utente non è autenticato (ospite)."

    user_payload = (
        f"{who}\n\nCONTESTO PIATTAFORMA:\n" + "\n".join(ctx_lines) +
        f"\n\nCONVERSAZIONE FINORA:\n{convo}\n\n"
        "Rispondi all'ultimo messaggio dell'utente rispettando TUTTE le regole e restituendo solo il JSON."
    )

    reply_text, raw_actions = await _run_llm(user_payload)
    actions = await _validate_actions(db, raw_actions, candidates)
    return {"reply": reply_text, "actions": actions}


async def _run_llm(user_payload: str) -> tuple[str, list]:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return ("Al momento non riesco a rispondere. Riprova più tardi.", [])
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import uuid
        chat = LlmChat(
            api_key=key,
            session_id=f"timoteo-{uuid.uuid4().hex[:8]}",
            system_message=SYSTEM_PROMPT,
        ).with_model(TIMOTEO_PROVIDER, TIMOTEO_MODEL)
        raw = await chat.send_message(UserMessage(text=user_payload))
    except Exception as e:
        logger.warning("timoteo llm failed: %s", e)
        return ("Mi dispiace, in questo momento ho difficoltà a rispondere. Riprova tra poco.", [])
    data = _extract_json(raw if isinstance(raw, str) else str(raw))
    reply = (data.get("reply") or "").strip() or "Sono qui per aiutarti. Cosa cerchi?"
    return (reply, data.get("actions") or [])
