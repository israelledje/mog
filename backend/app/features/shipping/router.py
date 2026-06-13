from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query, Response
from app.features.shipping.schemas import PackageCreate, PackageInDB, PackageUpdate, PackageReceive, InvoiceUpdate
from app.core.database import get_database
from app.core.utils import apply_watermark
from app.core.pdf_service import generate_invoice_pdf
from app.core.notification_service import NotificationService
from app.core.config import settings
from typing import List, Optional
import shutil
import os
from app.core.deps import get_current_user, check_role
from datetime import datetime
import uuid
import random

router = APIRouter(prefix="/colis", tags=["Colis"])

def generate_tracking_number(city: str, user_id: str):
    # Génère un numéro type CL-[VILLE]-[USER_ID]-[RANDOM]
    city_code = city[:3].upper() if city else "UNK"
    user_short = str(user_id)[-4:].upper() if user_id else "0000"
    rand = random.randint(1000, 9999)
    return f"CL-{city_code}-{user_short}-{rand}"

@router.get("/kpi")
async def get_kpi(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # Format attendu par Expo: { pending: 0, warehouse: 0, transit: 0, delivered: 0 }
    query = {}
    if current_user.get("role") == "client":
        query["owner_id"] = current_user["email"]
    
    pending = await db.packages.count_documents({**query, "status": {"$in": ["draft", "pending_reception"]}})
    warehouse = await db.packages.count_documents({**query, "status": {"$in": ["received", "loaded", "closed"]}})
    transit = await db.packages.count_documents({**query, "status": {"$in": ["departed", "in_transit", "arrived", "distributed"]}})
    delivered = await db.packages.count_documents({**query, "status": "delivered"})
    
    return {
        "pending": pending,
        "warehouse": warehouse,
        "transit": transit,
        "delivered": delivered
    }

@router.get("/users/search")
async def search_users(
    q: str = Query(..., min_length=2),
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    query = {
        "$or": [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ],
        "role": "client"
    }
    cursor = db.users.find(query, {"password": 0, "hashed_password": 0}).limit(10)
    users = []
    async for u in cursor:
        u["id"] = str(u["_id"])
        del u["_id"]
        users.append(u)
    return users

@router.get("/", response_model=List[PackageInDB])
async def list_packages(
    skip: int = 0,
    limit: int = Query(default=200, le=1000),
    status: Optional[str] = None,
    tracking_number: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # Construire la requête de filtrage
    query = {}
    
    # 🔐 Sécurité : Filtrage par rôle
    if current_user.get("role") == "client":
        query["owner_id"] = current_user["email"]
        
    if status:
        query["status"] = status
    if tracking_number:
        query["tracking_number"] = {"$regex": tracking_number, "$options": "i"} 
        
    cursor = db.packages.find(query).sort("created_at", -1).skip(skip).limit(limit)
    
    packages = []
    async for doc in cursor:
        doc["id"] = doc["_id"]
        packages.append(doc)
        
    return packages

@router.post("/", response_model=PackageInDB)
async def create_colis(
    package_in: PackageCreate, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # 🔐 Staff peut créer pour un client, sinon c'est le client lui-même
    owner_id = current_user["email"]
    if current_user.get("role") in ["admin", "operator"] and package_in.owner_id:
        owner_id = package_in.owner_id
        
    # Récupérer les infos du client pour le format de la Shipping Mark
    user = await db.users.find_one({"email": owner_id})
    city = user.get("city", "UNK") if user else "UNK"
    user_identifier = str(user.get("_id", "0000")) if user else "0000"
    
    tracking_number = package_in.tracking_number or generate_tracking_number(city, user_identifier)
    
    package_dict = package_in.model_dump()
    package_dict.pop("tracking_number", None)
    package_dict.update({
        "_id": str(uuid.uuid4()),
        "tracking_number": tracking_number,
        "owner_id": owner_id, 
        "status": "pending_reception",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "timeline": [
            {
                "status": "pending_reception",
                "label": "En attente de réception",
                "timestamp": datetime.now(),
                "location": ""
            }
        ],
        "photos": package_dict.get("photos", [])
    })
    
    await db.packages.insert_one(package_dict)
    
    package_dict["id"] = package_dict["_id"]
    return package_dict

@router.post("/{package_id}/photos")
async def upload_package_photo(
    package_id: str, 
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # 1. Vérifier si le colis existe
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")
    
    # 2. Vérifier les permissions
    is_owner = package.get("owner_id") == current_user["email"]
    is_staff = current_user.get("role") in ["admin", "operator"]
    
    if not (is_owner or is_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Vous n'avez pas l'autorisation d'ajouter des photos à ce colis"
        )
    
    # 3. Préparer le chemin du fichier
    file_extension = os.path.splitext(file.filename)[1]
    file_name = f"{package_id}_{uuid.uuid4()}{file_extension}"
    upload_dir = "uploads"
    file_path = os.path.join(upload_dir, file_name)
    
    # 3. Sauvegarder le fichier localement
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 4. Appliquer le Watermark
    try:
        apply_watermark(file_path, package["tracking_number"])
    except Exception as e:
        # On continue même si le watermark échoue, mais on log l'erreur
        print(f"Erreur Watermark: {e}")
    
    # 5. Mettre à jour le colis en base
    photo_url = f"/uploads/{file_name}" # Chemin relatif pour l'API
    await db.packages.update_one(
        {"_id": package_id},
        {"$push": {"photos": photo_url}}
    )
    
    return {"url": photo_url, "message": "Photo ajoutée avec succès"}

@router.get("/{package_id}", response_model=PackageInDB)
async def get_package_detail(
    package_id: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")
    
    # 🔐 Sécurité : Vérifier les permissions
    is_owner = package.get("owner_id") == current_user["email"]
    is_staff = current_user.get("role") in ["admin", "operator"]
    
    if not (is_owner or is_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Vous n'avez pas accès à ce colis"
        )
    
    package["id"] = package["_id"]
    return package

@router.patch("/{package_id}/status")
async def update_package_status(
    package_id: str,
    status_update: PackageUpdate, # On réutilise le schéma existant ou on en crée un dédié
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")
    
    if not status_update.status:
        raise HTTPException(status_code=400, detail="Statut requis")

    new_timeline_entry = {
        "status": status_update.status,
        "label": f"Statut mis à jour : {status_update.status}",
        "timestamp": datetime.now(),
        "location": status_update.location or "En transit"
    }
    
    await db.packages.update_one(
        {"_id": package_id},
        {
            "$set": {
                "status": status_update.status,
                "updated_at": datetime.now()
            },
            "$push": {"timeline": new_timeline_entry}
        }
    )
    
    return {"message": "Statut mis à jour avec succès", "new_status": status_update.status}

@router.post("/{package_id}/receive")
async def receive_package(
    package_id: str,
    receive_data: PackageReceive,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")
        
    # 🛡️ Vérification stricte des 3 photos obligatoires (Epic 3)
    if len(package.get("photos", [])) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Audit incomplet : au moins 3 photos sont requises avant la réception du colis."
        )
    
    # Calculer le poids volumétrique
    dims = receive_data.dimensions
    weight_volumetric = (dims.get("l", 0) * dims.get("w", 0) * dims.get("h", 0)) / 6000 # Formule standard Air
    
    final_status = receive_data.status if receive_data.status else "received"
    
    new_timeline_entry = {
        "status": final_status,
        "label": "Colis réceptionné" if final_status == "received" else "Colis signalé endommagé / anomalie",
        "timestamp": datetime.now(),
        "location": "Entrepôt Foshan (MOG)"
    }
    
    await db.packages.update_one(
        {"_id": package_id},
        {
            "$set": {
                "status": final_status,
                "weight_real": receive_data.weight_real,
                "weight_volumetric": weight_volumetric,
                "dimensions": dims,
                "nature": receive_data.nature or package.get("nature"),
                "warehouse_location": receive_data.warehouse_location,
                "updated_at": datetime.now()
            },
            "$push": {"timeline": new_timeline_entry}
        }
    )
    
    # 🔔 Notifier le client (Simulé)
    # NotificationService.send_push(package["owner_id"], "Colis reçu à l'entrepôt !")
    
    return {"message": "Colis audité avec succès", "status": final_status}

@router.post("/{package_id}/payment-proof")
async def upload_payment_proof(
    package_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")
    
    # Seul le proprio peut uploader une preuve
    if package.get("owner_id") != current_user["email"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    file_extension = os.path.splitext(file.filename)[1]
    file_name = f"PAY_{package_id}_{uuid.uuid4()}{file_extension}"
    file_path = os.path.join("uploads", file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    proof_url = f"/uploads/{file_name}"
    await db.packages.update_one(
        {"_id": package_id},
        {"$set": {"payment_proof_url": proof_url, "payment_status": "waiting_validation"}}
    )
    
    return {"message": "Preuve de paiement envoyée. En attente de validation.", "url": proof_url}

@router.get("/{package_id}/invoice")
async def get_package_invoice(
    package_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Colis non trouvé")
        
    is_owner = package.get("owner_id") == current_user["email"]
    is_staff = current_user.get("role") in ["admin", "operator"]
    
    if not (is_owner or is_staff):
        raise HTTPException(status_code=403, detail="Accès refusé")
        
    pdf_buffer = generate_invoice_pdf(package)
    
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Facture_{package.get('tracking_number', 'Colis')}.pdf"
        }
    )
