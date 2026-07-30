"""Helpers promo / commission / parrainage."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
import re
import secrets
import string


def normalize_code(code: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (code or "").upper())


def generate_code(prefix: str = "", length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    body = "".join(secrets.choice(alphabet) for _ in range(length))
    return f"{prefix}{body}" if prefix else body


async def get_growth_settings(db) -> dict:
    doc = await db.growth_settings.find_one({"_id": "global"})
    defaults = {
        "_id": "global",
        "default_commission_rate_percent": 5.0,
        "commission_on_marketplace": True,
        "commission_on_groupage": True,
        "commission_on_paid_packages": True,
        "referral_signup_bonus_points": 50,
        "marketplace_enabled": True,
    }
    if not doc:
        await db.growth_settings.insert_one(defaults)
        return defaults
    merged = {**defaults, **doc}
    return merged


def compute_discount(amount: float, promo: dict) -> float:
    if amount <= 0:
        return 0.0
    dtype = promo.get("discount_type") or "percent"
    value = float(promo.get("discount_value") or 0)
    if dtype == "fixed":
        return min(amount, max(0.0, value))
    # percent
    return min(amount, max(0.0, amount * value / 100.0))


async def validate_promo(db, code: str, amount_xaf: float, context: str) -> dict:
    """Retourne {ok, promo, discount, error}."""
    norm = normalize_code(code)
    if not norm:
        return {"ok": False, "error": "Code promo requis"}
    promo = await db.promo_codes.find_one({"code": norm})
    if not promo:
        return {"ok": False, "error": "Code promo invalide"}
    if not promo.get("active", True):
        return {"ok": False, "error": "Code promo inactif"}
    now = datetime.utcnow()

    def _as_dt(value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00").replace("+00:00", ""))
            except Exception:
                return None
        return None

    vf = _as_dt(promo.get("valid_from"))
    vu = _as_dt(promo.get("valid_until"))
    if vf and now < vf:
        return {"ok": False, "error": "Code promo pas encore valide"}
    if vu and now > vu:
        return {"ok": False, "error": "Code promo expiré"}
    applicable = promo.get("applicable_to") or "all"
    if applicable not in ("all", context):
        return {"ok": False, "error": f"Code non applicable à {context}"}
    min_amt = float(promo.get("min_amount_xaf") or 0)
    if amount_xaf < min_amt:
        return {"ok": False, "error": f"Montant minimum : {min_amt:.0f} XAF"}
    max_uses = promo.get("max_uses")
    used = int(promo.get("used_count") or 0)
    if max_uses is not None and used >= int(max_uses):
        return {"ok": False, "error": "Code promo épuisé"}
    discount = compute_discount(amount_xaf, promo)
    return {"ok": True, "promo": promo, "discount": discount}


async def resolve_referrer(db, referral_code: Optional[str]) -> dict:
    """
    Résout un code de parrainage :
    - agent commercial (sales_agents.referral_code)
    - ou client (users.client_code)
    """
    if not referral_code:
        return {}
    norm = normalize_code(referral_code)
    agent = await db.sales_agents.find_one({"referral_code": norm, "active": True})
    if agent:
        return {
            "referred_by_agent_id": str(agent["_id"]),
            "referred_by_agent_code": norm,
            "referred_by_type": "agent",
        }
    user = await db.users.find_one({"client_code": norm})
    if user:
        return {
            "referred_by_user_email": user.get("email"),
            "referred_by_client_code": norm,
            "referred_by_type": "client",
        }
    return {"referral_invalid": True}


async def record_commission(
    db,
    *,
    client_email: str,
    source: str,
    amount_xaf: float,
    reference_id: str,
    label: str,
) -> Optional[dict]:
    """Crée une commission pour l'agent du client parrainé, si applicable."""
    if amount_xaf <= 0:
        return None
    user = await db.users.find_one({"email": client_email})
    if not user:
        return None
    agent_id = user.get("referred_by_agent_id")
    if not agent_id:
        return None
    agent = await db.sales_agents.find_one({"_id": agent_id, "active": True})
    if not agent:
        return None

    settings = await get_growth_settings(db)
    if source == "marketplace" and not settings.get("commission_on_marketplace", True):
        return None
    if source == "groupage" and not settings.get("commission_on_groupage", True):
        return None
    if source == "package_paid" and not settings.get("commission_on_paid_packages", True):
        return None

    rate = agent.get("commission_rate_percent")
    if rate is None:
        rate = float(settings.get("default_commission_rate_percent") or 5)
    rate = float(rate)
    commission_amount = round(amount_xaf * rate / 100.0, 2)
    if commission_amount <= 0:
        return None

    doc = {
        "_id": generate_code("CM", 12),
        "agent_id": agent_id,
        "agent_code": agent.get("referral_code"),
        "agent_name": agent.get("full_name"),
        "client_email": client_email,
        "source": source,
        "reference_id": reference_id,
        "label": label,
        "base_amount_xaf": amount_xaf,
        "rate_percent": rate,
        "commission_xaf": commission_amount,
        "status": "pending",  # pending | validated | paid
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.commissions.insert_one(doc)
    await db.sales_agents.update_one(
        {"_id": agent_id},
        {
            "$inc": {
                "stats.pending_commission_xaf": commission_amount,
                "stats.orders_count": 1,
            }
        },
    )
    return doc


def serialize_doc(doc: dict) -> dict:
    if not doc:
        return doc
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out["_id"])
    return out
