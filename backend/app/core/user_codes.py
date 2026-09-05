"""
Génération et attribution des codes client / opérateur / admin.

Utilise find_one_and_update avec $inc pour un compteur atomique MongoDB,
évitant toute race condition (count + insert non-atomique).

Collection utilisée : db.counters
Documents : { _id: "counter_client" | "counter_admin" | "counter_operator", seq: <int> }
"""

from typing import Any
from pymongo import ReturnDocument


async def generate_client_code(db: Any, role: str = "client") -> str:
    """
    Génère un code unique de façon atomique via un compteur MongoDB.
    Format : MOG00125+ pour les clients, ADM001+ pour les admins, OPS001+ pour les opérateurs.
    """
    prefix_map = {
        "admin": ("ADM", "counter_admin"),
        "operator": ("OPS", "counter_operator"),
    }

    if role in prefix_map:
        prefix, counter_key = prefix_map[role]
        result = await db.counters.find_one_and_update(
            {"_id": counter_key},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return f"{prefix}{result['seq']:03d}"

    # Client : préfixe MOG avec offset 124 pour conserver la séquence
    result = await db.counters.find_one_and_update(
        {"_id": "counter_client"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"MOG{result['seq'] + 124:05d}"


async def ensure_client_code(db: Any, user: dict) -> str:
    """Retourne le code existant ou en génère un pour les comptes legacy."""
    existing = user.get("client_code")
    if existing:
        if str(existing).startswith("CM"):
            existing = "MOG" + str(existing)[2:]
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"client_code": existing}},
            )
        return existing

    role = user.get("role", "client")
    code = await generate_client_code(db, role)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"client_code": code}},
    )
    return code
