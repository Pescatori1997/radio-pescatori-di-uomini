"""Seed default achievements ("Traguardi del Cammino") and the walk board settings.

Idempotent: each achievement carries a stable ``seed_key`` so re-running never
duplicates. Thresholds/titles/tiers can be edited freely from the Admin panel
afterwards — the seed only fills the collection the first time each key is
missing (it never overwrites admin edits). The architecture supports adding new
metrics in the future (e.g. radio listening hours, prayer requests) simply by
adding rows here + extending ``_user_metric_counts`` in server.py.
"""

# metric must match a key produced by _user_metric_counts() in server.py:
#   plans | podcasts | meditations | verses | manual
DEFAULT_ACHIEVEMENTS = [
    # --- Piani Biblici completati ---
    {"seed_key": "plans_bronze", "category": "Piani Biblici", "tier": "bronze", "metric": "plans",
     "threshold": 1, "title": "Primo Piano Completato", "emoji": "📖",
     "description": "Hai portato a termine il tuo primo piano di lettura.",
     "back_label": "Piani completati"},
    {"seed_key": "plans_silver", "category": "Piani Biblici", "tier": "silver", "metric": "plans",
     "threshold": 3, "title": "Lettore Costante", "emoji": "📖",
     "description": "Tre piani di lettura completati: la costanza porta frutto.",
     "back_label": "Piani completati"},
    {"seed_key": "plans_gold", "category": "Piani Biblici", "tier": "gold", "metric": "plans",
     "threshold": 7, "title": "Pellegrino della Parola", "emoji": "📖",
     "description": "Sette piani completati: un vero cammino nella Scrittura.",
     "back_label": "Piani completati"},

    # --- Podcast ascoltati ---
    {"seed_key": "podcasts_bronze", "category": "Podcast", "tier": "bronze", "metric": "podcasts",
     "threshold": 1, "title": "Primo Ascolto", "emoji": "🎧",
     "description": "Hai ascoltato il tuo primo podcast.",
     "back_label": "Podcast ascoltati"},
    {"seed_key": "podcasts_silver", "category": "Podcast", "tier": "silver", "metric": "podcasts",
     "threshold": 10, "title": "Ascoltatore Fedele", "emoji": "🎧",
     "description": "Dieci podcast ascoltati: la Parola risuona nel cuore.",
     "back_label": "Podcast ascoltati"},
    {"seed_key": "podcasts_gold", "category": "Podcast", "tier": "gold", "metric": "podcasts",
     "threshold": 30, "title": "Compagno di Viaggio", "emoji": "🎧",
     "description": "Trenta podcast ascoltati: sempre in cammino con noi.",
     "back_label": "Podcast ascoltati"},

    # --- Meditazioni ---
    {"seed_key": "meditations_bronze", "category": "Meditazioni", "tier": "bronze", "metric": "meditations",
     "threshold": 1, "title": "Primo Raccoglimento", "emoji": "🕊️",
     "description": "Hai vissuto la tua prima meditazione.",
     "back_label": "Meditazioni vissute"},
    {"seed_key": "meditations_silver", "category": "Meditazioni", "tier": "silver", "metric": "meditations",
     "threshold": 10, "title": "Cuore in Ascolto", "emoji": "🕊️",
     "description": "Dieci meditazioni: uno spazio quotidiano per lo Spirito.",
     "back_label": "Meditazioni vissute"},
    {"seed_key": "meditations_gold", "category": "Meditazioni", "tier": "gold", "metric": "meditations",
     "threshold": 25, "title": "Anima Contemplativa", "emoji": "🕊️",
     "description": "Venticinque meditazioni: la pace che viene dall'alto.",
     "back_label": "Meditazioni vissute"},

    # --- Versetti salvati ---
    {"seed_key": "verses_bronze", "category": "Versetti", "tier": "bronze", "metric": "verses",
     "threshold": 1, "title": "Primo Tesoro", "emoji": "✨",
     "description": "Hai salvato il tuo primo versetto nel cuore.",
     "back_label": "Versetti salvati"},
    {"seed_key": "verses_silver", "category": "Versetti", "tier": "silver", "metric": "verses",
     "threshold": 15, "title": "Collezionista di Promesse", "emoji": "✨",
     "description": "Quindici versetti salvati: promesse custodite con cura.",
     "back_label": "Versetti salvati"},
    {"seed_key": "verses_gold", "category": "Versetti", "tier": "gold", "metric": "verses",
     "threshold": 50, "title": "Scrigno della Parola", "emoji": "✨",
     "description": "Cinquanta versetti salvati: un tesoro di grazia.",
     "back_label": "Versetti salvati"},
]

DEFAULT_BOARD = {
    "id": "default", "enabled": True, "title": "Traguardi del Cammino",
    "principle_line1": "NON È UNA GARA.", "principle_line2": "È UN CAMMINO.",
    "intro_text": "Ogni medaglia non racconta quanto sei migliore degli altri. Racconta semplicemente che hai continuato.",
    "animation_enabled": True, "empty_slots_mode": "plaque", "continue_text": "Il cammino continua…",
    "wood": "walnut",
}


async def seed_achievements(db, logger, new_id, now_utc):
    # Board settings (fill only if missing; never overwrite admin edits).
    if not await db.walk_board.find_one({"id": "default"}):
        await db.walk_board.insert_one(dict(DEFAULT_BOARD))
        logger.info("walk board seeded")

    created = 0
    for i, a in enumerate(DEFAULT_ACHIEVEMENTS):
        if await db.achievements.find_one({"seed_key": a["seed_key"]}):
            continue
        doc = dict(a)
        doc["id"] = new_id("ach")
        doc["active"] = True
        doc["order"] = i
        doc["image"] = None
        doc["created_at"] = now_utc().isoformat()
        await db.achievements.insert_one(doc)
        created += 1
    if created:
        logger.info("achievements seeded: %d", created)
