from datetime import datetime
from fastapi import HTTPException


async def apply_entrepot_to_package(
    db,
    package_id: str,
    entrepot_id: str,
    operator_email: str,
    notes: str | None = None,
):
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")

    entrepot = await db.entrepots.find_one({"_id": entrepot_id})
    if not entrepot:
        raise HTTPException(status_code=404, detail="Entrepôt non trouvé")

    now = datetime.now()
    now_iso = now.isoformat()

    warehouse_event = {
        "entrepot_id": entrepot_id,
        "entrepot_name": entrepot["name"],
        "city": entrepot["city"],
        "type": entrepot["type"],
        "arrived_at": now_iso,
        "operator": operator_email,
        "notes": notes,
    }

    update_fields: dict = {
        "updated_at": now,
        "current_entrepot_id": entrepot_id,
        "current_entrepot_name": entrepot["name"],
        "warehouse_location": entrepot.get("name"),
    }

    timeline_status = "received"
    timeline_label = f"Réceptionné à {entrepot['name']}"

    if entrepot["type"] == "origin":
        update_fields["origin_warehouse_entry"] = now_iso
        if package.get("status") in ("pending_reception", "draft"):
            update_fields["status"] = "received"
    else:
        update_fields["dest_warehouse_entry"] = now_iso
        timeline_status = "arrived"
        timeline_label = f"Arrivé à {entrepot['name']}"
        update_fields["status"] = "arrived"

    await db.packages.update_one(
        {"_id": package_id},
        {
            "$set": update_fields,
            "$push": {
                "warehouse_history": warehouse_event,
                "timeline": {
                    "status": timeline_status,
                    "label": timeline_label,
                    "timestamp": now,
                    "location": entrepot["city"],
                    "operator": operator_email,
                },
            },
        },
    )

    return warehouse_event
