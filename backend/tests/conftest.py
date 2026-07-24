"""Shared fixtures - ensures ADMINTESTTOKEN123 session exists for admin tests."""
import asyncio
from datetime import datetime, timedelta, timezone
import pytest
from motor.motor_asyncio import AsyncIOMotorClient


@pytest.fixture(scope="session", autouse=True)
def ensure_admin_session():
    """Insert (or refresh) admin session in user_sessions collection."""
    async def _seed():
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["test_database"]
        # ensure admin user exists
        admin = await db.users.find_one({"email": "pescatoridiuomini@outlook.it"})
        if not admin:
            await db.users.insert_one({
                "user_id": "user_admin001",
                "email": "pescatoridiuomini@outlook.it",
                "name": "Admin PdU",
                "picture": None,
                "provider": "google",
                "created_at": datetime.now(timezone.utc),
            })
            admin = {"user_id": "user_admin001"}
        # upsert session valid 7 days
        await db.user_sessions.update_one(
            {"session_token": "ADMINTESTTOKEN123"},
            {"$set": {
                "session_token": "ADMINTESTTOKEN123",
                "user_id": admin["user_id"],
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            }},
            upsert=True,
        )
        client.close()
    asyncio.get_event_loop().run_until_complete(_seed()) if False else asyncio.new_event_loop().run_until_complete(_seed())
    yield
