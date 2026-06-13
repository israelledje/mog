import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json
from bson import json_util

async def check_colis():
    uri = "mongodb://admin:mAt2Sxp6RXXpORZlEeXoFctu2MWUEO3S@187.124.37.155:32768/"
    client = AsyncIOMotorClient(uri)
    db = client.cargo_app
    
    colis = await db.packages.find_one({})
    
    if colis:
        print("Détails du Colis :")
        print(json.dumps(json.loads(json_util.dumps(colis)), indent=2, ensure_ascii=False))
        
        owner_id = colis.get("owner_id") or colis.get("client_id")
        if owner_id:
            owner = await db.users.find_one({"_id": owner_id}) or await db.users.find_one({"email": owner_id})
            if owner:
                print("\nPropriétaire trouvé :")
                print(f"Nom : {owner.get('full_name')}")
                print(f"Email : {owner.get('email')}")
            else:
                print(f"\nLe propriétaire ID '{owner_id}' n'existe pas dans la collection 'users'.")
    else:
        print("Aucun colis trouvé.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_colis())
