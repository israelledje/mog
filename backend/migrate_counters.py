"""
Script de migration one-shot : initialise les compteurs atomiques MongoDB
à partir du nombre de documents existants dans chaque rôle.

À exécuter UNE SEULE FOIS avant le redémarrage du backend avec la nouvelle version.

Usage :
    docker exec cargo-tracker-api python migrate_counters.py
    # ou en local :
    python migrate_counters.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "cargo_app")


async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]

    # Compter les utilisateurs existants par rôle
    client_count = await db.users.count_documents({"role": {"$in": ["client", None]}})
    admin_count = await db.users.count_documents({"role": "admin"})
    operator_count = await db.users.count_documents({"role": "operator"})

    print(f"Clients existants   : {client_count}")
    print(f"Admins existants    : {admin_count}")
    print(f"Opérateurs existants: {operator_count}")

    # Initialiser les compteurs seulement s'ils n'existent pas déjà
    existing_client = await db.counters.find_one({"_id": "counter_client"})
    if not existing_client:
        await db.counters.insert_one({"_id": "counter_client", "seq": client_count})
        print(f"✅ counter_client initialisé à {client_count}")
    else:
        print(f"⚠️  counter_client déjà à {existing_client['seq']} — ignoré")

    existing_admin = await db.counters.find_one({"_id": "counter_admin"})
    if not existing_admin:
        await db.counters.insert_one({"_id": "counter_admin", "seq": admin_count})
        print(f"✅ counter_admin initialisé à {admin_count}")
    else:
        print(f"⚠️  counter_admin déjà à {existing_admin['seq']} — ignoré")

    existing_op = await db.counters.find_one({"_id": "counter_operator"})
    if not existing_op:
        await db.counters.insert_one({"_id": "counter_operator", "seq": operator_count})
        print(f"✅ counter_operator initialisé à {operator_count}")
    else:
        print(f"⚠️  counter_operator déjà à {existing_op['seq']} — ignoré")

    print("\n✅ Migration des compteurs terminée. Vous pouvez redémarrer le backend.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
