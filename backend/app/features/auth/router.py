from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Response, Request
from app.features.auth.schemas import (
    LoginRequest, Token, RefreshRequest, UserCreate, UserBase,
    ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest,
    PhoneOTPRequest, PhoneVerifyRequest,
)
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token, get_password_hash
from app.core.user_codes import generate_client_code, ensure_client_code
from app.core.phone_utils import normalize_phone, is_valid_phone
from app.core.database import get_database
import random
import secrets
from datetime import datetime, timedelta, timezone
from app.core.notification_service import NotificationService
import re
import uuid
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token)
async def register(user_in: UserCreate, response: Response, db = Depends(get_database)):
    # ... (rest of validation)
    allowed_cities = ["Douala", "Yaoundé", "Guangzhou", "Yiwu", "Shenzhen", "Autre"]
    if user_in.city and user_in.city not in allowed_cities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ville non supportée. Villes autorisées: {', '.join(allowed_cities)}",
        )

    # Vérifier si l'utilisateur existe déjà
    existing_user = await db.users.find_one({"email": user_in.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé",
        )
    
    # Créer l'objet utilisateur pour la base
    user_dict = user_in.model_dump()
    user_dict["role"] = "client"
    user_dict["hashed_password"] = get_password_hash(user_in.password)
    user_dict["badge_secret"] = secrets.token_urlsafe(16) # Secret unique pour le badge
    user_dict["client_code"] = await generate_client_code(db, "client")
    del user_dict["password"]
    
    # Insérer dans MongoDB
    await db.users.insert_one(user_dict)
    user_response = user_dict.copy()
    user_response.pop("hashed_password", None)
    
    access_token = create_access_token({"sub": user_in.email, "role": "client"})
    refresh_token = create_refresh_token({"sub": user_in.email})
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, samesite="lax", secure=False, max_age=15*60)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, samesite="lax", secure=False, max_age=7*24*60*60)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_response,
    }

@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest, response: Response, db = Depends(get_database)):
    # Simuler la récupération utilisateur (En attendant Story 1.2)
    # Dans la vraie vie, on cherche dans MongoDB
    escaped_email = re.escape(login_data.email.strip())
    user = await db.users.find_one({"email": {"$regex": f"^{escaped_email}$", "$options": "i"}})
    
    hashed_pwd = None
    if user:
        hashed_pwd = user.get("hashed_password") or user.get("password")
        
    if not user or not hashed_pwd or not verify_password(login_data.password, hashed_pwd):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token({"sub": user["email"], "role": user["role"]})
    refresh_token = create_refresh_token({"sub": user["email"]})

    response.set_cookie(key="access_token", value=access_token, httponly=True, samesite="lax", secure=False, max_age=15*60)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, samesite="lax", secure=False, max_age=7*24*60*60)

    user_copy = user.copy()
    if "_id" in user_copy:
        user_copy["_id"] = str(user_copy["_id"])
    if "hashed_password" in user_copy:
        del user_copy["hashed_password"]
    user_copy["client_code"] = await ensure_client_code(db, user)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_copy,
    }

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer(auto_error=False)

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security), db = Depends(get_database)):
    token = credentials.credentials if credentials else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
        
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token invalide")
    user = await db.users.find_one({"email": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    return user

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    user_copy = current_user.copy()
    if "_id" in user_copy:
        user_copy["_id"] = str(user_copy["_id"])
    if "hashed_password" in user_copy:
        del user_copy["hashed_password"]
    user_copy["client_code"] = await ensure_client_code(db, current_user)
    return user_copy

from pydantic import BaseModel
from typing import Optional

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    city: Optional[str] = None
    preferred_language: Optional[str] = None
    notification_preferences: Optional[dict] = None
    phone: Optional[str] = None
    default_delivery_address: Optional[str] = None
    avatar_url: Optional[str] = None

@router.put("/me")
async def update_me(update_data: UserUpdate, current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    # Le téléphone doit être vérifié via /auth/phone/verify-otp
    update_dict.pop("phone", None)
    if not update_dict:
        user_copy = current_user.copy()
        if "_id" in user_copy:
            user_copy["_id"] = str(user_copy["_id"])
        if "hashed_password" in user_copy:
            del user_copy["hashed_password"]
        return user_copy
    
    await db.users.update_one(
        {"email": current_user["email"]},
        {"$set": update_dict}
    )
    
    user = await db.users.find_one({"email": current_user["email"]})
    user_copy = user.copy()
    if "_id" in user_copy:
        user_copy["_id"] = str(user_copy["_id"])
    if "hashed_password" in user_copy:
        del user_copy["hashed_password"]
    return user_copy

@router.post("/phone/send-otp")
async def send_phone_otp(
    request: PhoneOTPRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database),
):
    phone = normalize_phone(request.phone)
    if not is_valid_phone(phone):
        raise HTTPException(status_code=400, detail="Numéro de téléphone invalide")

    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    await db.otp_codes.update_one(
        {"email": current_user["email"]},
        {
            "$set": {
                "phone_otp": otp_code,
                "phone_otp_number": phone,
                "phone_otp_expires_at": expires_at,
                "phone_otp_attempts": 0,
            }
        },
        upsert=True,
    )

    msg = f"Votre code de vérification MOG est : {otp_code}. Valable 10 minutes."
    delivery = await NotificationService.send_whatsapp(phone, msg)

    if not delivery.get("success"):
        raise HTTPException(
            status_code=503,
            detail="Impossible d'envoyer le code. Vérifiez votre numéro ou réessayez plus tard.",
        )

    channel = delivery.get("channel", "whatsapp")
    if channel == "sms":
        return {"message": "Code envoyé par SMS", "channel": "sms"}
    return {"message": "Code envoyé par WhatsApp", "channel": "whatsapp"}

@router.post("/phone/verify-otp")
async def verify_phone_otp(
    request: PhoneVerifyRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database),
):
    phone = normalize_phone(request.phone)
    if not is_valid_phone(phone):
        raise HTTPException(status_code=400, detail="Numéro de téléphone invalide")

    otp_record = await db.otp_codes.find_one({"email": current_user["email"]})
    if not otp_record or not otp_record.get("phone_otp"):
        raise HTTPException(status_code=400, detail="Aucun code en cours. Demandez un nouveau code.")

    attempts = otp_record.get("phone_otp_attempts", 0) + 1
    if attempts > 3:
        await db.otp_codes.update_one(
            {"email": current_user["email"]},
            {"$unset": {"phone_otp": "", "phone_otp_number": "", "phone_otp_expires_at": "", "phone_otp_attempts": ""}},
        )
        raise HTTPException(status_code=400, detail="Trop de tentatives. Demandez un nouveau code.")

    await db.otp_codes.update_one(
        {"email": current_user["email"]},
        {"$set": {"phone_otp_attempts": attempts}},
    )

    if otp_record.get("phone_otp_number") != phone:
        raise HTTPException(status_code=400, detail="Le numéro ne correspond pas au code envoyé")

    if otp_record.get("phone_otp") != request.otp_code:
        raise HTTPException(status_code=400, detail="Code OTP incorrect")

    expires = otp_record.get("phone_otp_expires_at")
    if not expires or datetime.now(timezone.utc) > expires.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Code OTP expiré")

    await db.users.update_one(
        {"email": current_user["email"]},
        {"$set": {"phone": phone, "phone_verified": True}},
    )
    await db.otp_codes.update_one(
        {"email": current_user["email"]},
        {"$unset": {"phone_otp": "", "phone_otp_number": "", "phone_otp_expires_at": "", "phone_otp_attempts": ""}},
    )

    user = await db.users.find_one({"email": current_user["email"]})
    user_copy = user.copy()
    if "_id" in user_copy:
        user_copy["_id"] = str(user_copy["_id"])
    if "hashed_password" in user_copy:
        del user_copy["hashed_password"]
    return user_copy

@router.post("/me/avatar")
async def upload_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user), db = Depends(get_database)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image")
    
    os.makedirs("uploads/avatars", exist_ok=True)
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{file_ext}"
    file_path = os.path.join("uploads", "avatars", filename)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
        
    avatar_url = f"/uploads/avatars/{filename}"
    
    await db.users.update_one(
        {"email": current_user["email"]},
        {"$set": {"avatar_url": avatar_url}}
    )
    
    user = await db.users.find_one({"email": current_user["email"]})
    user_copy = user.copy()
    if "_id" in user_copy:
        user_copy["_id"] = str(user_copy["_id"])
    if "hashed_password" in user_copy:
        del user_copy["hashed_password"]
    return user_copy

@router.post("/qr-login")
async def qr_login_step1(qr_token: str, db = Depends(get_database)):
    # 1. On cherche d'abord par le secret de badge (format sécurisé)
    user = await db.users.find_one({"badge_secret": qr_token})
    
    # 2. Si non trouvé, on tente par email (format legacy pour transition)
    if not user:
        user = await db.users.find_one({"email": qr_token})
    
    if not user or user.get("role") not in ["operator", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Badge invalide ou non reconnu",
        )
    
    # Générer OTP
    otp_code = f"{random.randint(1000, 9999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Stocker l'OTP pour la vérification QR
    await db.otp_codes.update_one(
        {"email": user["email"]},
        {"$set": {"qr_otp": otp_code, "qr_expires_at": expires_at, "attempts": 0}},
        upsert=True
    )
    
    # Envoyer via WhatsApp
    phone = user.get("phone")
    if phone:
        msg = f"Votre code de connexion CargoLine est : {otp_code}. Valable 5 minutes."
        await NotificationService.send_whatsapp(phone, msg)
    
    return {"message": "OTP envoyé", "email": user["email"]}

@router.post("/operator-manual-login")
async def operator_manual_login(login_data: LoginRequest, db = Depends(get_database)):
    escaped_email = re.escape(login_data.email.strip())
    user = await db.users.find_one({"email": {"$regex": f"^{escaped_email}$", "$options": "i"}})
    
    hashed_pwd = None
    if user:
        hashed_pwd = user.get("hashed_password") or user.get("password")
        
    if not user or not hashed_pwd or not verify_password(login_data.password, hashed_pwd):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
        
    if user.get("role") not in ["operator", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux opérateurs",
        )

    # Générer OTP
    otp_code = f"{random.randint(1000, 9999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Stocker l'OTP pour la vérification QR (on réutilise le même mécanisme)
    await db.otp_codes.update_one(
        {"email": user["email"]},
        {"$set": {"qr_otp": otp_code, "qr_expires_at": expires_at, "attempts": 0}},
        upsert=True
    )
    
    # Envoyer via WhatsApp
    phone = user.get("phone")
    if phone:
        msg = f"Votre code de connexion CargoLine est : {otp_code}. Valable 5 minutes."
        await NotificationService.send_whatsapp(phone, msg)
    
    return {"message": "OTP envoyé", "email": user["email"]}

class QRVerifyRequest(BaseModel):
    email: str
    otp_code: str

@router.post("/qr-verify", response_model=Token)
async def qr_login_step2(request: QRVerifyRequest, response: Response, db = Depends(get_database)):
    otp_record = await db.otp_codes.find_one({"email": request.email})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Code OTP incorrect")
        
    attempts = otp_record.get("attempts", 0) + 1
    if attempts > 3:
        await db.otp_codes.delete_one({"email": request.email})
        raise HTTPException(status_code=400, detail="Trop de tentatives, veuillez redemander un code")
        
    await db.otp_codes.update_one({"email": request.email}, {"$set": {"attempts": attempts}})
    
    if otp_record.get("qr_otp") != request.otp_code:
        raise HTTPException(status_code=400, detail="Code OTP incorrect")
    
    if datetime.now(timezone.utc) > otp_record["qr_expires_at"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Code OTP expiré")
    
    user = await db.users.find_one({"email": request.email})
    
    # Invalider l'OTP
    await db.otp_codes.update_one({"email": request.email}, {"$unset": {"qr_otp": "", "qr_expires_at": ""}})
    
    access_token = create_access_token({"sub": user["email"], "role": user.get("role", "operator")})
    refresh_token = create_refresh_token({"sub": user["email"]})

    response.set_cookie(key="access_token", value=access_token, httponly=True, samesite="lax", secure=False, max_age=15*60)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, samesite="lax", secure=False, max_age=7*24*60*60)

    user_copy = user.copy()
    if "_id" in user_copy:
        user_copy["_id"] = str(user_copy["_id"])
    if "hashed_password" in user_copy:
        del user_copy["hashed_password"]
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_copy,
    }

@router.post("/refresh", response_model=Token)
async def refresh(refresh_data: RefreshRequest, response: Response, db = Depends(get_database)):
    payload = decode_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de rafraîchissement invalide",
        )
    
    email = payload.get("sub")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable ou compte désactivé")

    user_copy = user.copy()
    if "_id" in user_copy:
        user_copy["_id"] = str(user_copy["_id"])
    if "hashed_password" in user_copy:
        del user_copy["hashed_password"]

    access_token = create_access_token({"sub": email, "role": user.get("role", "operator")})
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, samesite="lax", secure=False, max_age=15*60)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_data.refresh_token,
        "token_type": "bearer",
        "user": user_copy,
    }

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db = Depends(get_database)):
    user = await db.users.find_one({"email": request.email})
    if not user:
        # On ne révèle pas si l'email existe pour des raisons de sécurité
        return {"message": "Si l'email existe, un code OTP a été envoyé."}
    
    # Générer OTP à 6 chiffres
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Stocker en base (upsert)
    await db.otp_codes.update_one(
        {"email": request.email},
        {"$set": {"code": otp_code, "expires_at": expires_at, "attempts": 0}},
        upsert=True
    )
    
    # MOCK : Simuler l'envoi d'email
    print(f"DEBUG: OTP envoyé à {request.email} -> {otp_code}")
    
    return {"message": "Si l'email existe, un code OTP a été envoyé."}

@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest, db = Depends(get_database)):
    otp_record = await db.otp_codes.find_one({"email": request.email})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Code OTP invalide")
        
    attempts = otp_record.get("attempts", 0) + 1
    if attempts > 3:
        await db.otp_codes.delete_one({"email": request.email})
        raise HTTPException(status_code=400, detail="Trop de tentatives, veuillez redemander un code")
        
    await db.otp_codes.update_one({"email": request.email}, {"$set": {"attempts": attempts}})
    
    if otp_record.get("code") != request.otp_code:
        raise HTTPException(status_code=400, detail="Code OTP invalide")
    
    if datetime.now(timezone.utc) > otp_record["expires_at"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Code OTP expiré")
    
    return {"message": "Code OTP valide"}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db = Depends(get_database)):
    # Re-vérifier l'OTP pour plus de sécurité
    otp_record = await db.otp_codes.find_one({"email": request.email, "code": request.otp_code})
    
    if not otp_record or datetime.now(timezone.utc) > otp_record["expires_at"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Session de réinitialisation expirée ou code invalide")
    
    # Mettre à jour le mot de passe
    hashed_password = get_password_hash(request.new_password)
    await db.users.update_one(
        {"email": request.email},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    # Supprimer l'OTP utilisé
    await db.otp_codes.delete_one({"email": request.email})
    
    return {"message": "Mot de passe réinitialisé avec succès"}

from pydantic import BaseModel

class PushTokenRequest(BaseModel):
    token: str
    platform: str

@router.post("/push-token")
async def register_push_token(
    request: PushTokenRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    await db.users.update_one(
        {"email": current_user["email"]},
        {"$set": {"push_token": request.token, "push_platform": request.platform}}
    )
    return {"message": "Token registered successfully"}
