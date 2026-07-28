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

router = APIRouter(prefix="/payments", tags=["Payments"])

POINTS_PER_CBM = 100
POINT_VALUE_XAF = 20  # 1 point = 20 FCFA
# Facteur IATA : 1 CBM ≈ 167 kg (règle 6000 cm³/kg) — convertit le fret aérien en CBM équivalent
AIR_KG_PER_CBM = 167.0


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


def _physical_cbm(pkg: dict) -> float:
    """CBM physique depuis L×l×H (cm) ou volume_cbm stocké."""
    dims = pkg.get("dimensions") or {}
    l, w, h = float(dims.get("l") or 0), float(dims.get("w") or 0), float(dims.get("h") or 0)
    if l > 0 and w > 0 and h > 0:
        return (l * w * h) / 1_000_000
    return float(pkg.get("volume_cbm") or 0)


def _air_chargeable_kg(pkg: dict) -> float:
    """Poids taxable aérien = max(poids réel, poids volumétrique)."""
    real = float(pkg.get("weight_real") or 0)
    volumetric = float(pkg.get("weight_volumetric") or 0)
    # Si pas de poids volumétrique stocké, le dériver des dimensions (cm³ / 6000)
    if volumetric <= 0:
        dims = pkg.get("dimensions") or {}
        l, w, h = float(dims.get("l") or 0), float(dims.get("w") or 0), float(dims.get("h") or 0)
        if l > 0 and w > 0 and h > 0:
            volumetric = (l * w * h) / 6000.0
    return max(real, volumetric, 0.0)


def _loyalty_cbm_for_package(pkg: dict) -> float:
    """
    CBM servant au calcul fidélité :
    - Mer : CBM physique
    - Air / air_express : CBM équivalent = poids_taxable_kg / 167
    """
    mode = (pkg.get("transport_mode") or "sea").lower()
    if mode in ("air", "air_express"):
        kg = _air_chargeable_kg(pkg)
        if kg <= 0:
            return 0.0
        return kg / AIR_KG_PER_CBM
    return _physical_cbm(pkg)


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


async def _award_loyalty_for_cbm(db, email: str, volume_cbm: float, *, min_one_if_positive: bool = False):
    if volume_cbm <= 0:
        return 0
    pts = int(round(volume_cbm * POINTS_PER_CBM))
    # Micro-colis aérien : au moins 1 point dès qu'il y a un volume/poids taxable
    if pts <= 0 and min_one_if_positive and volume_cbm > 0:
        pts = 1
    if pts <= 0:
        return 0
    await db.users.update_one(
        {"email": email},
        {"$inc": {"loyalty_points": pts}},
        upsert=False,
    )
    return pts


@router.get("/loyalty")
async def get_loyalty(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    user = await db.users.find_one({"email": current_user["email"]})
    points = int(user.get("loyalty_points", 0) or 0) if user else 0
    return {
        "points": points,
        "value_xaf": points * POINT_VALUE_XAF,
        "points_per_cbm": POINTS_PER_CBM,
        "point_value_xaf": POINT_VALUE_XAF,
        "air_kg_per_cbm": AIR_KG_PER_CBM,
        "rule": "100 pts / CBM (mer) ou CBM équivalent aérien = poids taxable ÷ 167",
    }


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
    if pkg_id:
        pkg = await db.packages.find_one({"_id": pkg_id})
        await db.packages.update_one(
            {"_id": pkg_id},
            {"$set": {"payment_status": "paid", "updated_at": datetime.now()}},
        )
        # Fidélité : 100 pts / CBM (mer) ou CBM équivalent air (kg taxable ÷ 167)
        if pkg:
            cbm = _loyalty_cbm_for_package(pkg)
            mode = (pkg.get("transport_mode") or "sea").lower()
            pts = await _award_loyalty_for_cbm(
                db,
                payment["user_email"],
                cbm,
                min_one_if_positive=(mode in ("air", "air_express")),
            )
            return {
                "message": "Paiement validé",
                "loyalty_points_awarded": pts,
                "loyalty_cbm": round(cbm, 6),
                "loyalty_mode": mode,
            }

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
