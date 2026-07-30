"""One-time import of the Riveduta 1927 (public domain) Bible text into MongoDB.
Runs at startup only if the collection is empty. The schema is multi-translation
ready: every document carries a `translation` code so more versions (e.g. Diodati)
can be added later with a new import and no refactor."""
import json
import os

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "riveduta_1927.json")
TRANSLATION = {
    "id": "riveduta_1927",
    "code": "riveduta_1927",
    "name": "Riveduta (Luzzi 1927)",
    "short": "Riveduta",
    "language": "it",
    "year": 1927,
    "license": "public-domain",
    "is_default": True,
    "order": 0,
}


async def seed_bible(db, logger):
    # Always ensure indices (idempotent).
    async def _indices():
        await db.bible_verses.create_index([("translation", 1), ("book_nr", 1), ("chapter", 1), ("verse", 1)])
        try:
            await db.bible_verses.create_index([("text", "text")], default_language="italian", name="verse_text")
        except Exception as e:
            logger.warning("bible text index: %s", e)
        await db.bible_books.create_index([("translation", 1), ("book_nr", 1)])
        await db.bible_books.create_index([("translation", 1), ("name", 1)])
        await db.user_bible_state.create_index("user_id", unique=True)

    if await db.bible_verses.count_documents({"translation": TRANSLATION["code"]}) > 0:
        await _indices()
        return

    if not os.path.exists(DATA_FILE):
        logger.warning("bible seed: data file missing (%s)", DATA_FILE)
        return

    with open(DATA_FILE, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    await db.bible_translations.update_one({"id": TRANSLATION["id"]}, {"$set": TRANSLATION}, upsert=True)

    books_docs = []
    verse_docs = []
    for book in data.get("books", []):
        nr = book["nr"]
        name = book["name"]
        chapters = book.get("chapters", [])
        testament = "AT" if nr <= 39 else "NT"
        books_docs.append({
            "id": f"{TRANSLATION['code']}-{nr}",
            "translation": TRANSLATION["code"],
            "book_nr": nr,
            "name": name,
            "testament": testament,
            "order": nr,
            "chapters_count": len(chapters),
        })
        for ch in chapters:
            cnum = ch["chapter"]
            for v in ch.get("verses", []):
                verse_docs.append({
                    "translation": TRANSLATION["code"],
                    "book_nr": nr,
                    "book_name": name,
                    "chapter": cnum,
                    "verse": v["verse"],
                    "text": (v.get("text") or "").strip(),
                })

    if books_docs:
        await db.bible_books.delete_many({"translation": TRANSLATION["code"]})
        await db.bible_books.insert_many(books_docs)
    # Insert verses in batches to stay memory-friendly.
    B = 4000
    for i in range(0, len(verse_docs), B):
        await db.bible_verses.insert_many(verse_docs[i:i + B])
    await _indices()
    logger.info("bible seed: imported %d books, %d verses (%s)", len(books_docs), len(verse_docs), TRANSLATION["code"])
