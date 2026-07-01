from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_database
from app.core.deps import check_role, get_current_user
from datetime import datetime
import uuid

router = APIRouter(prefix="/entrepots", tags=["Entrepôts"])


class EntrepotCreate(BaseModel):
    name: str              # Ex: "Entrepôt MOG Guangzhou A"
    city: str              # Ex: "Guangzhou"
    country: str           # Ex: "Chine"
    type: str = "origin"   # "origin" | "destination"
    address: Optional[str] = None
    contact: Optional[str] = None


class EntrepotUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact: Optional[str] = None


@router.get("/")
async def list_entrepots(db=Depends(get_database)):
    result = []
    async for e in db.entrepots.find().sort("city", 1):
        e["id"] = e["_id"]
        result.append(e)
    return result


@router.post("")
@router.post("/", include_in_schema=False)
async def create_entrepot(
    data: EntrepotCreate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    doc = data.model_dump()
    doc.update({
        "_id": str(uuid.uuid4()),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    })
    await db.entrepots.insert_one(doc)
    doc["id"] = doc["_id"]
    return doc


@router.patch("/{entrepot_id}")
async def update_entrepot(
    entrepot_id: str,
    data: EntrepotUpdate,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now().isoformat()
    result = await db.entrepots.update_one({"_id": entrepot_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entrepôt non trouvé")
    return {"message": "Entrepôt mis à jour"}


@router.delete("/{entrepot_id}")
async def delete_entrepot(
    entrepot_id: str,
    current_user: dict = Depends(check_role(["admin"])),
    db=Depends(get_database),
):
    result = await db.entrepots.delete_one({"_id": entrepot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entrepôt non trouvé")
    return {"message": "Entrepôt supprimé"}


# ── Reception at warehouse (origin OR destination) ──
class WarehouseReceipt(BaseModel):
    entrepot_id: str
    notes: Optional[str] = None


@router.post("/receive-package/{package_id}")
async def receive_at_warehouse(
    package_id: str,
    data: WarehouseReceipt,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    """Register a package arrival at a specific warehouse (origin or destination)."""
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")

    entrepot = await db.entrepots.find_one({"_id": data.entrepot_id})
    if not entrepot:
        raise HTTPException(status_code=404, detail="Entrepôt non trouvé")

    from app.core.warehouse_service import apply_entrepot_to_package
    warehouse_event = await apply_entrepot_to_package(
        db,
        package_id,
        data.entrepot_id,
        current_user.get("email", "unknown"),
        notes=data.notes,
    )

    return {"message": f"Colis réceptionné à {warehouse_event['entrepot_name']}", "event": warehouse_event}


class TransferReceipt(BaseModel):
    to_entrepot_id: str
    notes: Optional[str] = None


@router.post("/transfer-package/{package_id}")
async def transfer_package(
    package_id: str,
    data: TransferReceipt,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    """Transfer a package to another warehouse (inter-warehouse move)."""
    from app.core.warehouse_service import apply_entrepot_to_package

    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")

    warehouse_event = await apply_entrepot_to_package(
        db,
        package_id,
        data.to_entrepot_id,
        current_user.get("email", "unknown"),
        notes=data.notes or "Transfert inter-entrepôt",
    )

    return {"message": f"Colis transféré vers {warehouse_event['entrepot_name']}", "event": warehouse_event}


@router.get("/package/{package_id}/history")
async def get_warehouse_history(
    package_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Get warehouse history and dwell times for a package."""
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")

    history = package.get("warehouse_history", [])
    now = datetime.now()

    enriched = []
    for i, event in enumerate(history):
        arrived = datetime.fromisoformat(event["arrived_at"])
        # Dwell = until next event or now if last
        if i + 1 < len(history):
            next_event = datetime.fromisoformat(history[i + 1]["arrived_at"])
            dwell_days = (next_event - arrived).days
        else:
            dwell_days = (now - arrived).days

        enriched.append({**event, "dwell_days": dwell_days})

    return {"package_id": package_id, "history": enriched}
