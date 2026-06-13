import asyncio
import secrets
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def update_users():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DATABASE_NAME]
    users = db.users.find({"badge_secret": {"$exists": False}})
    count = 0
    async for user in users:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"badge_secret": secrets.token_urlsafe(16)}}
        )
        count += 1
    print(f"Mise à jour terminée : {count} utilisateurs mis à jour.")

if __name__ == "__main__":
    asyncio.run(update_users())
