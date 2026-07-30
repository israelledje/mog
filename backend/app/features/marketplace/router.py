from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from typing import Optional, List
from datetime import datetime
import os
import uuid
import random

from app.core.database import get_database
from app.core.deps import get_current_user, check_role
from app.core.notification_service import NotificationService
from app.core.paths import UPLOAD_DIR, public_upload_url
from app.features.marketplace.schemas import (
    MarketplaceProductCreate,
    MarketplaceProductUpdate,
    MarketplacePurchase,
    MarketplaceCheckoutPay,
    StockAdjust,
    ProductReviewCreate,
)
from app.features.marketplace.services import (
    validate_promo,
    normalize_code,
    record_commission,
    serialize_doc,
    get_growth_settings,
)

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


def _normalize_variants(variants: Optional[list]) -> list:
    out = []
    for v in variants or []:
        item = v.model_dump() if hasattr(v, "model_dump") else dict(v)
        if not item.get("id"):
            item["id"] = str(uuid.uuid4())
        item["name"] = (item.get("name") or "").strip()
        if not item["name"]:
            continue
        item["stock"] = int(item.get("stock") or 0)
        if item.get("price_xaf") is not None:
            item["price_xaf"] = float(item["price_xaf"])
        out.append(item)
    return out


def _stock_from_doc(doc: dict) -> int:
    variants = doc.get("variants") or []
    if variants:
        return sum(int(v.get("stock") or 0) for v in variants)
    return int(doc.get("stock") or 0)


def _compute_cbm(length_cm, width_cm, height_cm, cbm=None) -> Optional[float]:
    if cbm is not None and float(cbm) > 0:
        return round(float(cbm), 6)
    try:
        l, w, h = float(length_cm or 0), float(width_cm or 0), float(height_cm or 0)
        if l > 0 and w > 0 and h > 0:
            return round((l * w * h) / 1_000_000.0, 6)
    except Exception:
        pass
    return None


def _dims_label(doc: dict) -> str:
    parts = []
    l, w, h = doc.get("length_cm"), doc.get("width_cm"), doc.get("height_cm")
    if l and w and h:
        parts.append(f"{l}×{w}×{h} cm")
    cbm = doc.get("cbm")
    if cbm:
        parts.append(f"{cbm} CBM")
    return " · ".join(parts)


def _prepare_product(doc: dict) -> dict:
    d = serialize_doc(doc)
    d.pop("hashed_password", None)
    d["stock"] = _stock_from_doc(d)
    d.setdefault("variants", [])
    d.setdefault("images", [])
    if not d.get("cbm"):
        computed = _compute_cbm(d.get("length_cm"), d.get("width_cm"), d.get("height_cm"))
        if computed:
            d["cbm"] = computed
    d["dimensions_label"] = _dims_label(d)
    d.setdefault("rating_avg", 0)
    d.setdefault("rating_count", 0)
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
        prepared = _prepare_product(doc)
        if role == "client" and int(prepared.get("stock") or 0) <= 0:
            continue
        items.append(prepared)
    return items


@router.get("/products/{product_id}")
async def get_product(product_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    doc = await db.marketplace_products.find_one({"_id": product_id})
    if not doc:
        raise HTTPException(404, "Article introuvable")
    if current_user.get("role") == "client" and doc.get("status") != "published":
        raise HTTPException(404, "Article introuvable")
    return _prepare_product(doc)


@router.get("/products/{product_id}/reviews")
async def list_reviews(product_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    items = []
    async for doc in db.marketplace_reviews.find({"product_id": product_id}).sort("created_at", -1).limit(50):
        items.append(serialize_doc(doc))
    return items


@router.post("/products/{product_id}/reviews")
async def create_review(
    product_id: str,
    data: ProductReviewCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    product = await db.marketplace_products.find_one({"_id": product_id})
    if not product or product.get("status") != "published":
        raise HTTPException(404, "Article introuvable")
    existing = await db.marketplace_reviews.find_one({
        "product_id": product_id,
        "user_email": current_user["email"],
    })
    now = datetime.utcnow().isoformat()
    if existing:
        await db.marketplace_reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": {"rating": data.rating, "comment": (data.comment or "").strip(), "updated_at": now}},
        )
        review_id = existing["_id"]
    else:
        review_id = str(uuid.uuid4())
        await db.marketplace_reviews.insert_one({
            "_id": review_id,
            "product_id": product_id,
            "user_email": current_user["email"],
            "user_name": current_user.get("full_name") or current_user["email"].split("@")[0],
            "rating": data.rating,
            "comment": (data.comment or "").strip(),
            "created_at": now,
        })

    # Recalcule moyenne
    total_rating = 0
    count = 0
    async for r in db.marketplace_reviews.find({"product_id": product_id}):
        total_rating += int(r.get("rating") or 0)
        count += 1
    avg = round(total_rating / count, 1) if count else float(data.rating)
    await db.marketplace_products.update_one(
        {"_id": product_id},
        {"$set": {"rating_avg": avg, "rating_count": count, "updated_at": now}},
    )
    doc = await db.marketplace_reviews.find_one({"_id": review_id})
    return {"review": serialize_doc(doc), "rating_avg": avg, "rating_count": count}


@router.post("/products/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(check_role(["admin", "operator"])),
):
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(400, "Fichier image requis")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    os.makedirs(os.path.join(UPLOAD_DIR, "marketplace"), exist_ok=True)
    filename = f"marketplace/{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image trop lourde (max 8 Mo)")
    with open(path, "wb") as f:
        f.write(data)
    return {"url": public_upload_url(filename)}


@router.post("/products")
async def create_product(
    data: MarketplaceProductCreate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    doc = data.model_dump()
    variants = _normalize_variants(doc.get("variants"))
    doc["variants"] = variants
    if variants:
        doc["stock"] = sum(int(v.get("stock") or 0) for v in variants)
    doc["cbm"] = _compute_cbm(doc.get("length_cm"), doc.get("width_cm"), doc.get("height_cm"), doc.get("cbm"))
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
    if "variants" in updates:
        variants = _normalize_variants(updates["variants"])
        updates["variants"] = variants
        updates["stock"] = sum(int(v.get("stock") or 0) for v in variants)
    if any(k in updates for k in ("length_cm", "width_cm", "height_cm", "cbm")):
        existing = await db.marketplace_products.find_one({"_id": product_id}) or {}
        updates["cbm"] = _compute_cbm(
            updates.get("length_cm", existing.get("length_cm")),
            updates.get("width_cm", existing.get("width_cm")),
            updates.get("height_cm", existing.get("height_cm")),
            updates.get("cbm", existing.get("cbm")),
        )
    updates["updated_at"] = datetime.utcnow().isoformat()
    result = await db.marketplace_products.update_one({"_id": product_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Article introuvable")
    doc = await db.marketplace_products.find_one({"_id": product_id})
    return _prepare_product(doc)


@router.patch("/products/{product_id}/stock")
async def adjust_stock(
    product_id: str,
    data: StockAdjust,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    doc = await db.marketplace_products.find_one({"_id": product_id})
    if not doc:
        raise HTTPException(404, "Article introuvable")
    variants = list(doc.get("variants") or [])
    if data.variant_id:
        found = False
        for v in variants:
            if v.get("id") == data.variant_id:
                if data.stock is not None:
                    v["stock"] = max(0, int(data.stock))
                elif data.delta is not None:
                    v["stock"] = max(0, int(v.get("stock") or 0) + int(data.delta))
                found = True
                break
        if not found:
            raise HTTPException(404, "Variante introuvable")
        stock = sum(int(v.get("stock") or 0) for v in variants)
        await db.marketplace_products.update_one(
            {"_id": product_id},
            {"$set": {"variants": variants, "stock": stock, "updated_at": datetime.utcnow().isoformat()}},
        )
    else:
        current = int(doc.get("stock") or 0)
        if data.stock is not None:
            stock = max(0, int(data.stock))
        elif data.delta is not None:
            stock = max(0, current + int(data.delta))
        else:
            raise HTTPException(400, "stock ou delta requis")
        await db.marketplace_products.update_one(
            {"_id": product_id},
            {"$set": {"stock": stock, "updated_at": datetime.utcnow().isoformat()}},
        )
    return _prepare_product(await db.marketplace_products.find_one({"_id": product_id}))


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


async def _finalize_checkout(db, checkout: dict, payment_status: str = "paid") -> dict:
    """Crée commande + colis après validation paiement. Idempotent."""
    if checkout.get("order_id") and checkout.get("package_id"):
        order = await db.marketplace_orders.find_one({"_id": checkout["order_id"]})
        return {
            "order": serialize_doc(order) if order else None,
            "package": {"id": checkout["package_id"], "tracking_number": checkout.get("tracking_number")},
            "already_finalized": True,
        }

    product = await db.marketplace_products.find_one({"_id": checkout["product_id"]})
    if not product:
        raise HTTPException(400, "Article introuvable pour finaliser")

    qty = int(checkout.get("quantity") or 1)
    variants = list(product.get("variants") or [])
    variant = None
    if checkout.get("variant_id"):
        variant = next((v for v in variants if v.get("id") == checkout["variant_id"]), None)
        if not variant or int(variant.get("stock") or 0) < qty:
            raise HTTPException(400, "Stock insuffisant")
    elif int(product.get("stock") or 0) < qty:
        raise HTTPException(400, "Stock insuffisant")

    order_id = str(uuid.uuid4())
    package_id = str(uuid.uuid4())
    tracking = checkout.get("tracking_number") or f"MK-{random.randint(100000, 999999)}"
    title_label = checkout.get("product_title") or product.get("title")
    total = float(checkout.get("total_xaf") or 0)
    images = list(product.get("images") or [])
    dims = _dims_label({
        "length_cm": product.get("length_cm"),
        "width_cm": product.get("width_cm"),
        "height_cm": product.get("height_cm"),
        "cbm": product.get("cbm") or _compute_cbm(product.get("length_cm"), product.get("width_cm"), product.get("height_cm")),
    })
    desc = f"Marketplace — {title_label} x{qty}"
    if dims:
        desc = f"{desc} ({dims})"

    order = {
        "_id": order_id,
        "checkout_id": checkout["_id"],
        "product_id": checkout["product_id"],
        "variant_id": checkout.get("variant_id"),
        "variant_name": checkout.get("variant_name"),
        "product_title": title_label,
        "quantity": qty,
        "unit_price_xaf": checkout.get("unit_price_xaf"),
        "subtotal_xaf": checkout.get("subtotal_xaf"),
        "discount_xaf": checkout.get("discount_xaf") or 0,
        "promo_code": checkout.get("promo_code"),
        "total_xaf": total,
        "owner_id": checkout["owner_id"],
        "delivery_city": checkout.get("delivery_city") or "Douala",
        "notes": checkout.get("notes"),
        "package_id": package_id,
        "tracking_number": tracking,
        "status": "ordered",
        "payment_status": payment_status,
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.marketplace_orders.insert_one(order)

    package = {
        "_id": package_id,
        "tracking_number": tracking,
        "owner_id": checkout["owner_id"],
        "status": "pending_reception",
        "description": desc,
        "category": product.get("category") or "marketplace",
        "declared_value": total,
        "currency": "XAF",
        "transport_mode": product.get("transport_mode") or "sea",
        "delivery_address": checkout.get("delivery_city"),
        "marketplace_order_id": order_id,
        "marketplace_checkout_id": checkout["_id"],
        "marketplace_product_id": checkout["product_id"],
        "marketplace_variant_id": checkout.get("variant_id"),
        "length_cm": product.get("length_cm"),
        "width_cm": product.get("width_cm"),
        "height_cm": product.get("height_cm"),
        "cbm": product.get("cbm") or _compute_cbm(product.get("length_cm"), product.get("width_cm"), product.get("height_cm")),
        "total_price": total,
        "payment_status": payment_status,
        "promo_code": checkout.get("promo_code"),
        "promo_discount_xaf": checkout.get("discount_xaf") or 0,
        "photos": images[:5],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "timeline": [
            {
                "status": "pending_reception",
                "label": "Commande marketplace confirmée — en attente réception Chine",
                "timestamp": datetime.utcnow(),
                "location": product.get("origin_city") or "Guangzhou",
            }
        ],
    }
    await db.packages.insert_one(package)

    if variant:
        for v in variants:
            if v.get("id") == variant.get("id"):
                v["stock"] = max(0, int(v.get("stock") or 0) - qty)
                break
        await db.marketplace_products.update_one(
            {"_id": checkout["product_id"]},
            {
                "$set": {
                    "variants": variants,
                    "stock": sum(int(v.get("stock") or 0) for v in variants),
                    "updated_at": datetime.utcnow().isoformat(),
                },
                "$inc": {"sold_count": qty},
            },
        )
    else:
        await db.marketplace_products.update_one(
            {"_id": checkout["product_id"]},
            {"$inc": {"stock": -qty, "sold_count": qty}, "$set": {"updated_at": datetime.utcnow().isoformat()}},
        )

    await db.marketplace_checkouts.update_one(
        {"_id": checkout["_id"]},
        {
            "$set": {
                "status": "confirmed",
                "payment_status": payment_status,
                "order_id": order_id,
                "package_id": package_id,
                "tracking_number": tracking,
                "confirmed_at": datetime.utcnow().isoformat(),
            }
        },
    )

    await record_commission(
        db,
        client_email=checkout["owner_id"],
        source="marketplace",
        amount_xaf=total,
        reference_id=order_id,
        label=f"Achat marketplace {title_label}",
    )

    user = await db.users.find_one({"email": checkout["owner_id"]})
    phone = (user or {}).get("phone")
    if phone:
        await NotificationService.notify_phone(
            phone,
            f"MOG Marketplace : commande {tracking} confirmée ({title_label} x{qty}). "
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
        "message": "Commande confirmée — colis créé",
    }


@router.post("/checkout")
async def create_checkout(
    data: MarketplacePurchase,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Prépare un checkout — la commande/colis ne sont créés qu'après paiement validé."""
    settings = await get_growth_settings(db)
    if not settings.get("marketplace_enabled", True):
        raise HTTPException(400, "Marketplace désactivée")

    product = await db.marketplace_products.find_one({"_id": data.product_id})
    if not product or product.get("status") != "published":
        raise HTTPException(404, "Article indisponible")
    qty = max(1, int(data.quantity or 1))
    variants = list(product.get("variants") or [])
    variant = None
    if variants:
        if not data.variant_id:
            raise HTTPException(400, "Choisissez une variante")
        variant = next((v for v in variants if v.get("id") == data.variant_id), None)
        if not variant:
            raise HTTPException(404, "Variante introuvable")
        if int(variant.get("stock") or 0) < qty:
            raise HTTPException(400, "Stock insuffisant pour cette variante")
        unit = float(variant.get("price_xaf") if variant.get("price_xaf") is not None else product.get("price_xaf") or 0)
    else:
        if int(product.get("stock") or 0) < qty:
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

    total = max(0.0, subtotal - discount)
    title_label = product.get("title")
    if variant:
        title_label = f"{title_label} — {variant.get('name')}"

    checkout_id = str(uuid.uuid4())
    tracking = f"MK-{random.randint(100000, 999999)}"
    checkout = {
        "_id": checkout_id,
        "product_id": data.product_id,
        "variant_id": variant.get("id") if variant else None,
        "variant_name": variant.get("name") if variant else None,
        "product_title": title_label,
        "product_image": (product.get("images") or [None])[0],
        "quantity": qty,
        "unit_price_xaf": unit,
        "subtotal_xaf": subtotal,
        "discount_xaf": discount,
        "promo_code": promo_code,
        "total_xaf": total,
        "owner_id": current_user["email"],
        "delivery_city": data.delivery_city or current_user.get("city") or "Douala",
        "notes": data.notes,
        "tracking_number": tracking,
        "status": "awaiting_payment",
        "payment_status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.marketplace_checkouts.insert_one(checkout)

    phone = current_user.get("phone")
    if not phone:
        u = await db.users.find_one({"email": current_user["email"]})
        phone = (u or {}).get("phone")
    if phone:
        await NotificationService.notify_phone(
            phone,
            f"MOG Marketplace : checkout {tracking} prêt ({title_label} x{qty}). "
            f"Montant {total:.0f} XAF — payez dans l'app (Mobile Money ou virement).",
        )

    return serialize_doc(checkout)


@router.get("/checkout/{checkout_id}")
async def get_checkout(checkout_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    doc = await db.marketplace_checkouts.find_one({"_id": checkout_id})
    if not doc:
        raise HTTPException(404, "Checkout introuvable")
    if current_user.get("role") == "client" and doc.get("owner_id") != current_user["email"]:
        raise HTTPException(403, "Accès refusé")
    return serialize_doc(doc)


@router.post("/checkout/{checkout_id}/pay")
async def pay_checkout(
    checkout_id: str,
    data: MarketplaceCheckoutPay,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    checkout = await db.marketplace_checkouts.find_one({"_id": checkout_id})
    if not checkout:
        raise HTTPException(404, "Checkout introuvable")
    if checkout.get("owner_id") != current_user["email"] and current_user.get("role") == "client":
        raise HTTPException(403, "Accès refusé")
    if checkout.get("status") in ("confirmed", "cancelled"):
        raise HTTPException(400, "Checkout déjà traité")

    method = (data.method or "").lower()
    if method not in ("om", "momo", "bank"):
        raise HTTPException(400, "Méthode invalide")
    if method in ("om", "momo") and not (data.phone or "").strip():
        raise HTTPException(400, "Numéro de téléphone requis")
    if method == "bank" and not (data.reference or "").strip():
        raise HTTPException(400, "Référence de virement requise")

    amount = float(checkout.get("total_xaf") or 0)
    payment_id = str(uuid.uuid4())
    payment = {
        "_id": payment_id,
        "user_email": current_user["email"],
        "marketplace_checkout_id": checkout_id,
        "method": method,
        "phone": data.phone,
        "reference": data.reference,
        "amount": amount,
        "amount_original": amount,
        "status": "bank_pending" if method == "bank" else "processing",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    if method != "bank":
        payment["provider_ref"] = f"DEMO-{payment_id[:8]}"
        payment["demo"] = True

    await db.payments.insert_one(payment)

    pay_status = "bank_pending" if method == "bank" else "waiting_validation"
    await db.marketplace_checkouts.update_one(
        {"_id": checkout_id},
        {
            "$set": {
                "status": "payment_submitted",
                "payment_status": pay_status,
                "payment_id": payment_id,
                "payment_method": method,
                "payment_reference": data.reference,
                "updated_at": datetime.utcnow().isoformat(),
            }
        },
    )

    # Mobile Money en mode démo : auto-finalise pour fluidité (prod = confirm opérateur/webhook)
    auto_confirm = method in ("om", "momo") and payment.get("demo")
    result = {"payment": serialize_doc(payment), "checkout_id": checkout_id}
    if auto_confirm:
        if checkout.get("promo_code"):
            await db.promo_codes.update_one({"code": checkout["promo_code"]}, {"$inc": {"used_count": 1}})
        finalized = await _finalize_checkout(db, {**checkout, "payment_id": payment_id}, payment_status="paid")
        await db.payments.update_one({"_id": payment_id}, {"$set": {"status": "paid"}})
        result["finalized"] = finalized
        result["message"] = "Paiement accepté — commande créée"
    else:
        phone = current_user.get("phone")
        if not phone:
            u = await db.users.find_one({"email": current_user["email"]})
            phone = (u or {}).get("phone")
        if phone:
            await NotificationService.notify_phone(
                phone,
                f"MOG : virement {data.reference} reçu pour {checkout.get('tracking_number')}. "
                f"Validation opérateur sous 3 jours ouvrés avant création de la commande.",
            )
        result["message"] = "Virement enregistré — en attente validation opérateur"

    return result


@router.post("/checkout/{checkout_id}/confirm")
async def confirm_checkout(
    checkout_id: str,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    checkout = await db.marketplace_checkouts.find_one({"_id": checkout_id})
    if not checkout:
        raise HTTPException(404, "Checkout introuvable")
    if checkout.get("promo_code") and checkout.get("status") != "confirmed":
        await db.promo_codes.update_one({"code": checkout["promo_code"]}, {"$inc": {"used_count": 1}})
    if checkout.get("payment_id"):
        await db.payments.update_one(
            {"_id": checkout["payment_id"]},
            {"$set": {"status": "paid", "validated_by": current_user.get("email"), "updated_at": datetime.utcnow().isoformat()}},
        )
    return await _finalize_checkout(db, checkout, payment_status="paid")


@router.get("/checkouts/pending")
async def list_pending_checkouts(
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    items = []
    async for doc in db.marketplace_checkouts.find(
        {"status": {"$in": ["payment_submitted", "awaiting_payment"]}, "payment_status": {"$in": ["bank_pending", "waiting_validation", "pending"]}}
    ).sort("created_at", -1):
        items.append(serialize_doc(doc))
    return items


@router.post("/purchase")
async def purchase_product(
    data: MarketplacePurchase,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Compat : crée un checkout (paiement requis avant commande)."""
    return await create_checkout(data, current_user, db)


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
