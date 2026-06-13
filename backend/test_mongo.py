import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test_connection():
    uri = "mongodb://admin:mAt2Sxp6RXXpORZlEeXoFctu2MWUEO3S@187.124.37.155:32768/"
    print(f"Tentative de connexion a {uri.replace('mAt2Sxp6RXXpORZlEeXoFctu2MWUEO3S', '***')}...")
    
    try:
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        # Ping the database
        await client.admin.command('ping')
        print("SUCCES ! Connexion a la base de donnees etablie.")
        
        # Afficher les bases de données disponibles pour confirmer les droits
        db_names = await client.list_database_names()
        print(f"Bases de donnees disponibles : {db_names}")
        
    except Exception as e:
        print("ECHEC de la connexion !")
        print(f"Erreur : {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(test_connection())
