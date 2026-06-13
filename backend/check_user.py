import asyncio
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def check_user():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DATABASE_NAME]
    user = await db.users.find_one({"email": "israelledje@gmail.com"})
    if user:
        print(f"User found: {user.get('email')}")
        print(f"Badge Secret: {user.get('badge_secret')}")
        print(f"Role: {user.get('role')}")
        print(f"Phone: {user.get('phone')}")
    else:
        print("User not found")

if __name__ == "__main__":
    asyncio.run(check_user())
