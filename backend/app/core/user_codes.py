"""
Génération et attribution des codes client / opérateur / admin.

Utilise find_one_and_update avec $inc pour un compteur atomique MongoDB,
évitant toute race condition (count + insert non-atomique de l'ancienne version).

Collection utilisée : db.counters
Documents : { _id: "counter_client" | "counter_admin" | "counter_operator", seq: <int> }
"""

from typing import Any


async def generate_client_code(db: Any, role: str = "client") -> str:
    """
    Génère un code unique de façon atomique via un compteur MongoDB.
    Rétrocompatible : l'offset 124 pour les clients conserve la séquence existante.
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
            return_document=True,  # pymongo ReturnDocument.AFTER
        )
        return f"{prefix}{result['seq']:03d}"

    # client — offset 124 conservé pour rétrocompatibilité avec les codes CM00125+
    result = await db.counters.find_one_and_update(
        {"_id": "counter_client"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return f"CM{result['seq'] + 124:05d}"


async def ensure_client_code(db: Any, user: dict) -> str:
    """Retourne le code existant ou en génère un pour les comptes legacy."""
    existing = user.get("client_code")
    if existing:
        return existing

    role = user.get("role", "client")
    code = await generate_client_code(db, role)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"client_code": code}},
    )
    return code
