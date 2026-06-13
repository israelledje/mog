from typing import List
from app.core.database import get_database
from app.core.deps import check_role, get_current_user
from app.core.pdf_service import generate_manifest_pdf, generate_client_packing_list_pdf
from app.core.notification_service import NotificationService
from .schemas import ContainerCreate, ContainerInDB, ContainerUpdate
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/groupages", tags=["Groupages"])

@router.get("/next/info")
async def get_next_info(db = Depends(get_database)):
    # Simuler les prochaines dates de départ
    return {
        "sea": {
            "departure_date": (datetime.now() + timedelta(days=5)).isoformat(),
            "estimated_arrival": (datetime.now() + timedelta(days=35)).isoformat(),
            "origin_port": "Guangzhou",
            "destination_port": "Douala"
        },
        "air": {
            "departure_date": (datetime.now() + timedelta(days=2)).isoformat(),
            "estimated_arrival": (datetime.now() + timedelta(days=7)).isoformat(),
            "origin_port": "Guangzhou",
            "destination_port": "Douala"
        }
    }

@router.post("/", response_model=ContainerInDB)
async def create_container(
    container_in: ContainerCreate, 
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    container_dict = container_in.model_dump()
    container_dict.update({
        "_id": str(uuid.uuid4()),
        "status": "open",
        "packages_ids": [],
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    })
    
    await db.containers.insert_one(container_dict)
    container_dict["id"] = container_dict["_id"]
    return container_dict

@router.get("/", response_model=List[ContainerInDB])
async def list_containers(
    db = Depends(get_database)
):
    cursor = db.containers.find().sort("created_at", -1)
    containers = []
    async for doc in cursor:
        doc["id"] = doc["_id"]
        # Compatibilité : si mode est absent mais transport_mode existe
        if "mode" not in doc and "transport_mode" in doc:
            doc["mode"] = doc["transport_mode"]
        containers.append(doc)
    return containers

@router.get("/my-packing-lists", response_model=List[ContainerInDB])
async def get_my_packing_lists(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # Trouver tous les colis du client
    cursor = db.packages.find({"owner_id": current_user["email"], "container_id": {"$exists": True, "$ne": None}})
    container_ids = set()
    async for pkg in cursor:
        container_ids.add(pkg["container_id"])
        
    if not container_ids:
        return []
        
    # Retourner les conteneurs correspondants
    cursor = db.containers.find({"_id": {"$in": list(container_ids)}}).sort("created_at", -1)
    containers = []
    async for doc in cursor:
        doc["id"] = doc["_id"]
        if "mode" not in doc and "transport_mode" in doc:
            doc["mode"] = doc["transport_mode"]
        containers.append(doc)
    return containers

@router.post("/{container_id}/add-package/{package_id}")
async def add_package_to_container(
    container_id: str,
    package_id: str,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    # 1. Vérifier le conteneur
    container = await db.containers.find_one({"_id": container_id})
    if not container:
        raise HTTPException(status_code=404, detail="Conteneur non trouvé")
    
    if container["status"] != "open":
        raise HTTPException(status_code=400, detail="Ce conteneur n'est plus ouvert au chargement")

    # 2. Vérifier le colis
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")

    # 3. Ajouter le colis au conteneur et mettre à jour le statut du colis
    await db.containers.update_one(
        {"_id": container_id},
        {"$addToSet": {"packages_ids": package_id}}
    )
    
    await db.packages.update_one(
        {"_id": package_id},
        {
            "$set": {"status": "loaded", "container_id": container_id},
            "$push": {
                "timeline": {
                    "status": "loaded",
                    "label": f"Chargé dans le conteneur {container.get('container_number', '')}",
                    "timestamp": datetime.now(),
                    "location": container.get("origin_city", "Guangzhou")
                }
            }
        }
    )
    
    return {"message": "Colis ajouté avec succès au conteneur"}

@router.get("/{container_id}/manifest")
async def get_container_manifest(
    container_id: str,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    # 1. Récupérer le conteneur
    container = await db.containers.find_one({"_id": container_id})
    if not container:
        raise HTTPException(status_code=404, detail="Conteneur non trouvé")
        
    # 2. Récupérer tous les colis associés
    cursor = db.packages.find({"_id": {"$in": container["packages_ids"]}})
    packages = []
    async for pkg in cursor:
        packages.append(pkg)
        
    # 3. Générer le PDF
    pdf_buffer = generate_manifest_pdf(container, packages)
    
    filename = f"Manifeste_{container['container_number']}.pdf"
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.get("/{container_id}/packing-list")
async def get_client_packing_list(
    container_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # 1. Récupérer le conteneur
    container = await db.containers.find_one({"_id": container_id})
    if not container:
        raise HTTPException(status_code=404, detail="Conteneur non trouvé")
        
    # 2. Récupérer uniquement les colis du client dans ce conteneur
    cursor = db.packages.find({
        "_id": {"$in": container.get("packages_ids", [])},
        "owner_id": current_user["email"]
    })
    
    packages = []
    async for pkg in cursor:
        packages.append(pkg)
        
    if not packages:
        raise HTTPException(status_code=403, detail="Vous n'avez aucun colis dans ce groupage")
        
    # 3. Récupérer l'utilisateur
    customer = await db.users.find_one({"email": current_user["email"]})
    if not customer:
        customer = {"full_name": current_user["email"], "phone": ""}
        
    # 4. Générer le PDF
    pdf_buffer = generate_client_packing_list_pdf(container, packages, customer)
    
    filename = f"PackingList_{container.get('container_number', 'N/A')}.pdf"
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.patch("/{container_id}/status")
async def update_container_status(
    container_id: str,
    status_update: ContainerUpdate,
    current_user: dict = Depends(check_role(["admin"])),
    db = Depends(get_database)
):
    # 1. Vérifier le conteneur
    container = await db.containers.find_one({"_id": container_id})
    if not container:
        raise HTTPException(status_code=404, detail="Conteneur non trouvé")
        
    # 2. Mettre à jour le conteneur
    await db.containers.update_one(
        {"_id": container_id},
        {
            "$set": {
                "status": status_update.status,
                "updated_at": datetime.now()
            }
        }
    )
    
    new_status = status_update.status
    label_map = {
        "closed": "Groupage terminé, prêt pour expédition",
        "in_transit": "Expédition en cours (Mer/Air)",
        "arrived": "Arrivé à l'entrepôt de destination",
        "distributed": "Colis prêt pour retrait"
    }
    
    label = label_map.get(new_status, f"Mise à jour logistique : {new_status}")
    
    eta = None
    if new_status == "in_transit":
        settings_doc = await db.settings.find_one({"_id": "global"}) or {}
        mode = container.get("mode", "sea")
        if mode == "air":
            delay = settings_doc.get("air_delay_days", 7)
        elif mode == "air_express":
            delay = settings_doc.get("air_express_delay_days", 3)
        else:
            delay = settings_doc.get("sea_delay_days", 45)
        eta = datetime.now() + timedelta(days=delay)

    # Prepare package update
    package_update = {"status": new_status, "updated_at": datetime.now()}
    if eta:
        package_update["estimated_arrival"] = eta.isoformat()
        
    await db.containers.update_one(
        {"_id": container_id},
        {"$set": package_update}
    )

    # Mettre à jour tous les colis liés
    await db.packages.update_many(
        {"_id": {"$in": container["packages_ids"]}},
        {
            "$set": package_update,
            "$push": {
                "timeline": {
                    "status": new_status,
                    "label": label,
                    "timestamp": datetime.now(),
                    "location": container.get("origin_city", "Guangzhou") if new_status == "closed" else ("En transit" if new_status == "in_transit" else container.get("destination_city", "Douala")),
                    "operator": current_user.get("email")
                }
            }
        }
    )
    
    # 4. NOTIFICATIONS AUTOMATIQUES
    cursor = db.packages.find({"_id": {"$in": container["packages_ids"]}})
    client_emails = set()
    async for pkg in cursor:
        client_emails.add(pkg.get("owner_id"))
        await NotificationService.notify_status_change(pkg, new_status)
        
    # 5. NOTIFICATION SPECIALE PACKING LIST
    if new_status == "closed":
        for email in client_emails:
            if not email:
                continue
            user = await db.users.find_one({"email": email})
            if user:
                msg = f"Votre Packing List pour le conteneur {container.get('container_number')} est désormais disponible dans l'application (section Mes Documents)."
                
                if user.get("phone"):
                    await NotificationService.send_whatsapp(user["phone"], msg)
                if user.get("push_token"):
                    await NotificationService.send_push(user["push_token"], "Packing List Disponible", msg)
    
    return {"message": f"Conteneur et {len(container['packages_ids'])} colis mis à jour avec succès"}
@router.patch("/{container_id}")
async def update_container(
    container_id: str,
    container_update: dict, # On accepte n'importe quel champ pour la flexibilité admin
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    # Retirer l'ID si présent dans le body
    container_update.pop("id", None)
    container_update.pop("_id", None)
    
    container_update["updated_at"] = datetime.now()
    
    result = await db.containers.update_one(
        {"_id": container_id},
        {"$set": container_update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Groupage non trouvé")
        
    return {"message": "Groupage mis à jour"}


