from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_database
from app.core.deps import check_role, get_current_user
from datetime import datetime
import uuid

router = APIRouter(prefix="/tarifs", tags=["Tarifs"])

# Grille officielle M.O.G — applicable à partir du 26 juillet 2026
DEFAULT_TARIFS = [
    # ── Aérien ──────────────────────────────────────────────
    {
        "_id": "air_express",
        "mode": "air",
        "label": "Colis Express (2–3 jours)",
        "description": "Livraison express aérienne 2–3 jours",
        "unit": "kg",
        "price": 13500,
        "category_key": "express",
        "eta_days": "2-3",
    },
    {
        "_id": "air_standard",
        "mode": "air",
        "label": "Colis Normaux (7–14 jours)",
        "description": "Colis ordinaires aériens 7–14 jours",
        "unit": "kg",
        "price": 9000,
        "category_key": "standard",
        "eta_days": "7-14",
    },
    {
        "_id": "air_phone_box",
        "mode": "air",
        "label": "Téléphones avec carton",
        "description": "10 000 FCFA/u — 7 000 FCFA/u à partir de 10 unités",
        "unit": "unit",
        "price": 10000,
        "price_bulk": 7000,
        "bulk_from": 10,
        "category_key": "phone_boxed",
        "eta_days": "7-14",
    },
    {
        "_id": "air_phone_nobox",
        "mode": "air",
        "label": "Téléphones sans carton",
        "description": "6 000 FCFA/u — 5 000 FCFA/u à partir de 10 unités",
        "unit": "unit",
        "price": 6000,
        "price_bulk": 5000,
        "bulk_from": 10,
        "category_key": "phone_unboxed",
        "eta_days": "7-14",
    },
    {
        "_id": "air_laptop",
        "mode": "air",
        "label": "Ordinateur (avec batterie)",
        "description": "Ordinateur portable / PC",
        "unit": "unit",
        "price": 30000,
        "category_key": "laptop",
        "eta_days": "7-14",
    },
    {
        "_id": "air_tablet_adult",
        "mode": "air",
        "label": "Tablette adulte",
        "description": "Sans carton et accessoires",
        "unit": "unit",
        "price": 10000,
        "category_key": "tablet_adult",
        "eta_days": "7-14",
    },
    {
        "_id": "air_tablet_child",
        "mode": "air",
        "label": "Tablette enfant",
        "description": "8 000 – 9 000 FCFA selon modèle",
        "unit": "unit",
        "price": 8000,
        "price_max": 9000,
        "category_key": "tablet_child",
        "eta_days": "7-14",
    },
    {
        "_id": "air_battery",
        "mode": "air",
        "label": "Colis avec batterie",
        "description": "Montres, machines/appareils, lunettes…",
        "unit": "kg",
        "price": 11000,
        "category_key": "battery",
        "eta_days": "7-14",
    },
    {
        "_id": "air_powerbank",
        "mode": "air",
        "label": "Powerbank",
        "description": "5 000 mAh → 5 000 FCFA · 10–20 000 mAh → 11 000 FCFA",
        "unit": "unit",
        "price": 5000,
        "price_high": 11000,
        "category_key": "powerbank",
        "eta_days": "7-14",
    },
    {
        "_id": "air_liquid",
        "mode": "air",
        "label": "Liquide / Poudre",
        "description": "Liquides et poudres",
        "unit": "kg",
        "price": 11000,
        "category_key": "liquid",
        "eta_days": "7-14",
    },
    # ── Maritime (à partir du 26/07/2026) ───────────────────
    {
        "_id": "sea_standard",
        "mode": "sea",
        "label": "Colis standard",
        "description": "Import Chine → Cameroun",
        "unit": "cbm",
        "price": 355000,
        "category_key": "standard",
    },
    {
        "_id": "sea_bales",
        "mode": "sea",
        "label": "Gros cartons (balles)",
        "description": "Balles / gros cartons",
        "unit": "cbm",
        "price": 400000,
        "category_key": "bales",
    },
    {
        "_id": "sea_bigball",
        "mode": "sea",
        "label": "Gros colis compressés (Big Ball)",
        "description": "Big Ball compressés",
        "unit": "cbm",
        "price": 415000,
        "category_key": "bigball",
    },
    {
        "_id": "sea_cosmetics",
        "mode": "sea",
        "label": "Produits cosmétiques",
        "description": "Cosmétiques",
        "unit": "cbm",
        "price": 360000,
        "category_key": "cosmetics",
    },
    {
        "_id": "sea_medical",
        "mode": "sea",
        "label": "Consommables médicaux",
        "description": "Matériel / consommables médicaux",
        "unit": "cbm",
        "price": 360000,
        "category_key": "medical",
    },
    {
        "_id": "sea_chemical",
        "mode": "sea",
        "label": "Semi-chimiques & industriels",
        "description": "Peintures et produits industriels",
        "unit": "cbm",
        "price": 370000,
        "category_key": "chemical",
    },
    {
        "_id": "sea_building",
        "mode": "sea",
        "label": "Carreaux, fer, tôles",
        "description": "Matériaux de construction (tarif à la tonne)",
        "unit": "tonne",
        "price": 380000,
        "category_key": "building",
    },
    {
        "_id": "sea_machines",
        "mode": "sea",
        "label": "Machines industrielles",
        "description": "370 000 – 400 000 FCFA / CBM selon machine",
        "unit": "cbm",
        "price": 370000,
        "price_max": 400000,
        "category_key": "machines",
    },
    {
        "_id": "sea_supplements",
        "mode": "sea",
        "label": "Compléments alimentaires & bien-être",
        "description": "Compléments et articles de bien-être",
        "unit": "cbm",
        "price": 370000,
        "category_key": "supplements",
    },
]

for _t in DEFAULT_TARIFS:
    _t.setdefault("created_at", datetime.now().isoformat())
    _t.setdefault("updated_at", datetime.now().isoformat())


class TarifCreate(BaseModel):
    mode: str
    label: str
    description: str
    unit: str
    price: float
    category_key: str
    price_bulk: Optional[float] = None
    bulk_from: Optional[int] = None
    price_max: Optional[float] = None
    price_high: Optional[float] = None
    eta_days: Optional[str] = None


class TarifUpdate(BaseModel):
    price: Optional[float] = None
    label: Optional[str] = None
    description: Optional[str] = None
    price_bulk: Optional[float] = None
    bulk_from: Optional[int] = None
    price_max: Optional[float] = None
    price_high: Optional[float] = None
    eta_days: Optional[str] = None


async def seed_tarifs(db, force_refresh: bool = False):
    """Upsert la grille officielle (par _id) pour appliquer les nouveaux tarifs."""
    for t in DEFAULT_TARIFS:
        doc = {k: v for k, v in t.items() if k != "_id"}
        doc["updated_at"] = datetime.now().isoformat()
        existing = await db.tarifs.find_one({"_id": t["_id"]})
        if not existing:
            await db.tarifs.insert_one({**t})
        elif force_refresh:
            await db.tarifs.update_one({"_id": t["_id"]}, {"$set": doc})


@router.post("/refresh-defaults")
async def refresh_default_tarifs(
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    """Force la mise à jour de la grille officielle (admin)."""
    await seed_tarifs(db, force_refresh=True)
    return {"message": "Grille tarifaire mise à jour", "count": len(DEFAULT_TARIFS)}


@router.get("/")
async def list_tarifs(db=Depends(get_database)):
    await seed_tarifs(db, force_refresh=True)
    tarifs = []
    async for t in db.tarifs.find():
        t["id"] = str(t["_id"])
        t.pop("_id", None)
        tarifs.append(t)
    return tarifs


@router.post("/")
async def create_tarif(
    data: TarifCreate,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    tarif = data.model_dump(exclude_none=True)
    tarif["_id"] = str(uuid.uuid4())
    tarif["created_at"] = datetime.now().isoformat()
    tarif["updated_at"] = datetime.now().isoformat()
    await db.tarifs.insert_one(tarif)
    tarif["id"] = tarif["_id"]
    return tarif


@router.patch("/{tarif_id}")
async def update_tarif(
    tarif_id: str,
    data: TarifUpdate,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    updates = {"updated_at": datetime.now().isoformat()}
    for k, v in data.model_dump(exclude_none=True).items():
        updates[k] = v

    result = await db.tarifs.update_one({"_id": tarif_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tarif non trouvé")
    return {"message": "Tarif mis à jour"}


@router.get("/calculate")
async def calculate_price(
    transport_mode: str,
    weight_kg: float = 0,
    volume_cbm: float = 0,
    quantity: float = 1,
    category_key: str = "standard",
    powerbank_tier: str = "low",  # low=5000mAh, high=10-20k
    db=Depends(get_database),
):
    """Calcule le prix estimé selon la grille M.O.G."""
    await seed_tarifs(db, force_refresh=True)

    aliases = {
        "normal": "standard",
        "machine": "battery" if transport_mode == "air" else "machines",
        "sensible": "phone_boxed",
        "sensitive": "phone_boxed",
        "lourd": "machines",
        "heavy": "machines",
        "phone": "phone_boxed",
    }
    category_key = aliases.get(category_key, category_key)

    tarif = await db.tarifs.find_one({"mode": transport_mode, "category_key": category_key})
    if not tarif:
        tarif = await db.tarifs.find_one({"mode": transport_mode, "category_key": "standard"})
    if not tarif:
        raise HTTPException(status_code=404, detail="Tarif introuvable pour cette combinaison")

    tarif["id"] = str(tarif["_id"])
    tarif.pop("_id", None)

    unit = tarif.get("unit", "kg")
    unit_price = float(tarif["price"])
    qty = max(quantity, 1)

    # Tarifs dégressifs téléphones
    bulk_from = tarif.get("bulk_from")
    price_bulk = tarif.get("price_bulk")
    if bulk_from and price_bulk and qty >= bulk_from:
        unit_price = float(price_bulk)

    # Powerbank tiers
    if category_key == "powerbank" and powerbank_tier == "high" and tarif.get("price_high"):
        unit_price = float(tarif["price_high"])

    if unit == "kg":
        unit_value = weight_kg
        unit_label = "kg"
        total = unit_price * weight_kg
    elif unit == "cbm":
        unit_value = volume_cbm
        unit_label = "CBM"
        total = unit_price * volume_cbm
    elif unit == "tonne":
        # Approximation : 1 CBM ≈ 1 tonne pour estimation ; l'opérateur affine
        unit_value = volume_cbm if volume_cbm > 0 else qty
        unit_label = "tonne"
        total = unit_price * unit_value
    else:  # unit
        unit_value = qty
        unit_label = "unité(s)"
        total = unit_price * qty

    return {
        "tarif": tarif,
        "unit_value": unit_value,
        "unit_label": unit_label,
        "unit_price": unit_price,
        "total": total,
        "note": "Écrire M.O.G, le nom, le numéro de téléphone et la ville de réception au Cameroun sur vos colis.",
    }
