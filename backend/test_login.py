import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import verify_password

async def test_login():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DATABASE_NAME]
    
    email = "israelledje@gmail.com"
    password = "Admin@2026"
    
    user = await db.users.find_one({"email": email})
    if not user:
        print("X User not found!")
    else:
        print(f"OK User found: {user.get('email')}")
        print(f"Role: {user.get('role')}")
        
        is_valid = verify_password(password, user["hashed_password"])
        if is_valid:
            print("OK Password is valid!")
        else:
            print("X Password is INVALID!")
            print(f"Hash in DB: {user['hashed_password']}")
            
    client.close()

if __name__ == "__main__":
    asyncio.run(test_login())
