import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()
db = motor.motor_asyncio.AsyncIOMotorClient(os.getenv('MONGO_URI'))[os.getenv('DATABASE_NAME')]

async def main():
    users = await db.users.find().to_list(100)
    print([(u.get('email'), u.get('role')) for u in users])

asyncio.run(main())
