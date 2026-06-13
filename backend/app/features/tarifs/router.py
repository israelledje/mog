from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_database
from app.core.deps import check_role, get_current_user
from datetime import datetime
import uuid

router = APIRouter(prefix="/tarifs", tags=["Tarifs"])

DEFAULT_TARIFS = [
    # Aérien
    {
        "_id": "air_standard",
        "mode": "air",
        "label": "Colis Standard",
        "description": "Colis ordinaires (vêtements, accessoires, etc.)",
        "unit": "kg",
        "price": 7500,
        "category_key": "standard",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    },
    {
        "_id": "air_sensitive",
        "mode": "air",
        "label": "Colis Sensibles / Téléphones",
        "description": "Téléphones, électronique, objets sensibles",
        "unit": "kg",
        "price": 10000,
        "category_key": "sensitive",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    },
    {
        "_id": "air_express",
        "mode": "air",
        "label": "Colis Express / Batterie",
        "description": "Colis express ou contenant des batteries",
        "unit": "kg",
        "price": 13000,
        "category_key": "express",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    },
    # Maritime
    {
        "_id": "sea_standard",
        "mode": "sea",
        "label": "Fret Maritime Standard",
        "description": "Colis standard par CBM",
        "unit": "cbm",
        "price": 340000,
        "category_key": "standard",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    },
    {
        "_id": "sea_heavy",
        "mode": "sea",
        "label": "Colis Lourds / Machines",
        "description": "Machines, matériaux lourds, équipements industriels",
        "unit": "cbm",
        "price": 385000,
        "category_key": "heavy",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    },
]

class TarifCreate(BaseModel):
    mode: str
    label: str
    description: str
    unit: str
    price: float
    category_key: str

class TarifUpdate(BaseModel):
    price: float
    label: Optional[str] = None
    description: Optional[str] = None


async def seed_tarifs(db):
    """Seed default tarifs if not already present."""
    count = await db.tarifs.count_documents({})
    if count == 0:
        for t in DEFAULT_TARIFS:
            await db.tarifs.insert_one(t.copy())


@router.get("/")
async def list_tarifs(db=Depends(get_database)):
    await seed_tarifs(db)
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
    db=Depends(get_database)
):
    tarif = data.model_dump()
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
    if data.price is not None:
        updates["price"] = data.price
    if data.label is not None:
        updates["label"] = data.label
    if data.description is not None:
        updates["description"] = data.description

    result = await db.tarifs.update_one({"_id": tarif_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tarif non trouvé")
    return {"message": "Tarif mis à jour"}


@router.get("/calculate")
async def calculate_price(
    transport_mode: str,
    weight_kg: float = 0,
    volume_cbm: float = 0,
    category_key: str = "standard",
    db=Depends(get_database),
):
    """Calculate estimated price for a shipment based on tariffs."""
    await seed_tarifs(db)
    tarif = await db.tarifs.find_one({"mode": transport_mode, "category_key": category_key})
    if not tarif:
        raise HTTPException(status_code=404, detail="Tarif introuvable pour cette combinaison")
        
    tarif["id"] = str(tarif["_id"])
    tarif.pop("_id", None)

    if transport_mode == "air":
        total = tarif["price"] * weight_kg
        unit_value = weight_kg
        unit_label = "kg"
    else:
        total = tarif["price"] * volume_cbm
        unit_value = volume_cbm
        unit_label = "CBM"

    return {
        "tarif": tarif,
        "unit_value": unit_value,
        "unit_label": unit_label,
        "total": total,
    }
