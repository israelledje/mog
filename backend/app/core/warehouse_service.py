from datetime import datetime
from fastapi import HTTPException

# Statuts autorisés pour réception à l'origine (Chine) — sans transit
ORIGIN_RECEIVE_STATUSES = {
    "draft",
    "pending_reception",
    "received",
}

# Statuts autorisés pour réception destination (Cameroun) — après transit
DEST_RECEIVE_STATUSES = {
    "in_transit",
    "departed",
    "customs",
    "arrived",
    "distributed",
}

TRANSIT_TIMELINE_STATUSES = {
    "in_transit",
    "departed",
    "closed",
    "customs",
}


def _has_been_in_transit(package: dict) -> bool:
    """True si le colis a déjà eu une étape d'expédition / transit."""
    status = package.get("status")
    if status in DEST_RECEIVE_STATUSES | {"closed", "loaded"}:
        # loaded/closed alone aren't enough for destination arrival
        pass
    if status in {"in_transit", "departed", "customs", "arrived", "distributed", "delivered"}:
        return True
    for step in package.get("timeline") or []:
        if (step or {}).get("status") in TRANSIT_TIMELINE_STATUSES:
            return True
    return False


def assert_can_receive_at_entrepot(package: dict, entrepot: dict):
    """
    Règles métier :
    - Origine : réception d'office possible (pending / draft / already received).
    - Destination : uniquement si le colis a été (ou est) en transit / douane.
    - Mode transport : colis aérien → entrepôt aérien, maritime → maritime.
    """
    assert_entrepot_transport_match(package, entrepot)
    etype = entrepot.get("type") or "origin"
    status = package.get("status") or ""

    if etype == "origin":
        if status not in ORIGIN_RECEIVE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Réception origine impossible pour le statut « {status} ». "
                    f"Autorisés : {', '.join(sorted(ORIGIN_RECEIVE_STATUSES))}."
                ),
            )
        return

    # destination
    if not _has_been_in_transit(package):
        raise HTTPException(
            status_code=400,
            detail=(
                "Impossible de réceptionner à destination : ce colis n'a pas encore "
                "été mis en transit / expédition. Passez d'abord le groupage en transit."
            ),
        )
    if status not in DEST_RECEIVE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Réception destination impossible pour le statut « {status} ». "
                f"Attendus : transit, douane, arrivé ou distribué."
            ),
        )


def assert_entrepot_transport_match(package: dict, entrepot: dict):
    """Un colis aérien va à l'entrepôt aérien ; maritime → entrepôt maritime."""
    pkg_mode = (package.get("transport_mode") or "sea").lower()
    wh_mode = (entrepot.get("transport_mode") or "sea").lower()
    pkg_air = pkg_mode in ("air", "air_express")
    wh_air = wh_mode in ("air", "air_express")
    if pkg_air and not wh_air:
        raise HTTPException(
            status_code=400,
            detail="Colis aérien : réceptionnez-le à l'entrepôt aérien (pas maritime).",
        )
    if not pkg_air and wh_air:
        raise HTTPException(
            status_code=400,
            detail="Colis maritime : réceptionnez-le à l'entrepôt maritime (pas aérien).",
        )


async def apply_entrepot_to_package(
    db,
    package_id: str,
    entrepot_id: str,
    operator_email: str,
    notes: str | None = None,
    *,
    is_transfer: bool = False,
):
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")

    entrepot = await db.entrepots.find_one({"_id": entrepot_id})
    if not entrepot:
        raise HTTPException(status_code=404, detail="Entrepôt non trouvé")

    if not is_transfer:
        assert_can_receive_at_entrepot(package, entrepot)
    else:
        # Transfert vers destination : même règle anti « arrivée magique »
        if (entrepot.get("type") or "") == "destination" and not _has_been_in_transit(package):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Transfert vers un entrepôt destination refusé : le colis "
                    "n'a pas encore été en transit."
                ),
            )

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

    package.update(update_fields)
    return {
        **warehouse_event,
        "package": package,
        "new_status": update_fields.get("status", package.get("status")),
        "timeline_status": timeline_status,
    }
