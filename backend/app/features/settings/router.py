from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_database
from app.core.deps import check_role, get_current_user
from .schemas import SettingsResponse, SettingsUpdate, ExchangeRateUpdate
from datetime import datetime
from typing import Dict, Any

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingsResponse, include_in_schema=False)
@router.get("/", response_model=SettingsResponse)
async def get_settings(db = Depends(get_database)):
    """
    Get the global configuration settings.
    This endpoint is public/accessible by all clients to dynamically adjust their logic
    (e.g., displaying exchange rates).
    """
    settings_doc = await db.settings.find_one({"_id": "global"})
    if not settings_doc:
        return SettingsResponse()
    return SettingsResponse(**settings_doc)

@router.put("", response_model=SettingsResponse, dependencies=[Depends(check_role(["admin"]))], include_in_schema=False)
@router.put("/", response_model=SettingsResponse, dependencies=[Depends(check_role(["admin"]))])
async def update_settings(settings_in: SettingsUpdate, db = Depends(get_database)):
    """
    Update the global configuration settings. Only admins can do this.
    """
    update_data = settings_in.model_dump()
    result = await db.settings.update_one(
        {"_id": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    settings_doc = await db.settings.find_one({"_id": "global"})
    if not settings_doc:
        raise HTTPException(status_code=500, detail="Failed to update settings")
        
    return SettingsResponse(**settings_doc)

@router.patch("/exchange-rates", response_model=SettingsResponse, dependencies=[Depends(check_role(["admin"]))])
async def update_exchange_rates(
    rates: ExchangeRateUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Met à jour spécifiquement les taux de change CNY - FCFA.
    """
    now = datetime.now().isoformat()
    update_data = {
        "exchange_rate_cny_xaf_under_1m": rates.exchange_rate_cny_xaf_under_1m,
        "exchange_rate_cny_xaf_over_1m": rates.exchange_rate_cny_xaf_over_1m,
        "cny_rate_updated_at": now,
        "cny_rate_updated_by": current_user.get("full_name") or current_user.get("email") or "Admin",
    }
    await db.settings.update_one(
        {"_id": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    settings_doc = await db.settings.find_one({"_id": "global"})
    if not settings_doc:
        raise HTTPException(status_code=500, detail="Failed to update exchange rates")
        
    return SettingsResponse(**settings_doc)

