import asyncio, os, uuid, datetime
from dotenv import load_dotenv
load_dotenv()
from motor.motor_asyncio import AsyncIOMotorClient
from reading_plans_seed import _r

def now(): return datetime.datetime.now(datetime.timezone.utc)

def days3(a, b, c, r1, r2, r3):
    return [
        {"day": 1, "title": a[0], "meditation": a[1], "readings": [r1]},
        {"day": 2, "title": b[0], "meditation": b[1], "readings": [r2]},
        {"day": 3, "title": c[0], "meditation": c[1], "readings": [r3]},
    ]

DEMO = [
    ("demo-radicati", "Radicati nella Parola", "10 giorni per costruire la tua fede", "Crescita Spirituale", 10,
     days3(("La Parola che dà vita", "La Parola di Dio non è solo informazione, ma è vita. Nutriti ogni giorno di essa."),
           ("Radicati e fondati", "Come un albero piantato lungo corsi d'acqua, chi confida nel Signore porta frutto."),
           ("Crescere nella grazia", "La crescita è un dono quotidiano dello Spirito."),
           _r("Giovanni", 6, 63, 63, "Giovanni 6:63"), _r("Salmi", 1), _r("2 Pietro", 3, 18, 18, "2 Pietro 3:18"))),
    ("demo-crescere", "Crescere in Cristo", "7 giorni di maturità spirituale", "Crescita Spirituale", 7,
     days3(("Rimanere in Lui", "Il tralcio porta frutto solo se rimane nella vite."),
           ("Rinnovati nella mente", "Non conformatevi al mondo, ma siate trasformati."),
           ("Corri verso la meta", "Dimenticando le cose passate, corro verso il premio."),
           _r("Giovanni", 15), _r("Romani", 12, 1, 2, "Romani 12:1-2"), _r("Filippesi", 3, 12, 14, "Filippesi 3:12-14"))),
    ("demo-amare", "Amare come Gesù", "7 giorni nell'amore di Dio", "Vita Cristiana", 7,
     days3(("L'amore paziente", "L'amore è paziente, è benigno."),
           ("Amatevi gli uni gli altri", "Da questo conosceranno che siete miei discepoli."),
           ("Servire con umiltà", "Gesù lavò i piedi ai discepoli."),
           _r("1 Corinzi", 13), _r("Giovanni", 13, 34, 35, "Giovanni 13:34-35"), _r("Giovanni", 13, 1, 17, "Giovanni 13:1-17"))),
    ("demo-perdonare", "Perdonare come Dio", "7 giorni di libertà nel perdono", "Vita Cristiana", 7,
     days3(("Il debito perdonato", "A chi molto è perdonato, molto ama."),
           ("Settanta volte sette", "Il perdono non ha limiti di conteggio."),
           ("Liberi dal rancore", "Perdonate come Dio vi ha perdonati in Cristo."),
           _r("Matteo", 18, 21, 35, "Matteo 18:21-35"), _r("Matteo", 18, 21, 22, "Matteo 18:21-22"), _r("Efesini", 4, 31, 32, "Efesini 4:31-32"))),
    ("demo-armatura", "L'armatura di Dio", "7 giorni per resistere nel combattimento", "Tematici", 7,
     days3(("Rivestitevi dell'armatura", "Per poter resistere alle insidie del nemico."),
           ("La cintura della verità", "La verità è il fondamento di ogni difesa."),
           ("Lo scudo della fede", "Con esso spegnerai i dardi infuocati."),
           _r("Efesini", 6, 10, 18, "Efesini 6:10-18"), _r("Efesini", 6, 14, 14, "Efesini 6:14"), _r("Efesini", 6, 16, 16, "Efesini 6:16"))),
    ("demo-cuore", "Un cuore secondo Dio", "10 giorni di intimità con il Signore", "Tematici", 10,
     days3(("Crea in me un cuore puro", "Il sacrificio a Dio è uno spirito rotto."),
           ("Custodisci il tuo cuore", "Da esso provengono le sorgenti della vita."),
           ("Un cuore che ascolta", "Parla, Signore, il tuo servo ti ascolta."),
           _r("Salmi", 51), _r("Proverbi", 4, 20, 27, "Proverbi 4:20-27"), _r("1 Samuele", 3, 1, 10, "1 Samuele 3:1-10"))),
    ("demo-matrimonio", "Un matrimonio che onora Dio", "10 giorni per una coppia unita", "Famiglia", 10,
     days3(("Una sola carne", "Ciò che Dio ha unito l'uomo non separi."),
           ("Amore e rispetto", "Mariti amate, mogli rispettate."),
           ("Servirsi a vicenda", "Sottomettetevi gli uni agli altri nel timore di Cristo."),
           _r("Genesi", 2, 18, 25, "Genesi 2:18-25"), _r("Efesini", 5, 22, 33, "Efesini 5:22-33"), _r("Efesini", 5, 21, 21, "Efesini 5:21"))),
    ("demo-pregare", "Pregare per il mondo", "10 giorni di intercessione", "Piani Speciali", 10,
     days3(("Pregate senza sosta", "La preghiera del giusto ha grande efficacia."),
           ("Per i governanti", "Che possiamo vivere in pace e tranquillità."),
           ("Che venga il tuo Regno", "Sia fatta la tua volontà in terra come in cielo."),
           _r("1 Tessalonicesi", 5, 16, 18, "1 Tessalonicesi 5:16-18"), _r("1 Timoteo", 2, 1, 4, "1 Timoteo 2:1-4"), _r("Matteo", 6, 9, 13, "Matteo 6:9-13"))),
]

async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"]); db = c[os.environ.get("DB_NAME", "test_database")]
    ins = 0
    for i, (sk, title, subtitle, cat, dur, days) in enumerate(DEMO):
        if await db.reading_plans.find_one({"seed_key": sk}):
            continue
        n = now()
        await db.reading_plans.insert_one({
            "id": f"plan_{uuid.uuid4().hex[:12]}", "seed_key": sk, "demo": True,
            "title": title, "subtitle": subtitle, "description": subtitle + ". Ogni giorno una breve meditazione e una lettura biblica.",
            "cover": None, "category": cat, "featured": False, "status": "published", "order": 10 + i,
            "days": days, "duration_days": dur, "created_at": n, "updated_at": n, "published_at": n,
        })
        ins += 1
    print(f"Inserted {ins} demo plans")
    cats = {}
    async for p in db.reading_plans.find({"status": "published"}, {"_id": 0, "category": 1}):
        cats[p.get("category")] = cats.get(p.get("category"), 0) + 1
    print("Categories:", cats)

asyncio.run(main())
