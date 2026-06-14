from fastapi import APIRouter, HTTPException, Depends
import httpx
from app.core.config import settings
from app.features.auth.router import get_current_user

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

@router.get("/status")
async def get_whatsapp_status(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{settings.WHATSAPP_SERVICE_URL}/status", timeout=5.0)
            return res.json()
    except Exception as e:
        return {"isConnected": False, "error": str(e)}

@router.get("/qr")
async def get_whatsapp_qr(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{settings.WHATSAPP_SERVICE_URL}/qr", timeout=10.0)
            return res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Impossible de récupérer le QR Code")

@router.post("/logout")
async def logout_whatsapp(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{settings.WHATSAPP_SERVICE_URL}/logout", timeout=5.0)
            return res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur de déconnexion")
