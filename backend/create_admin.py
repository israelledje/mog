import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import get_password_hash
import uuid
from datetime import datetime

async def create_admin():
    print("Connexion à la base de données...")
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DATABASE_NAME]
    
    admin_email = "admin@mog.com"
    existing_admin = await db.users.find_one({"email": admin_email})
    
    if existing_admin:
        print(f"L'utilisateur {admin_email} existe déjà.")
        return

    admin_user = {
        "_id": str(uuid.uuid4()),
        "email": admin_email,
        "hashed_password": get_password_hash("admin123"), # Mot de passe par défaut
        "full_name": "Administrateur",
        "city": "Paris",
        "role": "admin",
        "gender": "male",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    await db.users.insert_one(admin_user)
    print(f"✅ Administrateur créé avec succès !")
    print(f"Email : {admin_email}")
    print(f"Mot de passe : admin123")
    print(f"Vous pouvez vous connecter sur le Web Admin.")

if __name__ == "__main__":
    asyncio.run(create_admin())
