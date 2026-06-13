from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_manager = Database()

async def connect_to_mongo():
    logger.info("Connecting to MongoDB...")
    db_manager.client = AsyncIOMotorClient(settings.MONGO_URI)
    db_manager.db = db_manager.client[settings.DATABASE_NAME]
    logger.info("Connected to MongoDB successfully!")

async def close_mongo_connection():
    logger.info("Closing MongoDB connection...")
    db_manager.client.close()
    logger.info("MongoDB connection closed.")

def get_database():
    return db_manager.db
