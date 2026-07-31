from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
import uuid

from app.core.database import get_database
from app.core.deps import get_current_user, check_role
from app.features.marketplace.schemas import (
    PromoCodeCreate,
    PromoCodeUpdate,
    PromoValidateRequest,
    SalesAgentCreate,
    SalesAgentUpdate,
    GrowthSettingsUpdate,
)
from app.features.marketplace.services import (
    normalize_code,
    generate_code,
    validate_promo,
    get_growth_settings,
    serialize_doc,
    record_commission,
)

router = APIRouter(prefix="/growth", tags=["Growth"])


# ── Settings ──────────────────────────────────────────────
@router.get("/settings")
async def get_settings(current_user: dict = Depends(check_role(["admin", "operator"])), db=Depends(get_database)):
    return await get_growth_settings(db)


@router.patch("/settings")
async def update_settings(
    data: GrowthSettingsUpdate,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat()
    await db.growth_settings.update_one({"_id": "global"}, {"$set": updates}, upsert=True)
    return await get_growth_settings(db)


# ── Promo codes ───────────────────────────────────────────
@router.get("/promos")
async def list_promos(
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    items = []
    async for doc in db.promo_codes.find().sort("created_at", -1):
        items.append(serialize_doc(doc))
    return items


@router.post("/promos")
async def create_promo(
    data: PromoCodeCreate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    code = normalize_code(data.code)
    if not code:
        raise HTTPException(400, "Code invalide")
    existing = await db.promo_codes.find_one({"code": code})
    if existing:
        raise HTTPException(400, "Ce code existe déjà")
    doc = data.model_dump()
    doc["code"] = code
    doc["_id"] = str(uuid.uuid4())
    doc["used_count"] = 0
    doc["created_at"] = datetime.utcnow().isoformat()
    doc["created_by"] = current_user.get("email")
    await db.promo_codes.insert_one(doc)
    await db.promo_code_history.insert_one({
        "_id": str(uuid.uuid4()),
        "promo_id": doc["_id"],
        "code": code,
        "action": "created",
        "snapshot": {k: v for k, v in doc.items() if k != "_id"},
        "by": current_user.get("email"),
        "at": datetime.utcnow().isoformat(),
    })
    return serialize_doc(doc)


@router.patch("/promos/{promo_id}")
async def update_promo(
    promo_id: str,
    data: PromoCodeUpdate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat()
    updates["updated_by"] = current_user.get("email")
    result = await db.promo_codes.update_one({"_id": promo_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Promo introuvable")
    doc = await db.promo_codes.find_one({"_id": promo_id})
    await db.promo_code_history.insert_one({
        "_id": str(uuid.uuid4()),
        "promo_id": promo_id,
        "code": doc.get("code"),
        "action": "updated",
        "changes": updates,
        "snapshot": serialize_doc(doc),
        "by": current_user.get("email"),
        "at": datetime.utcnow().isoformat(),
    })
    return serialize_doc(doc)


@router.get("/promos/{promo_id}/history")
async def promo_history(
    promo_id: str,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    items = []
    async for doc in db.promo_code_history.find({"promo_id": promo_id}).sort("at", -1):
        items.append(serialize_doc(doc))
    return items


@router.post("/promos/validate")
async def validate_promo_endpoint(
    data: PromoValidateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    result = await validate_promo(db, data.code, data.amount_xaf, data.context)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error") or "Code invalide")
    promo = result["promo"]
    return {
        "valid": True,
        "code": promo.get("code"),
        "discount_xaf": result["discount"],
        "discount_type": promo.get("discount_type"),
        "discount_value": promo.get("discount_value"),
        "label": promo.get("label"),
    }


# ── Sales agents / referral ───────────────────────────────
@router.get("/agents")
async def list_agents(
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    """Liste M.O.G PARTNERS avec stats clients / CBM / commandes / commissions."""
    items = []
    async for doc in db.sales_agents.find().sort("created_at", -1):
        agent = serialize_doc(doc)
        agent_id = agent.get("id") or doc.get("_id")
        clients = []
        async for u in db.users.find({"referred_by_agent_id": agent_id}):
            clients.append(u)
        client_emails = [c.get("email") for c in clients if c.get("email")]
        orders_count = 0
        total_cbm = 0.0
        if client_emails:
            async for pkg in db.packages.find({"owner_id": {"$in": client_emails}}):
                orders_count += 1
                if pkg.get("loyalty_cbm"):
                    total_cbm += float(pkg.get("loyalty_cbm") or 0)
                elif pkg.get("loyalty_awarded"):
                    from app.features.payments.loyalty import loyalty_cbm_for_package
                    total_cbm += loyalty_cbm_for_package(pkg)

        pending_comm = 0.0
        paid_comm = 0.0
        async for c in db.commissions.find({"agent_id": agent_id}):
            amt = float(c.get("commission_xaf") or 0)
            if c.get("status") == "paid":
                paid_comm += amt
            else:
                pending_comm += amt

        agent["stats"] = {
            "clients_count": len(clients),
            "orders_count": orders_count,
            "total_cbm": round(total_cbm, 4),
            "pending_commission_xaf": round(pending_comm, 0),
            "paid_commission_xaf": round(paid_comm, 0),
        }
        items.append(agent)
    return items


@router.post("/agents")
async def create_agent(
    data: SalesAgentCreate,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    email = data.email.lower().strip()
    existing = await db.sales_agents.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Commercial déjà enregistré")
    code = normalize_code(data.referral_code) if data.referral_code else generate_code("AG", 6)
    if await db.sales_agents.find_one({"referral_code": code}):
        raise HTTPException(400, "Code de parrainage déjà utilisé")
    doc = {
        "_id": str(uuid.uuid4()),
        "full_name": data.full_name,
        "email": email,
        "phone": data.phone,
        "referral_code": code,
        "commission_rate_percent": data.commission_rate_percent,
        "active": data.active,
        "stats": {"orders_count": 0, "pending_commission_xaf": 0, "paid_commission_xaf": 0},
        "created_at": datetime.utcnow().isoformat(),
        "created_by": current_user.get("email"),
    }
    await db.sales_agents.insert_one(doc)
    return serialize_doc(doc)


@router.patch("/agents/{agent_id}")
async def update_agent(
    agent_id: str,
    data: SalesAgentUpdate,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "referral_code" in updates:
        updates["referral_code"] = normalize_code(updates["referral_code"])
    updates["updated_at"] = datetime.utcnow().isoformat()
    result = await db.sales_agents.update_one({"_id": agent_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Commercial introuvable")
    return serialize_doc(await db.sales_agents.find_one({"_id": agent_id}))


@router.get("/referral/me")
async def my_referral_info(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    user = await db.users.find_one({"email": current_user["email"]})
    agent = None
    if user and user.get("referred_by_agent_id"):
        agent = await db.sales_agents.find_one({"_id": user["referred_by_agent_id"]})
    return {
        "client_code": (user or {}).get("client_code"),
        "referred_by_type": (user or {}).get("referred_by_type"),
        "referred_by_agent_code": (user or {}).get("referred_by_agent_code"),
        "referred_by_client_code": (user or {}).get("referred_by_client_code"),
        "can_attach": not bool((user or {}).get("referred_by_agent_id")),
        "agent": serialize_doc(agent) if agent else None,
    }


@router.post("/referral/attach")
async def attach_referral_code(
    payload: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Permet à un client déjà inscrit d'ajouter un code commercial (une seule fois)."""
    from app.features.marketplace.services import resolve_referrer, get_growth_settings

    code = (payload or {}).get("referral_code") or ""
    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    if user.get("referred_by_agent_id"):
        raise HTTPException(400, "Un commercial est déjà lié à ce compte")

    ref = await resolve_referrer(db, code)
    if ref.get("referral_invalid") or not ref.get("referred_by_agent_id"):
        raise HTTPException(400, "Code commercial invalide")

    updates = {k: v for k, v in ref.items() if k != "referral_invalid"}
    updates["referral_attached_at"] = datetime.utcnow().isoformat()
    await db.users.update_one({"email": current_user["email"]}, {"$set": updates})

    growth = await get_growth_settings(db)
    bonus = int(growth.get("referral_signup_bonus_points") or 0)
    if bonus > 0:
        await db.users.update_one({"email": current_user["email"]}, {"$inc": {"loyalty_points": bonus}})

    agent = await db.sales_agents.find_one({"_id": ref["referred_by_agent_id"]})
    return {
        "message": "Code commercial enregistré",
        "referred_by_agent_code": ref.get("referred_by_agent_code"),
        "loyalty_bonus": bonus,
        "agent": serialize_doc(agent) if agent else None,
    }


# ── Commissions ───────────────────────────────────────────
@router.get("/commissions")
async def list_commissions(
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
    limit: int = Query(200, le=1000),
):
    query: dict = {}
    if agent_id:
        query["agent_id"] = agent_id
    if status:
        query["status"] = status
    items = []
    async for doc in db.commissions.find(query).sort("created_at", -1).limit(limit):
        items.append(serialize_doc(doc))
    return items


@router.post("/commissions/{commission_id}/validate")
async def validate_commission(
    commission_id: str,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    doc = await db.commissions.find_one({"_id": commission_id})
    if not doc:
        raise HTTPException(404, "Commission introuvable")
    if doc.get("status") != "pending":
        raise HTTPException(400, "Déjà traitée")
    await db.commissions.update_one(
        {"_id": commission_id},
        {"$set": {"status": "validated", "validated_at": datetime.utcnow().isoformat(), "validated_by": current_user.get("email")}},
    )
    return {"message": "Commission validée"}


@router.post("/commissions/{commission_id}/pay")
async def pay_commission(
    commission_id: str,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    doc = await db.commissions.find_one({"_id": commission_id})
    if not doc:
        raise HTTPException(404, "Commission introuvable")
    if doc.get("status") == "paid":
        raise HTTPException(400, "Déjà payée")
    amount = float(doc.get("commission_xaf") or 0)
    await db.commissions.update_one(
        {"_id": commission_id},
        {"$set": {"status": "paid", "paid_at": datetime.utcnow().isoformat(), "paid_by": current_user.get("email")}},
    )
    await db.sales_agents.update_one(
        {"_id": doc["agent_id"]},
        {
            "$inc": {
                "stats.pending_commission_xaf": -amount if doc.get("status") == "pending" else 0,
                "stats.paid_commission_xaf": amount,
            }
        },
    )
    return {"message": "Commission marquée payée"}


@router.post("/commissions/from-package/{package_id}")
async def commission_from_paid_package(
    package_id: str,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    """Déclenche une commission quand un colis / groupage est payé."""
    pkg = await db.packages.find_one({"_id": package_id})
    if not pkg:
        raise HTTPException(404, "Colis introuvable")
    amount = float(pkg.get("total_price") or 0)
    source = "marketplace" if pkg.get("marketplace_order_id") else "package_paid"
    existing = await db.commissions.find_one({"reference_id": package_id, "source": source})
    if existing:
        return serialize_doc(existing)
    commission = await record_commission(
        db,
        client_email=pkg.get("owner_id"),
        source=source,
        amount_xaf=amount,
        reference_id=package_id,
        label=f"Paiement colis {pkg.get('tracking_number')}",
    )
    return serialize_doc(commission) if commission else {"message": "Aucune commission (client non parrainé)"}
