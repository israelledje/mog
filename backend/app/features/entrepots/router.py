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


@router.post("/")
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

    now = datetime.now()
    now_iso = now.isoformat()

    # Build warehouse event
    warehouse_event = {
        "entrepot_id": data.entrepot_id,
        "entrepot_name": entrepot["name"],
        "city": entrepot["city"],
        "type": entrepot["type"],   # origin | destination
        "arrived_at": now_iso,
        "operator": current_user.get("email", "unknown"),
        "notes": data.notes,
    }

    update_fields: dict = {"updated_at": now}

    # If origin warehouse → this is the initial reception
    if entrepot["type"] == "origin":
        update_fields["origin_warehouse_entry"] = now_iso
        update_fields["current_entrepot_id"] = data.entrepot_id
        update_fields["current_entrepot_name"] = entrepot["name"]
        update_fields["status"] = "received"
    else:
        # Destination warehouse arrival
        update_fields["dest_warehouse_entry"] = now_iso
        update_fields["current_entrepot_id"] = data.entrepot_id
        update_fields["current_entrepot_name"] = entrepot["name"]
        update_fields["status"] = "arrived"

    await db.packages.update_one(
        {"_id": package_id},
        {
            "$set": update_fields,
            "$push": {
                "warehouse_history": warehouse_event,
                "timeline": {
                    "status": "received" if entrepot["type"] == "origin" else "arrived",
                    "label": f"Réceptionné à {entrepot['name']}",
                    "timestamp": now,
                    "location": entrepot["city"],
                    "operator": current_user.get("email"),
                },
            },
        },
    )

    return {"message": f"Colis réceptionné à {entrepot['name']}", "event": warehouse_event}


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
