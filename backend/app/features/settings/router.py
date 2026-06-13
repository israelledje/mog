from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_database
from app.core.deps import check_role
from .schemas import SettingsResponse, SettingsUpdate
from typing import Dict, Any

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingsResponse)
async def get_settings(db = Depends(get_database)):
    """
    Get the global configuration settings.
    This endpoint is public/accessible by all clients to dynamically adjust their logic
    (e.g., displaying exchange rates).
    """
    settings_doc = await db.settings.find_one({"_id": "global"})
    if not settings_doc:
        # Fallback to defaults if not yet seeded
        return SettingsResponse()
    return SettingsResponse(**settings_doc)

@router.put("", response_model=SettingsResponse, dependencies=[Depends(check_role(["admin"]))])
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
