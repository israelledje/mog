"""Génération et attribution des codes client / opérateur / admin."""

from typing import Any


async def generate_client_code(db: Any, role: str = "client") -> str:
    if role == "admin":
        count = await db.users.count_documents({"role": "admin"})
        return f"ADM{(count + 1):03d}"
    if role == "operator":
        count = await db.users.count_documents({"role": "operator"})
        return f"OPS{(count + 1):03d}"
    count = await db.users.count_documents({"role": {"$in": ["client", None]}})
    return f"CM{(count + 124):05d}"


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
