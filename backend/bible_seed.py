"""One-time import of public-domain Italian Bible texts into MongoDB.
Runs at startup; each translation is imported only if its verses are missing.
The schema is multi-translation: every document carries a `translation` code,
so multiple versions coexist in the same collections with no refactor.

Currently bundled (all Public Domain):
  - Riveduta (Luzzi 1927)  -> data/riveduta_1927.json   (default)
  - Giovanni Diodati 1649  -> data/diodati_1649.json
"""
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

TRANSLATIONS = [
    {
        "id": "riveduta_1927", "code": "riveduta_1927", "name": "Riveduta (Luzzi 1927)",
        "short": "Riveduta", "language": "it", "year": 1927, "license": "public-domain",
        "is_default": True, "order": 0, "file": "riveduta_1927.json",
    },
    {
        "id": "diodati_1649", "code": "diodati_1649", "name": "Diodati 1641",
        "short": "Diodati", "language": "it", "year": 1641, "license": "public-domain",
        "is_default": False, "order": 1, "file": "diodati_1649.json",
    },
]


async def _ensure_indices(db, logger):
    await db.bible_verses.create_index([("translation", 1), ("book_nr", 1), ("chapter", 1), ("verse", 1)])
    try:
        await db.bible_verses.create_index([("text", "text")], default_language="italian", name="verse_text")
    except Exception as e:
        logger.warning("bible text index: %s", e)
    await db.bible_books.create_index([("translation", 1), ("book_nr", 1)])
    await db.bible_books.create_index([("translation", 1), ("name", 1)])
    await db.user_bible_state.create_index("user_id", unique=True)
    await db.bible_bookmarks.create_index([("user_id", 1), ("book_nr", 1), ("chapter", 1)])
    await db.bible_notes.create_index([("user_id", 1), ("book_nr", 1), ("chapter", 1)])


async def _seed_one(db, logger, tr):
    code = tr["code"]
    # Always keep the translation catalog entry up to date (name/order/default).
    meta = {k: tr[k] for k in ("id", "code", "name", "short", "language", "year", "license", "is_default", "order")}
    await db.bible_translations.update_one({"id": tr["id"]}, {"$set": meta}, upsert=True)

    if await db.bible_verses.count_documents({"translation": code}) > 0:
        return  # already imported

    path = os.path.join(DATA_DIR, tr["file"])
    if not os.path.exists(path):
        logger.warning("bible seed: data file missing (%s)", path)
        return

    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    books_docs, verse_docs = [], []
    for book in data.get("books", []):
        nr = book["nr"]
        name = book["name"]
        chapters = book.get("chapters", [])
        testament = "AT" if nr <= 39 else "NT"
        books_docs.append({
            "id": f"{code}-{nr}", "translation": code, "book_nr": nr, "name": name,
            "testament": testament, "order": nr, "chapters_count": len(chapters),
        })
        for ch in chapters:
            cnum = ch["chapter"]
            for v in ch.get("verses", []):
                verse_docs.append({
                    "translation": code, "book_nr": nr, "book_name": name,
                    "chapter": cnum, "verse": v["verse"], "text": (v.get("text") or "").strip(),
                })

    if books_docs:
        await db.bible_books.delete_many({"translation": code})
        await db.bible_books.insert_many(books_docs)
    B = 4000
    for i in range(0, len(verse_docs), B):
        await db.bible_verses.insert_many(verse_docs[i:i + B])
    logger.info("bible seed: imported %d books, %d verses (%s)", len(books_docs), len(verse_docs), code)


async def seed_bible(db, logger):
    for tr in TRANSLATIONS:
        try:
            await _seed_one(db, logger, tr)
        except Exception as e:
            logger.warning("bible seed failed for %s: %s", tr.get("code"), e)
    await _ensure_indices(db, logger)
