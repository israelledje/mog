"""
M.O.G CLUB — fidélité basée sur le volume (CBM) et paliers VIP.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

AIR_KG_PER_CBM = 167.0

DEFAULT_TIERS = [
    {"id": "bronze", "name": "Bronze", "min_cbm": 0, "points_per_cbm": 10, "emoji": "🥉"},
    {"id": "silver", "name": "Silver", "min_cbm": 20, "points_per_cbm": 15, "emoji": "🥈"},
    {"id": "gold", "name": "Gold", "min_cbm": 50, "points_per_cbm": 20, "emoji": "🥇"},
    {"id": "vip", "name": "VIP", "min_cbm": 100, "points_per_cbm": 25, "emoji": "🏆"},
]

DEFAULT_LOYALTY = {
    "point_value_xaf": 20,
    "air_kg_per_cbm": AIR_KG_PER_CBM,
    "loyalty_tiers": DEFAULT_TIERS,
    "vip_benefits": "Avantages personnalisés — contactez M.O.G PARTNERS",
    "award_on_statuses": ["in_transit", "departed"],
}


def normalize_tiers(raw: Any) -> list[dict]:
    if not isinstance(raw, list) or not raw:
        return [dict(t) for t in DEFAULT_TIERS]
    tiers = []
    for t in raw:
        if not isinstance(t, dict) or not t.get("id"):
            continue
        tiers.append({
            "id": str(t["id"]),
            "name": str(t.get("name") or t["id"]).title(),
            "min_cbm": float(t.get("min_cbm") or 0),
            "points_per_cbm": float(t.get("points_per_cbm") or 10),
            "emoji": str(t.get("emoji") or ""),
        })
    if not tiers:
        return [dict(t) for t in DEFAULT_TIERS]
    return sorted(tiers, key=lambda x: x["min_cbm"])


def resolve_tier(cumulative_cbm: float, tiers: list[dict]) -> dict:
    ordered = sorted(tiers, key=lambda x: x["min_cbm"])
    current = ordered[0]
    for t in ordered:
        if cumulative_cbm + 1e-9 >= float(t["min_cbm"]):
            current = t
    return current


def next_tier(cumulative_cbm: float, tiers: list[dict]) -> Optional[dict]:
    ordered = sorted(tiers, key=lambda x: x["min_cbm"])
    for t in ordered:
        if float(t["min_cbm"]) > cumulative_cbm + 1e-9:
            return t
    return None


def physical_cbm(pkg: dict) -> float:
    from app.core.freight_billing import physical_cbm as _cbm
    return _cbm(pkg)


def air_chargeable_kg(pkg: dict) -> float:
    from app.core.freight_billing import air_chargeable_kg as _kg
    return _kg(pkg)


def air_billed_kg(pkg: dict) -> float:
    from app.core.freight_billing import air_billed_kg as _billed
    return _billed(pkg)


def sea_billed_cbm(pkg: dict) -> float:
    from app.core.freight_billing import sea_billed_cbm as _cbm
    return _cbm(pkg)


def loyalty_cbm_for_package(pkg: dict, air_kg_per_cbm: float = AIR_KG_PER_CBM) -> float:
    mode = (pkg.get("transport_mode") or "sea").lower()
    if mode in ("air", "air_express"):
        kg = air_chargeable_kg(pkg)
        if kg <= 0:
            return 0.0
        return kg / max(air_kg_per_cbm, 1.0)
    return physical_cbm(pkg)


async def get_loyalty_config(db) -> dict:
    from app.features.marketplace.services import get_growth_settings
    settings = await get_growth_settings(db)
    return {
        "point_value_xaf": int(settings.get("point_value_xaf") or DEFAULT_LOYALTY["point_value_xaf"]),
        "air_kg_per_cbm": float(settings.get("air_kg_per_cbm") or DEFAULT_LOYALTY["air_kg_per_cbm"]),
        "loyalty_tiers": normalize_tiers(settings.get("loyalty_tiers")),
        "vip_benefits": settings.get("vip_benefits") or DEFAULT_LOYALTY["vip_benefits"],
        "award_on_statuses": settings.get("award_on_statuses") or DEFAULT_LOYALTY["award_on_statuses"],
    }


async def build_loyalty_summary(db, user: dict) -> dict:
    cfg = await get_loyalty_config(db)
    points = int((user or {}).get("loyalty_points", 0) or 0)
    total_cbm = float((user or {}).get("loyalty_cbm_total", 0) or 0)
    tiers = cfg["loyalty_tiers"]
    current = resolve_tier(total_cbm, tiers)
    nxt = next_tier(total_cbm, tiers)
    cbm_to_next = None
    if nxt:
        cbm_to_next = max(0.0, round(float(nxt["min_cbm"]) - total_cbm, 4))
    return {
        "program": "M.O.G CLUB",
        "points": points,
        "value_xaf": points * cfg["point_value_xaf"],
        "point_value_xaf": cfg["point_value_xaf"],
        "points_per_cbm": current["points_per_cbm"],
        "air_kg_per_cbm": cfg["air_kg_per_cbm"],
        "total_cbm": round(total_cbm, 4),
        "tier": {
            "id": current["id"],
            "name": current["name"],
            "emoji": current.get("emoji") or "",
            "min_cbm": current["min_cbm"],
            "points_per_cbm": current["points_per_cbm"],
        },
        "next_tier": (
            {
                "id": nxt["id"],
                "name": nxt["name"],
                "emoji": nxt.get("emoji") or "",
                "min_cbm": nxt["min_cbm"],
                "points_per_cbm": nxt["points_per_cbm"],
                "cbm_remaining": cbm_to_next,
            }
            if nxt
            else None
        ),
        "tiers": tiers,
        "vip_benefits": cfg["vip_benefits"],
        "rule": (
            f"1 CBM = {current['points_per_cbm']} pts ({current['name']}) · "
            f"1 pt = {cfg['point_value_xaf']} FCFA · crédit à l'expédition"
        ),
    }


async def award_loyalty_for_package(db, pkg: dict) -> dict:
    """
    Crédite les points M.O.G CLUB quand le colis est confirmé expédié.
    Idempotent via package.loyalty_awarded.
    """
    if not pkg or pkg.get("loyalty_awarded"):
        return {"awarded": False, "reason": "already_awarded_or_missing"}

    email = (
        pkg.get("owner_id")
        or pkg.get("user_email")
        or pkg.get("client_email")
    )
    if not email:
        # fallback client_id → user
        client_id = pkg.get("client_id") or pkg.get("user_id")
        if client_id:
            user = await db.users.find_one({"_id": client_id}) or await db.users.find_one({"id": client_id})
            if user:
                email = user.get("email")
    if not email:
        return {"awarded": False, "reason": "no_client"}

    cfg = await get_loyalty_config(db)
    statuses = set(cfg.get("award_on_statuses") or [])
    status = (pkg.get("status") or "").lower()
    # Allow award if status is in list OR caller already decided (status may be mid-update)
    if statuses and status and status not in statuses:
        # Still allow if we're awarding because logistics just set in_transit
        if status not in ("in_transit", "departed"):
            return {"awarded": False, "reason": f"status_{status}"}

    cbm = loyalty_cbm_for_package(pkg, cfg["air_kg_per_cbm"])
    if cbm <= 0:
        # mark to avoid retries on empty volume
        await db.packages.update_one(
            {"_id": pkg["_id"]},
            {"$set": {"loyalty_awarded": True, "loyalty_points_awarded": 0, "loyalty_cbm": 0}},
        )
        return {"awarded": False, "reason": "zero_cbm"}

    user = await db.users.find_one({"email": email})
    if not user:
        return {"awarded": False, "reason": "user_not_found"}

    total_before = float(user.get("loyalty_cbm_total", 0) or 0)
    tier = resolve_tier(total_before, cfg["loyalty_tiers"])
    rate = float(tier["points_per_cbm"])
    pts = int(round(cbm * rate))
    mode = (pkg.get("transport_mode") or "sea").lower()
    if pts <= 0 and mode in ("air", "air_express") and cbm > 0:
        pts = 1
    if pts <= 0:
        return {"awarded": False, "reason": "zero_points"}

    # Atomic guard against double award
    res = await db.packages.update_one(
        {"_id": pkg["_id"], "loyalty_awarded": {"$ne": True}},
        {
            "$set": {
                "loyalty_awarded": True,
                "loyalty_points_awarded": pts,
                "loyalty_cbm": round(cbm, 6),
                "loyalty_tier_at_award": tier["id"],
                "loyalty_awarded_at": datetime.utcnow().isoformat(),
            }
        },
    )
    if res.modified_count == 0:
        return {"awarded": False, "reason": "already_awarded"}

    await db.users.update_one(
        {"email": email},
        {
            "$inc": {
                "loyalty_points": pts,
                "loyalty_cbm_total": cbm,
            }
        },
    )

    return {
        "awarded": True,
        "points": pts,
        "cbm": round(cbm, 6),
        "tier": tier["id"],
        "points_per_cbm": rate,
        "email": email,
    }


async def award_loyalty_for_packages(db, packages: list[dict], force_status: Optional[str] = None) -> list[dict]:
    results = []
    for pkg in packages:
        if force_status:
            pkg = {**pkg, "status": force_status}
        results.append(await award_loyalty_for_package(db, pkg))
    return results
