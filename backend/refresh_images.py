"""One-off data refresh: swap seeded images for cross-free Christian-themed placeholders.
Does NOT change schema, routes or backend logic — only updates image fields."""
import os
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

RADIO_STUDIO = "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=900&q=80"

# live/now-playing hero -> radio studio (no cross)
db.live_status.update_one({"_id": "current"}, {"$set": {"artwork": RADIO_STUDIO}})

# podcasts by category -> themed, cross-free
pod_img = {
    "Studi Biblici": "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=600&q=80",   # open Bible
    "Testimonianze": "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=600&q=80",   # person in light
    "Predicazioni": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600&q=80",    # microphone
    "Famiglia": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=600&q=80",        # family
    "Giovani": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80",         # youth group
    "Preghiera": "https://images.unsplash.com/photo-1445445290350-18a3b86e0b5a?w=600&q=80",       # praying hands
}
for cat, url in pod_img.items():
    db.podcasts.update_many({"category": cat}, {"$set": {"artwork": url}})

# news by category -> themed, cross-free
news_img = {
    "Missioni": "https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=940&q=80",        # volunteers
    "Eventi": "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=940&q=80",           # worship concert
    "Testimonianze": "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=940&q=80",    # person
    "Mondo Cristiano": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=940&q=80",  # globe/world
}
for cat, url in news_img.items():
    db.news.update_many({"category": cat}, {"$set": {"image": url}})

print("live:", db.live_status.find_one({"_id": "current"}, {"artwork": 1}))
print("podcasts updated:", db.podcasts.count_documents({}))
print("news updated:", db.news.count_documents({}))
print("done")
