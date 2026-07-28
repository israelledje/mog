from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Literal, Dict
from datetime import datetime
import uuid

from app.core.database import get_database
from app.core.deps import get_current_user, check_role

router = APIRouter(prefix="/services", tags=["Services"])

ServiceStatus = Literal["new", "contacted", "done", "cancelled"]


class ServiceRequestCreate(BaseModel):
    service_slug: str = Field(min_length=2, max_length=64)
    service_title: str = Field(min_length=2, max_length=200)
    form_data: Dict[str, str] = Field(default_factory=dict)
    summary: str = Field(default="", max_length=8000)


class ServiceRequestStatusUpdate(BaseModel):
    status: ServiceStatus


def _serialize(doc: dict) -> dict:
    return {
        "id": doc.get("_id"),
        "service_slug": doc.get("service_slug"),
        "service_title": doc.get("service_title"),
        "form_data": doc.get("form_data") or {},
        "summary": doc.get("summary") or "",
        "status": doc.get("status", "new"),
        "customer_id": doc.get("customer_id"),
        "customer_name": doc.get("customer_name"),
        "customer_email": doc.get("customer_email"),
        "customer_phone": doc.get("customer_phone"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "operator_note": doc.get("operator_note"),
    }


def _user_id(user: dict) -> str:
    return str(user.get("id") or user.get("_id") or "")


@router.post("/requests")
async def create_service_request(
    payload: ServiceRequestCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    if not payload.form_data:
        raise HTTPException(status_code=400, detail="Formulaire vide")

    now = datetime.utcnow()
    doc = {
        "_id": str(uuid.uuid4()),
        "service_slug": payload.service_slug,
        "service_title": payload.service_title,
        "form_data": payload.form_data,
        "summary": payload.summary,
        "status": "new",
        "customer_id": _user_id(current_user),
        "customer_name": current_user.get("full_name") or current_user.get("name"),
        "customer_email": current_user.get("email"),
        "customer_phone": payload.form_data.get("phone") or current_user.get("phone"),
        "created_at": now,
        "updated_at": now,
    }
    await db.service_requests.insert_one(doc)

    # Notification légère pour opérateurs (collection notifications)
    try:
        await db.notifications.insert_one({
            "_id": str(uuid.uuid4()),
            "type": "service_request",
            "title": f"Nouvelle demande : {payload.service_title}",
            "body": f"{doc.get('customer_name') or doc.get('customer_email') or 'Client'} a soumis une demande.",
            "ref_id": doc["_id"],
            "audience": "operator",
            "read": False,
            "created_at": now,
        })
    except Exception:
        pass

    return _serialize(doc)


@router.get("/requests/mine")
async def my_service_requests(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    uid = _user_id(current_user)
    cursor = db.service_requests.find({"customer_id": uid}).sort("created_at", -1).limit(50)
    return [_serialize(d) async for d in cursor]


@router.get("/requests")
async def list_service_requests(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    query = {}
    if status:
        query["status"] = status
    cursor = db.service_requests.find(query).sort("created_at", -1).limit(100)
    return [_serialize(d) async for d in cursor]


@router.patch("/requests/{request_id}")
async def update_service_request(
    request_id: str,
    payload: ServiceRequestStatusUpdate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db=Depends(get_database),
):
    now = datetime.utcnow()
    updated = await db.service_requests.update_one(
        {"_id": request_id},
        {
            "$set": {
                "status": payload.status,
                "updated_at": now,
                "handled_by": _user_id(current_user),
            }
        },
    )
    if updated.matched_count == 0:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    result = await db.service_requests.find_one({"_id": request_id})
    return _serialize(result)


@router.get("/requests/{request_id}")
async def get_service_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    doc = await db.service_requests.find_one({"_id": request_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    role = current_user.get("role")
    uid = _user_id(current_user)
    if role not in ("admin", "operator") and doc.get("customer_id") != uid:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return _serialize(doc)
