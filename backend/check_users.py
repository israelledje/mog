import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['cargo_tracker']
    users = await db.users.find().to_list(length=100)
    print("TOTAL USERS:", len(users))
    for u in users:
        print(f"ID: {u['_id']}, Email: {u.get('email')}, Role: {u.get('role')}")
    await client.close()

if __name__ == "__main__":
    asyncio.run(check())
