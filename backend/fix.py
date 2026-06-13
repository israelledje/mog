import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()
db = motor.motor_asyncio.AsyncIOMotorClient(os.getenv('MONGO_URI'))[os.getenv('DATABASE_NAME')]

async def main():
    res = await db.users.update_many({'role': None}, {'$set': {'role': 'client'}})
    print(f'Modified: {res.modified_count}')

asyncio.run(main())
