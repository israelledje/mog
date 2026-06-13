import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_data():
    uri = "mongodb://admin:mAt2Sxp6RXXpORZlEeXoFctu2MWUEO3S@187.124.37.155:32768/"
    client = AsyncIOMotorClient(uri)
    db = client.cargo_app
    
    groupages = await db.groupages.count_documents({})
    colis = await db.packages.count_documents({})
    users = await db.users.count_documents({})
    
    print(f"--- DATA DANS LA BASE DISTANTE (187.124.37.155) ---")
    print(f"Groupages : {groupages}")
    print(f"Colis : {colis}")
    print(f"Users : {users}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_data())
