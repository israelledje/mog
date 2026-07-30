from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
import uuid
import random

from app.core.database import get_database
from app.core.deps import get_current_user, check_role
from app.core.notification_service import NotificationService
from app.features.marketplace.schemas import (
    MarketplaceProductCreate,
    MarketplaceProductUpdate,
    MarketplacePurchase,
)
from app.features.marketplace.services import (
    validate_promo,
    normalize_code,
    record_commission,
    serialize_doc,
    get_growth_settings,
)

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


def _prepare_product(doc: dict) -> dict:
    d = serialize_doc(doc)
    d.pop("hashed_password", None)
    return d


@router.get("/settings")
async def public_marketplace_settings(db=Depends(get_database)):
    s = await get_growth_settings(db)
    return {
        "marketplace_enabled": bool(s.get("marketplace_enabled", True)),
    }


@router.get("/products")
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    db=Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    query: dict = {}
    role = current_user.get("role")
    if role == "client":
        query["status"] = "published"
        query["stock"] = {"$gt": 0}
    elif status:
        query["status"] = status
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    items = []
    async for doc in db.marketplace_products.find(query).sort("created_at", -1).limit(limit):
        items.append(_prepare_product(doc))
    return items


@router.get("/products/{product_id}")
async def get_product(product_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    doc = await db.marketplace_products.find_one({"_id": product_id})
    if not doc:
        raise HTTPException(404, "Article introuvable")
    if current_user.get("role") == "client" and doc.get("status") != "published":
        raise HTTPException(404, "Article introuvable")
    return _prepare_product(doc)


@router.post("/products")
async def create_product(
    data: MarketplaceProductCreate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    doc = data.model_dump()
    doc.update({
        "_id": str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by": current_user.get("email"),
        "sold_count": 0,
    })
    await db.marketplace_products.insert_one(doc)
    return _prepare_product(doc)


@router.patch("/products/{product_id}")
async def update_product(
    product_id: str,
    data: MarketplaceProductUpdate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat()
    result = await db.marketplace_products.update_one({"_id": product_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Article introuvable")
    doc = await db.marketplace_products.find_one({"_id": product_id})
    return _prepare_product(doc)


@router.delete("/products/{product_id}")
async def archive_product(
    product_id: str,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    result = await db.marketplace_products.update_one(
        {"_id": product_id},
        {"$set": {"status": "archived", "updated_at": datetime.utcnow().isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Article introuvable")
    return {"message": "Article archivé"}


@router.post("/purchase")
async def purchase_product(
    data: MarketplacePurchase,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Achat marketplace :
    - décrémente le stock
    - crée une commande
    - crée un colis lié (groupage / réception Cameroun)
    - applique promo + commission agent
    """
    settings = await get_growth_settings(db)
    if not settings.get("marketplace_enabled", True):
        raise HTTPException(400, "Marketplace désactivée")

    product = await db.marketplace_products.find_one({"_id": data.product_id})
    if not product or product.get("status") != "published":
        raise HTTPException(404, "Article indisponible")
    qty = max(1, int(data.quantity or 1))
    stock = int(product.get("stock") or 0)
    if stock < qty:
        raise HTTPException(400, "Stock insuffisant")

    unit = float(product.get("price_xaf") or 0)
    subtotal = unit * qty
    discount = 0.0
    promo_code = None
    if data.promo_code:
        check = await validate_promo(db, data.promo_code, subtotal, "marketplace")
        if not check.get("ok"):
            raise HTTPException(400, check.get("error") or "Code promo invalide")
        discount = float(check["discount"])
        promo_code = normalize_code(data.promo_code)
        await db.promo_codes.update_one({"code": promo_code}, {"$inc": {"used_count": 1}})

    total = max(0.0, subtotal - discount)
    order_id = str(uuid.uuid4())
    package_id = str(uuid.uuid4())
    tracking = f"MK-{random.randint(100000, 999999)}"

    order = {
        "_id": order_id,
        "product_id": data.product_id,
        "product_title": product.get("title"),
        "quantity": qty,
        "unit_price_xaf": unit,
        "subtotal_xaf": subtotal,
        "discount_xaf": discount,
        "promo_code": promo_code,
        "total_xaf": total,
        "owner_id": current_user["email"],
        "delivery_city": data.delivery_city or current_user.get("city") or "Douala",
        "notes": data.notes,
        "package_id": package_id,
        "tracking_number": tracking,
        "status": "ordered",  # ordered | in_groupage | in_transit | arrived | delivered
        "payment_status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.marketplace_orders.insert_one(order)

    package = {
        "_id": package_id,
        "tracking_number": tracking,
        "owner_id": current_user["email"],
        "status": "pending_reception",
        "description": f"Marketplace — {product.get('title')} x{qty}",
        "category": product.get("category") or "marketplace",
        "declared_value": total,
        "currency": "XAF",
        "transport_mode": product.get("transport_mode") or "sea",
        "delivery_address": data.delivery_city,
        "marketplace_order_id": order_id,
        "marketplace_product_id": data.product_id,
        "total_price": total,
        "payment_status": "pending",
        "promo_code": promo_code,
        "promo_discount_xaf": discount,
        "photos": list(product.get("images") or [])[:3],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "timeline": [
            {
                "status": "pending_reception",
                "label": "Commande marketplace enregistrée — en attente réception Chine",
                "timestamp": datetime.utcnow(),
                "location": product.get("origin_city") or "Guangzhou",
            }
        ],
    }
    await db.packages.insert_one(package)

    await db.marketplace_products.update_one(
        {"_id": data.product_id},
        {"$inc": {"stock": -qty, "sold_count": qty}, "$set": {"updated_at": datetime.utcnow().isoformat()}},
    )

    commission = await record_commission(
        db,
        client_email=current_user["email"],
        source="marketplace",
        amount_xaf=total,
        reference_id=order_id,
        label=f"Achat marketplace {product.get('title')}",
    )

    phone = current_user.get("phone")
    if not phone:
        u = await db.users.find_one({"email": current_user["email"]})
        phone = (u or {}).get("phone")
    if phone:
        await NotificationService.notify_phone(
            phone,
            f"MOG Marketplace : commande {tracking} confirmée ({product.get('title')} x{qty}). "
            f"Total {total:.0f} XAF. Suivi dans l'app — réception Cameroun après groupage.",
        )

    return {
        "order": serialize_doc(order),
        "package": {
            "id": package_id,
            "tracking_number": tracking,
            "status": "pending_reception",
            "total_price": total,
        },
        "commission": serialize_doc(commission) if commission else None,
        "message": "Achat enregistré — colis créé pour groupage",
    }


@router.get("/orders/mine")
async def my_orders(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    items = []
    async for doc in db.marketplace_orders.find({"owner_id": current_user["email"]}).sort("created_at", -1):
        items.append(serialize_doc(doc))
    return items


@router.get("/orders")
async def list_orders(
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
    limit: int = Query(100, le=500),
):
    items = []
    async for doc in db.marketplace_orders.find().sort("created_at", -1).limit(limit):
        items.append(serialize_doc(doc))
    return items
