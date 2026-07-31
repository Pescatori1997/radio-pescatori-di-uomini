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


# Common Italian singular/colloquial book names -> canonical name.
BOOK_SYNONYMS = {
    "salmo": "Salmi",
    "proverbio": "Proverbi",
    "cantico": "Cantico dei Cantici",
}

# Cache of {translation: {"rx": compiled, "map": {lower_name: doc}}} so we match
# references against the REAL book names (never swallow the verb before them).
_BOOK_CACHE: dict = {}


async def _get_book_index(db) -> dict:
    cache = _BOOK_CACHE.get(DEFAULT_BIBLE)
    if cache:
        return cache
    docs = await db.bible_books.find({"translation": DEFAULT_BIBLE}, {"_id": 0}).to_list(100)
    name_map: dict = {}
    names: list[str] = []
    for d in docs:
        name_map[d["name"].lower()] = d
        names.append(d["name"])
    for syn, canon in BOOK_SYNONYMS.items():
        cd = next((d for d in docs if d["name"].lower() == canon.lower()), None)
        if cd:
            name_map[syn] = cd
            names.append(syn)
    # longest first so "1 Giovanni" / "Cantico dei Cantici" win over prefixes.
    names_sorted = sorted(set(names), key=len, reverse=True)
    pattern = r"\b(" + "|".join(re.escape(n) for n in names_sorted) + r")\s+(\d+)(?::(\d+))?"
    cache = {"rx": re.compile(pattern, re.IGNORECASE), "map": name_map}
    _BOOK_CACHE[DEFAULT_BIBLE] = cache
    return cache


async def resolve_reference(db, reference: str) -> Optional[dict]:
    """Resolve 'Giovanni 3:16' / 'Salmo 23' to a reader path against the real book
    names. Returns None if no known book reference is present."""
    if not reference:
        return None
    idx = await _get_book_index(db)
    m = idx["rx"].search(reference)
    if not m:
        return None
    doc = idx["map"].get(m.group(1).lower())
    if not doc:
        return None
    chapter = int(m.group(2))
    verse = int(m.group(3)) if m.group(3) else None
    path = f"/lettore/read?book={doc['book_nr']}&chapter={chapter}"
    if verse:
        path += f"&highlight={verse}"
    label = f"📖 Apri {doc['name']} {chapter}" + (f":{verse}" if verse else "")
    return {"path": path, "label": label, "reference": f"{doc['name']} {chapter}" + (f":{verse}" if verse else "")}


async def find_last_reference(db, messages: list[dict]) -> Optional[dict]:
    """Scan the conversation (newest first) for the most recent Bible passage the
    user/Timoteo referred to, so follow-ups like 'qual è il contesto?' still know
    which passage we are studying. Matches only REAL book names."""
    idx = await _get_book_index(db)
    for m in reversed(messages[-8:]):
        content = m.get("content") or ""
        matches = list(idx["rx"].finditer(content))
        if not matches:
            continue
        mt = matches[-1]  # last reference in the most recent message wins
        doc = idx["map"].get(mt.group(1).lower())
        if doc:
            return {
                "book_nr": doc["book_nr"],
                "book_name": doc["name"],
                "chapter": int(mt.group(2)),
                "verse": int(mt.group(3)) if mt.group(3) else None,
            }
    return None


async def fetch_passage(db, book_nr: int, chapter: int, verse: Optional[int] = None,
                        limit: int = 45) -> tuple[Optional[str], list[dict]]:
    """Return the actual verses of a chapter (or a window around `verse`) from the
    self-hosted Bible, so Timoteo can teach on the real text."""
    rows = await db.bible_verses.find(
        {"translation": DEFAULT_BIBLE, "book_nr": book_nr, "chapter": chapter},
        {"_id": 0, "verse": 1, "text": 1, "book_name": 1},
    ).sort("verse", 1).to_list(400)
    if not rows:
        return None, []
    book_name = rows[0].get("book_name")
    if verse and len(rows) > limit:
        lo, hi = max(1, verse - 8), verse + 8
        rows = [r for r in rows if lo <= r["verse"] <= hi]
    else:
        rows = rows[:limit]
    return book_name, rows




SYSTEM_PROMPT = """Sei "Timoteo", la guida spirituale dell'app cristiana evangelica "Pescatori di Uomini" (una radio evangelica). Il tuo nome richiama Timoteo, collaboratore fedele dell'apostolo Paolo. Ti comporti come un ANZIANO MATURO e premuroso che accompagna un credente nello studio della Parola: non ti limiti a dare informazioni, ma spieghi, incoraggi, fai collegamenti con altri passi e aiuti a comprendere il messaggio biblico con equilibrio, umiltà e fedeltà al testo. Non definirti mai "bot", "AI", "chatbot" o "assistente virtuale".

RUOLO: il tuo scopo principale è INSEGNARE la Parola, non solo aprire schermate dell'app. Aiuti anche a trovare contenuti e usare le funzioni. Rispondi SEMPRE in italiano, con tono gentile, calmo, rispettoso e accogliente. Mai sarcastico, mai invadente.

SPIEGAZIONI BIBLICHE — devi rispondere DIRETTAMENTE quando l'utente chiede di spiegare, commentare o capire un passo (es. "Spiegami Matteo 4:19", "Cosa significa questo versetto?", "Commentami Romani 8", "Cosa ne pensi di questo passo?", "Cosa ne pensi del contesto?"). Struttura la spiegazione così:
1. Riporta il versetto/passo (quando disponibile), come citazione tra «virgolette».
2. Spiega il contesto storico e letterario.
3. Spiega il significato del passo.
4. Collega altri versetti pertinenti, citandone i riferimenti.
5. Distingui SEMPRE con chiarezza il testo biblico (citazione) dal tuo commento.
6. Se esistono interpretazioni diverse, presentale con umiltà, senza spacciarle per verità assolute.

FONTI: usa come fonte primaria il "TESTO DEL PASSO" e i "VERSETTI DISPONIBILI" forniti nel contesto (provengono dalla Bibbia dell'app). Sei però AUTORIZZATO a usare anche la tua solida conoscenza biblica per spiegare il significato dei passi, citando SEMPRE i riferimenti. 

NON RIFIUTARE: NON usare come comportamento predefinito frasi come "non ho il testo", "non posso commentare", "leggilo nella Bibbia". Queste sono ammesse SOLO come ultima risorsa, se il riferimento è davvero ambiguo o inesistente: in quel caso chiedi gentilmente un chiarimento. Se conosci il passo, spiegalo comunque, con equilibrio.

Ricorda con delicatezza (non ad ogni messaggio) che lo studio con Timoteo non sostituisce la lettura personale della Bibbia né il confronto con gli anziani della chiesa locale.

AGISCI: quando l'utente vuole aprire/raggiungere una funzione, proponi anche un'azione che la apre direttamente.

LUNGHEZZA: sii conciso nelle richieste pratiche (navigazione, ricerca). Quando spieghi la Parola, sii chiaro, ordinato e ricco quanto serve, senza dilungarti in modo eccessivo.

INVITO A PROSEGUIRE: quando spieghi un passo o rispondi a una domanda biblica, concludi SEMPRE con UNA breve domanda calorosa che invita a continuare lo studio insieme (varia ogni volta, senza ripeterti), ad esempio: "Vuoi che analizziamo anche il contesto dei versetti precedenti?", "Desideri vedere altri passi che parlano dello stesso argomento?", "Vuoi approfondire il significato pratico di questo passo per la vita del credente?". Così sarai un vero compagno di studio, non un semplice assistente.

FORMATO DELLA RISPOSTA: restituisci SOLO un oggetto JSON valido, senza testo prima o dopo, con questa forma:
{
  "reply": "la tua risposta all'utente (può contenere a capo)",
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

    # Grounding. Two paths:
    #  (a) an explicit/remembered passage -> load its real text so Timoteo can teach.
    #  (b) otherwise a thematic verse search for topical questions.
    content_hits = await global_search(db, last_user)
    candidates = {f"C{i+1}": c for i, c in enumerate(content_hits)}

    passage_ref = await find_last_reference(db, messages)
    passage_text: list[dict] = []
    passage_name = None
    if passage_ref:
        passage_name, passage_text = await fetch_passage(
            db, passage_ref["book_nr"], passage_ref["chapter"], passage_ref.get("verse"))
    verses = [] if passage_ref else await bible_verse_search(db, last_user)

    ctx_lines = []
    ctx_lines.append("SCHERMATE (chiavi per azioni 'screen'):")
    ctx_lines.append(", ".join(f"{k} = {v}" for k, v in SCREENS.items()))
    if candidates:
        ctx_lines.append("\nRISULTATI (usa questi id per azioni 'content'):")
        for cid, c in candidates.items():
            ctx_lines.append(f"[{cid}] ({c['kind']}) {c['title']}")
    else:
        ctx_lines.append("\nRISULTATI: nessun contenuto trovato per questa richiesta.")
    if passage_text:
        loc = f"{passage_name} {passage_ref['chapter']}"
        ctx_lines.append(f"\nTESTO DEL PASSO ({loc}, dalla Bibbia dell'app — usalo per spiegare):")
        for v in passage_text:
            ctx_lines.append(f"{v['verse']} {v['text']}")
        if passage_ref.get("verse"):
            ctx_lines.append(f"(L'utente sta studiando in particolare {loc}:{passage_ref['verse']}.)")
    elif verses:
        ctx_lines.append("\nVERSETTI DISPONIBILI (dalla Bibbia dell'app):")
        for v in verses:
            ctx_lines.append(f"- {v['reference']}: {v['text']}")
    else:
        ctx_lines.append("\nNessun passo specifico rilevato: se l'utente cita un riferimento che conosci, spiegalo con la tua conoscenza biblica citando i versetti.")

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
    # The chat bubble renders plain text — strip any markdown the model may add.
    reply = re.sub(r"\*\*(.*?)\*\*", r"\1", reply)
    reply = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", reply)
    reply = reply.replace("__", "")
    return (reply, data.get("actions") or [])
