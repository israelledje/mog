from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.core.database import get_database
from app.features.auth.schemas import UserCreate
from app.core.security import get_password_hash
from app.core.user_codes import generate_client_code
from app.core.deps import get_current_user, check_role
from datetime import datetime, timedelta
import pandas as pd
from io import BytesIO

router = APIRouter(prefix="/admin", tags=["Administration"])

@router.get("/stats", dependencies=[Depends(check_role(["admin"]))])
async def get_global_stats(db = Depends(get_database)):
    seven_days_ago = datetime.now() - timedelta(days=7)
    fourteen_days_ago = datetime.now() - timedelta(days=14)

    total_packages = await db.packages.count_documents({})
    packages_received = await db.packages.count_documents({"status": {"$in": ["received", "loaded", "closed"]}})
    pending_payments = await db.packages.count_documents({
        "payment_status": {"$in": ["pending", "waiting_validation"]}
    })
    active_clients = await db.users.count_documents({"role": "client"})

    # Revenu réel : somme des total_price des colis payés
    revenue_pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$total_price", 0]}}}},
    ]
    rev_cursor = db.packages.aggregate(revenue_pipeline)
    rev_data = await rev_cursor.to_list(length=1)
    total_revenue = rev_data[0]["total"] if rev_data else 0

    # Volume CBM total (dimensions en cm)
    volume_pipeline = [
        {
            "$project": {
                "cbm": {
                    "$divide": [
                        {
                            "$multiply": [
                                {"$ifNull": ["$dimensions.l", 0]},
                                {"$ifNull": ["$dimensions.w", 0]},
                                {"$ifNull": ["$dimensions.h", 0]},
                            ]
                        },
                        1_000_000,
                    ]
                }
            }
        },
        {"$group": {"_id": None, "total_cbm": {"$sum": "$cbm"}}},
    ]
    vol_cursor = db.packages.aggregate(volume_pipeline)
    vol_data = await vol_cursor.to_list(length=1)
    total_volume_cbm = round(vol_data[0]["total_cbm"], 2) if vol_data else 0

    # Conteneurs : compat mode / transport_mode
    all_containers = await db.containers.find({}).to_list(length=5000)
    sea_count = sum(1 for c in all_containers if (c.get("mode") or c.get("transport_mode") or "sea") == "sea")
    air_count = sum(1 for c in all_containers if (c.get("mode") or c.get("transport_mode")) in ("air", "air_express"))
    open_containers = sum(1 for c in all_containers if c.get("status") == "open")

    # Tendances journalières (7 derniers jours)
    daily_pipeline = [
        {"$match": {"created_at": {"$gte": seven_days_ago}}},
        {
            "$project": {
                "created_at": 1,
                "cbm": {
                    "$divide": [
                        {
                            "$multiply": [
                                {"$ifNull": ["$dimensions.l", 0]},
                                {"$ifNull": ["$dimensions.w", 0]},
                                {"$ifNull": ["$dimensions.h", 0]},
                            ]
                        },
                        1_000_000,
                    ]
                },
            }
        },
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$created_at"},
                    "month": {"$month": "$created_at"},
                    "day": {"$dayOfMonth": "$created_at"},
                },
                "count": {"$sum": 1},
                "volume_cbm": {"$sum": "$cbm"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    daily_cursor = db.packages.aggregate(daily_pipeline)
    daily_raw = await daily_cursor.to_list(length=7)

    daily_map: dict = {}
    for item in daily_raw:
        date_str = f"{item['_id']['year']}-{item['_id']['month']:02d}-{item['_id']['day']:02d}"
        daily_map[date_str] = {
            "count": item["count"],
            "volume_cbm": round(item.get("volume_cbm", 0), 2),
        }

    daily_stats = []
    for i in range(6, -1, -1):
        day = datetime.now() - timedelta(days=i)
        date_str = day.strftime("%Y-%m-%d")
        entry = daily_map.get(date_str, {"count": 0, "volume_cbm": 0})
        daily_stats.append({"date": date_str, **entry})

    # Colis créés cette semaine vs semaine précédente
    packages_this_week = await db.packages.count_documents({"created_at": {"$gte": seven_days_ago}})
    packages_last_week = await db.packages.count_documents({
        "created_at": {"$gte": fourteen_days_ago, "$lt": seven_days_ago}
    })

    def pct_change(current: int, previous: int):
        if previous == 0:
            return None if current == 0 else 100.0
        return round(((current - previous) / previous) * 100, 1)

    return {
        "total_packages": total_packages,
        "packages_received": packages_received,
        "total_revenue": total_revenue,
        "total_volume_cbm": total_volume_cbm,
        "active_clients": active_clients,
        "pending_payments": pending_payments,
        "open_containers": open_containers,
        "logistics_split": {"sea": sea_count, "air": air_count, "total": len(all_containers)},
        "daily_trends": daily_stats,
        "packages_this_week": packages_this_week,
        "packages_week_change_pct": pct_change(packages_this_week, packages_last_week),
    }

@router.get("/users", dependencies=[Depends(check_role(["admin"]))])
async def list_all_users(db = Depends(get_database)):
    cursor = db.users.find({}, {"password": 0, "hashed_password": 0}) # Cacher les mots de passe
    users = []
    async for user in cursor:
        user["id"] = str(user["_id"])
        del user["_id"]
        users.append(user)
    return users

@router.get("/team", dependencies=[Depends(check_role(["admin"]))])
async def list_team(db = Depends(get_database)):
    cursor = db.users.find({"role": {"$in": ["admin", "operator"]}}, {"password": 0, "hashed_password": 0})
    users = []
    async for user in cursor:
        user["id"] = str(user["_id"])
        del user["_id"]
        users.append(user)
    return users

@router.get("/customers", dependencies=[Depends(check_role(["admin"]))])
async def list_customers(db = Depends(get_database)):
    cursor = db.users.find({"role": {"$nin": ["admin", "operator"]}}, {"password": 0, "hashed_password": 0})
    users = []
    async for user in cursor:
        user["id"] = str(user["_id"])
        del user["_id"]
        users.append(user)
    return users

@router.post("/users", dependencies=[Depends(check_role(["admin"]))])
async def create_user_as_admin(user_in: UserCreate, db = Depends(get_database)):
    # Vérifier si l'utilisateur existe déjà
    existing_user = await db.users.find_one({"email": user_in.email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Cet email est déjà utilisé",
        )
    
    # Créer l'objet utilisateur pour la base
    user_dict = user_in.model_dump()
    user_dict["hashed_password"] = get_password_hash(user_in.password)
    role = user_dict.get("role", "client")
    user_dict["client_code"] = await generate_client_code(db, role)
    if role in ("operator", "admin") and not user_dict.get("badge_secret"):
        import secrets
        user_dict["badge_secret"] = secrets.token_urlsafe(16)
    del user_dict["password"]
    
    # Insérer dans MongoDB
    await db.users.insert_one(user_dict)
    
    # Retourner l'utilisateur sans le mot de passe
    if "_id" in user_dict:
        user_dict["id"] = str(user_dict["_id"])
        del user_dict["_id"]
    if "hashed_password" in user_dict:
        del user_dict["hashed_password"]
    
    return user_dict

@router.get("/export/packages", dependencies=[Depends(check_role(["admin"]))])
async def export_packages_excel(db = Depends(get_database)):
    # 1. Récupérer toutes les données
    cursor = db.packages.find()
    data = await cursor.to_list(length=10000)
    
    if not data:
        raise HTTPException(status_code=404, detail="Aucune donnée à exporter")
        
    # 2. Transformer en DataFrame
    df = pd.DataFrame(data)
    
    # Nettoyage des colonnes techniques
    cols_to_drop = ["_id", "timeline", "photos"]
    df = df.drop(columns=[c for c in cols_to_drop if c in df.columns])
    
    # Renommer les colonnes pour l'utilisateur
    df.columns = [
        "Nom Expéditeur", "Tel Expéditeur", "Ville Expédition", 
        "Nom Destinataire", "Tel Destinataire", "Ville Destination",
        "Description", "Poids (kg)", "Type", "ID Unique", 
        "Numéro Tracking", "Propriétaire", "Statut", "Date Création", "Date MAJ"
    ]
    
    # 3. Créer le fichier Excel en mémoire
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Colis')
    
    output.seek(0)
    
    filename = f"Rapport_Colis_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.patch("/users/{user_id}", dependencies=[Depends(check_role(["admin"]))])
async def update_user_as_admin(user_id: str, update_data: dict, db = Depends(get_database)):
    from bson import ObjectId
    
    # Supprimer les champs sensibles s'ils sont présents dans le body
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data["password"])
        del update_data["password"]
    elif "password" in update_data:
        del update_data["password"]
    
    # Préparer l'ID (gérer string ou ObjectId)
    query_id = user_id
    try:
        if ObjectId.is_valid(user_id):
            query_id = ObjectId(user_id)
    except:
        pass

    result = await db.users.update_one(
        {"_id": query_id},
        {"$set": {k: v for k, v in update_data.items() if v is not None}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
    return {"message": "Utilisateur mis à jour"}
