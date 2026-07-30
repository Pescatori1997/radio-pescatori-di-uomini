"""Seed 1-2 example Bible reading plans (Riveduta 1927, self-hosted).

Idempotent: only inserts a plan if a plan with the same `seed_key` is missing.
Admin edits are never overwritten (we match on seed_key, not on content).
Book names are resolved to book_nr via BOOKS map to stay consistent with the
self-hosted Bible collection.
"""

BOOKS = {
    "Genesi": 1, "Esodo": 2, "Levitico": 3, "Numeri": 4, "Deuteronomio": 5,
    "Giosuè": 6, "Giudici": 7, "Rut": 8, "1 Samuele": 9, "2 Samuele": 10,
    "1 Re": 11, "2 Re": 12, "1 Cronache": 13, "2 Cronache": 14, "Esdra": 15,
    "Neemia": 16, "Ester": 17, "Giobbe": 18, "Salmi": 19, "Proverbi": 20,
    "Ecclesiaste": 21, "Cantico dei Cantici": 22, "Isaia": 23, "Geremia": 24,
    "Lamentazioni": 25, "Ezechiele": 26, "Daniele": 27, "Osea": 28, "Gioele": 29,
    "Amos": 30, "Abdia": 31, "Giona": 32, "Michea": 33, "Nahum": 34, "Abacuc": 35,
    "Sofonia": 36, "Aggeo": 37, "Zaccaria": 38, "Malachia": 39, "Matteo": 40,
    "Marco": 41, "Luca": 42, "Giovanni": 43, "Atti": 44, "Romani": 45,
    "1 Corinzi": 46, "2 Corinzi": 47, "Galati": 48, "Efesini": 49, "Filippesi": 50,
    "Colossesi": 51, "1 Tessalonicesi": 52, "2 Tessalonicesi": 53, "1 Timoteo": 54,
    "2 Timoteo": 55, "Tito": 56, "Filemone": 57, "Ebrei": 58, "Giacomo": 59,
    "1 Pietro": 60, "2 Pietro": 61, "1 Giovanni": 62, "2 Giovanni": 63,
    "3 Giovanni": 64, "Giuda": 65, "Apocalisse": 66,
}


def _r(name, chapter, vs=None, ve=None, label=None):
    return {
        "book_nr": BOOKS[name], "book_name": name, "chapter": chapter,
        "verse_start": vs, "verse_end": ve, "label": label or f"{name} {chapter}",
    }


PLAN_JESUS = {
    "seed_key": "incontra-gesu-7",
    "title": "Incontra Gesù – 7 giorni nei Vangeli",
    "subtitle": "Un cammino di 7 giorni tra i Vangeli",
    "description": "Sette tappe per conoscere Gesù: dalla sua venuta al mondo fino alla risurrezione. Ogni giorno un capitolo da leggere e una breve meditazione.",
    "category": "Vangeli",
    "featured": True,
    "status": "published",
    "order": 0,
    "days": [
        {"day": 1, "title": "La Parola fatta carne", "meditation": "Gesù è il Verbo eterno che si è fatto uomo per abitare in mezzo a noi. In lui vediamo il volto di Dio.", "readings": [_r("Giovanni", 1)]},
        {"day": 2, "title": "La nascita del Salvatore", "meditation": "Dio sceglie l'umiltà di una mangiatoia. La salvezza entra nel mondo in silenzio, ma i cieli cantano.", "readings": [_r("Luca", 2)]},
        {"day": 3, "title": "Il Sermone sul monte", "meditation": "Gesù rivela il cuore del Regno: beati gli umili, i miti, gli assetati di giustizia.", "readings": [_r("Matteo", 5)]},
        {"day": 4, "title": "Dovete nascere di nuovo", "meditation": "L'incontro con Nicodemo ci ricorda che la vita nuova è un dono dello Spirito, non uno sforzo umano.", "readings": [_r("Giovanni", 3)]},
        {"day": 5, "title": "Il Padre che corre incontro", "meditation": "Nelle parabole della grazia scopriamo un Dio che cerca chi è perduto e fa festa quando torna a casa.", "readings": [_r("Luca", 15)]},
        {"day": 6, "title": "L'amore fino alla croce", "meditation": "Alla croce l'amore di Dio raggiunge il suo culmine: Gesù dona la vita per noi.", "readings": [_r("Giovanni", 19)]},
        {"day": 7, "title": "Egli è risorto!", "meditation": "La tomba è vuota. La risurrezione di Gesù è la nostra speranza viva.", "readings": [_r("Giovanni", 20)]},
    ],
}

PLAN_PROMISES = {
    "seed_key": "promesse-di-dio-30",
    "title": "Le Promesse di Dio – 30 giorni di speranza",
    "subtitle": "30 giorni ancorati alle promesse di Dio",
    "description": "Un mese per riscoprire, giorno dopo giorno, le promesse di Dio: pace, protezione, forza e speranza per ogni stagione della vita.",
    "category": "Speranza",
    "featured": True,
    "status": "published",
    "order": 1,
    "days": [
        {"day": 1, "title": "Un futuro e una speranza", "meditation": "Dio ha pensieri di pace per te.", "readings": [_r("Geremia", 29, 11, 14, "Geremia 29:11-14")]},
        {"day": 2, "title": "Non temere, io sono con te", "meditation": "La presenza di Dio scaccia la paura.", "readings": [_r("Isaia", 41)]},
        {"day": 3, "title": "Il Signore è il mio pastore", "meditation": "Nulla ti mancherà sotto la sua guida.", "readings": [_r("Salmi", 23)]},
        {"day": 4, "title": "Più che vincitori", "meditation": "Nulla può separarci dall'amore di Cristo.", "readings": [_r("Romani", 8)]},
        {"day": 5, "title": "All'ombra dell'Onnipotente", "meditation": "Chi dimora in Dio trova rifugio sicuro.", "readings": [_r("Salmi", 91)]},
        {"day": 6, "title": "Venite a me, voi tutti", "meditation": "Gesù dona riposo a chi è affaticato.", "readings": [_r("Matteo", 11, 25, 30, "Matteo 11:25-30")]},
        {"day": 7, "title": "Quelli che sperano nel Signore", "meditation": "Chi spera in Dio riprende nuove forze.", "readings": [_r("Isaia", 40)]},
        {"day": 8, "title": "Dio è nostro rifugio", "meditation": "Anche se la terra trema, Dio è la nostra forza.", "readings": [_r("Salmi", 46)]},
        {"day": 9, "title": "Non si turbi il vostro cuore", "meditation": "Gesù prepara un posto per noi.", "readings": [_r("Giovanni", 14)]},
        {"day": 10, "title": "La pace di Dio", "meditation": "Una pace che supera ogni intelligenza.", "readings": [_r("Filippesi", 4)]},
        {"day": 11, "title": "Il Signore è vicino", "meditation": "Dio è vicino a chi ha il cuore spezzato.", "readings": [_r("Salmi", 34)]},
        {"day": 12, "title": "Non ci scoraggiamo", "meditation": "Le afflizioni preparano una gloria eterna.", "readings": [_r("2 Corinzi", 4)]},
        {"day": 13, "title": "La fede", "meditation": "La fede è certezza di cose che si sperano.", "readings": [_r("Ebrei", 11)]},
        {"day": 14, "title": "Il mio aiuto viene dal Signore", "meditation": "Dio veglia su di te giorno e notte.", "readings": [_r("Salmi", 121)]},
        {"day": 15, "title": "Le sue compassioni si rinnovano", "meditation": "Ogni mattina la fedeltà di Dio è nuova.", "readings": [_r("Lamentazioni", 3, 19, 26, "Lamentazioni 3:19-26")]},
        {"day": 16, "title": "Il Dio della speranza", "meditation": "Dio riempie di gioia e di pace chi crede.", "readings": [_r("Romani", 15)]},
        {"day": 17, "title": "Il Signore è la mia luce", "meditation": "Di chi temerò? Il Signore è la mia fortezza.", "readings": [_r("Salmi", 27)]},
        {"day": 18, "title": "Gettate su di lui ogni ansietà", "meditation": "Dio si prende cura di te.", "readings": [_r("1 Pietro", 5)]},
        {"day": 19, "title": "Ti ho chiamato per nome", "meditation": "Sei prezioso agli occhi di Dio.", "readings": [_r("Isaia", 43)]},
        {"day": 20, "title": "Benedici l'anima mia", "meditation": "Ricorda tutti i benefici del Signore.", "readings": [_r("Salmi", 103)]},
        {"day": 21, "title": "Non siate in ansia", "meditation": "Cercate prima il Regno di Dio.", "readings": [_r("Matteo", 6, 25, 34, "Matteo 6:25-34")]},
        {"day": 22, "title": "Sii forte e coraggioso", "meditation": "Il Signore è con te ovunque tu vada.", "readings": [_r("Giosuè", 1)]},
        {"day": 23, "title": "Solo in Dio riposa l'anima mia", "meditation": "Da lui viene la mia salvezza.", "readings": [_r("Salmi", 62)]},
        {"day": 24, "title": "Spirito di forza e amore", "meditation": "Dio non ci ha dato uno spirito di timidezza.", "readings": [_r("2 Timoteo", 1)]},
        {"day": 25, "title": "La gioia viene al mattino", "meditation": "Il pianto dura una notte, ma la gioia ritorna.", "readings": [_r("Salmi", 30)]},
        {"day": 26, "title": "Radicati nell'amore", "meditation": "Conoscere l'amore di Cristo che sorpassa ogni cosa.", "readings": [_r("Efesini", 3)]},
        {"day": 27, "title": "Ho pazientemente aspettato", "meditation": "Dio ascolta il grido e mette un cantico nuovo.", "readings": [_r("Salmi", 40)]},
        {"day": 28, "title": "Farò nuove tutte le cose", "meditation": "Un giorno Dio asciugherà ogni lacrima.", "readings": [_r("Apocalisse", 21)]},
        {"day": 29, "title": "La speranza non delude", "meditation": "L'amore di Dio è sparso nei nostri cuori.", "readings": [_r("Romani", 5)]},
        {"day": 30, "title": "La speranza come àncora", "meditation": "Una speranza sicura e ferma per l'anima.", "readings": [_r("Ebrei", 6, 13, 20, "Ebrei 6:13-20")]},
    ],
}

SEED_PLANS = [PLAN_JESUS, PLAN_PROMISES]


async def seed_reading_plans(db, logger, new_id, now_utc):
    """Insert the example plans if their seed_key is missing (idempotent)."""
    inserted = 0
    for tpl in SEED_PLANS:
        if await db.reading_plans.find_one({"seed_key": tpl["seed_key"]}):
            continue
        now = now_utc()
        doc = {
            "id": new_id("plan"),
            "seed_key": tpl["seed_key"],
            "title": tpl["title"],
            "subtitle": tpl.get("subtitle"),
            "description": tpl.get("description"),
            "cover": tpl.get("cover"),
            "category": tpl.get("category"),
            "featured": tpl.get("featured", False),
            "status": tpl.get("status", "published"),
            "order": tpl.get("order", 0),
            "days": tpl["days"],
            "duration_days": len(tpl["days"]),
            "created_at": now,
            "updated_at": now,
            "published_at": now if tpl.get("status") == "published" else None,
        }
        await db.reading_plans.insert_one(doc)
        inserted += 1
    if inserted:
        logger.info("Seeded %d reading plan(s)", inserted)
