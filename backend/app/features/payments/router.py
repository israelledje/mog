"""
Paiements mobile money (Orange Money / MoMo) via Intouch + virement bancaire.
Variables d'environnement :
  INTOUCH_BASE_URL, INTOUCH_AGENT_CODE, INTOUCH_LOGIN_API, INTOUCH_PASSWORD_API,
  INTOUCH_PARTNER_ID, BANK_TRANSFER_IBAN (affichage client)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timedelta
import uuid
import httpx
import os

from app.core.database import get_database
from app.core.deps import get_current_user, check_role
from app.features.payments.loyalty import (
    DEFAULT_LOYALTY,
    build_loyalty_summary,
)

router = APIRouter(prefix="/payments", tags=["Payments"])

POINT_VALUE_XAF = DEFAULT_LOYALTY["point_value_xaf"]
AIR_KG_PER_CBM = DEFAULT_LOYALTY["air_kg_per_cbm"]


class MobilePayRequest(BaseModel):
    package_id: Optional[str] = None
    invoice_id: Optional[str] = None
    amount: float
    phone: str
    method: Literal["om", "momo"]
    loyalty_points: int = 0


class BankPayRequest(BaseModel):
    package_id: Optional[str] = None
    invoice_id: Optional[str] = None
    amount: float
    reference: Optional[str] = None
    proof_url: Optional[str] = None
    loyalty_points: int = 0


class RedeemPointsRequest(BaseModel):
    points: int = Field(gt=0)


def _discount_from_points(points: int) -> float:
    return max(0, points) * POINT_VALUE_XAF


async def _discount_from_points_async(db, points: int) -> float:
    from app.features.payments.loyalty import get_loyalty_config
    cfg = await get_loyalty_config(db)
    return max(0, points) * int(cfg["point_value_xaf"])


async def _deduct_loyalty(db, email: str, points: int):
    if points <= 0:
        return
    user = await db.users.find_one({"email": email})
    balance = int(user.get("loyalty_points", 0) or 0) if user else 0
    if points > balance:
        raise HTTPException(status_code=400, detail="Points de fidélité insuffisants")
    await db.users.update_one(
        {"email": email},
        {"$inc": {"loyalty_points": -points}},
    )


@router.get("/loyalty")
async def get_loyalty(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    user = await db.users.find_one({"email": current_user["email"]})
    return await build_loyalty_summary(db, user or {})


@router.get("/bank-info")
async def bank_info():
    return {
        "iban": os.getenv("BANK_TRANSFER_IBAN", ""),
        "account_name": os.getenv("BANK_TRANSFER_NAME", "M.O.G GROUP MULTISERVICE SARL"),
        "bank_name": os.getenv("BANK_TRANSFER_BANK", ""),
        "verification_days": 3,
        "note": "Le virement est vérifié sous 3 jours ouvrés puis validé par un opérateur avant livraison.",
    }


@router.post("/mobile")
async def pay_mobile(
    data: MobilePayRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")

    discount = _discount_from_points(data.loyalty_points)
    amount_due = max(0, data.amount - discount)

    payment_id = str(uuid.uuid4())
    payment = {
        "_id": payment_id,
        "user_email": current_user["email"],
        "package_id": data.package_id,
        "invoice_id": data.invoice_id,
        "method": data.method,
        "phone": data.phone,
        "amount_original": data.amount,
        "loyalty_points": data.loyalty_points,
        "discount_xaf": discount,
        "amount": amount_due,
        "status": "pending",
        "provider": "intouch",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }

    # Appel Intouch si configuré
    base = os.getenv("INTOUCH_BASE_URL", "").rstrip("/")
    agent = os.getenv("INTOUCH_AGENT_CODE", "")
    login = os.getenv("INTOUCH_LOGIN_API", "")
    password = os.getenv("INTOUCH_PASSWORD_API", "")

    provider_ref = None
    if base and agent and login and password and amount_due > 0:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Endpoint générique Intouch — à adapter selon le contrat partenaire
                payload = {
                    "amount": int(amount_due),
                    "phone": data.phone,
                    "partner_transaction_id": payment_id,
                    "service_id": "OM" if data.method == "om" else "MOMO",
                    "agent_code": agent,
                    "login_api": login,
                    "password_api": password,
                }
                resp = await client.post(f"{base}/merchant/payment", json=payload)
                if resp.status_code >= 400:
                    payment["status"] = "failed"
                    payment["provider_error"] = resp.text[:500]
                else:
                    body = resp.json() if resp.content else {}
                    provider_ref = body.get("transaction_id") or body.get("id")
                    payment["provider_ref"] = provider_ref
                    payment["status"] = "processing"
        except Exception as e:
            payment["status"] = "failed"
            payment["provider_error"] = str(e)
    else:
        # Mode démo / sans credentials : simulation (à remplacer en prod)
        payment["status"] = "processing"
        payment["provider_ref"] = f"DEMO-{payment_id[:8]}"
        payment["demo"] = True

    if payment["status"] in ("processing", "pending") and data.loyalty_points:
        await _deduct_loyalty(db, current_user["email"], data.loyalty_points)

    await db.payments.insert_one(payment)

    if data.package_id and payment["status"] in ("processing", "pending"):
        await db.packages.update_one(
            {"_id": data.package_id},
            {
                "$set": {
                    "payment_status": "waiting_validation",
                    "payment_method": data.method,
                    "loyalty_points_used": data.loyalty_points,
                    "updated_at": datetime.now(),
                }
            },
        )

    payment["id"] = payment_id
    payment.pop("_id", None)
    return payment


@router.post("/bank")
async def pay_bank(
    data: BankPayRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Déclare un virement bancaire — validation opérateur sous ~3 jours."""
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")

    discount = _discount_from_points(data.loyalty_points)
    amount_due = max(0, data.amount - discount)

    if data.loyalty_points:
        await _deduct_loyalty(db, current_user["email"], data.loyalty_points)

    payment_id = str(uuid.uuid4())
    verify_after = (datetime.now() + timedelta(days=3)).isoformat()
    payment = {
        "_id": payment_id,
        "user_email": current_user["email"],
        "package_id": data.package_id,
        "invoice_id": data.invoice_id,
        "method": "bank",
        "amount_original": data.amount,
        "loyalty_points": data.loyalty_points,
        "discount_xaf": discount,
        "amount": amount_due,
        "reference": data.reference,
        "proof_url": data.proof_url,
        "status": "bank_pending",
        "verify_after": verify_after,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    await db.payments.insert_one(payment)

    if data.package_id:
        await db.packages.update_one(
            {"_id": data.package_id},
            {
                "$set": {
                    "payment_status": "bank_pending",
                    "payment_method": "bank",
                    "payment_proof_url": data.proof_url,
                    "loyalty_points_used": data.loyalty_points,
                    "updated_at": datetime.now(),
                }
            },
        )

    payment["id"] = payment_id
    payment.pop("_id", None)
    return {
        **payment,
        "message": "Virement enregistré. Vérification sous 3 jours ouvrés par un opérateur.",
    }


@router.post("/{payment_id}/confirm")
async def confirm_payment(
    payment_id: str,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    """Validation opérateur (après succès Intouch ou vérification virement)."""
    payment = await db.payments.find_one({"_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Paiement introuvable")

    await db.payments.update_one(
        {"_id": payment_id},
        {"$set": {"status": "paid", "validated_by": current_user["email"], "updated_at": datetime.now().isoformat()}},
    )

    pkg_id = payment.get("package_id")
    checkout_id = payment.get("marketplace_checkout_id")
    if checkout_id and not pkg_id:
        checkout = await db.marketplace_checkouts.find_one({"_id": checkout_id})
        if checkout:
            if checkout.get("promo_code") and checkout.get("status") != "confirmed":
                await db.promo_codes.update_one({"code": checkout["promo_code"]}, {"$inc": {"used_count": 1}})
            from app.features.marketplace.router import _finalize_checkout
            finalized = await _finalize_checkout(db, checkout, payment_status="paid")
            return {"message": "Paiement validé — commande marketplace créée", "finalized": finalized}

    if pkg_id:
        pkg = await db.packages.find_one({"_id": pkg_id})
        await db.packages.update_one(
            {"_id": pkg_id},
            {"$set": {"payment_status": "paid", "updated_at": datetime.now()}},
        )
        # Commission commercial si client parrainé (points M.O.G CLUB = à l'expédition)
        if pkg:
            try:
                from app.features.marketplace.services import record_commission
                await record_commission(
                    db,
                    client_email=payment["user_email"],
                    source="package_paid",
                    amount_xaf=float(pkg.get("total_price") or payment.get("amount") or 0),
                    reference_id=str(pkg_id),
                    label=f"Paiement colis {pkg.get('tracking_number')}",
                )
            except Exception:
                pass
            return {"message": "Paiement validé"}

    return {"message": "Paiement validé"}


@router.get("/pending-bank")
async def list_pending_bank(
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    items = []
    async for p in db.payments.find({"method": "bank", "status": "bank_pending"}).sort("created_at", -1):
        p["id"] = str(p["_id"])
        p.pop("_id", None)
        items.append(p)
    return items
