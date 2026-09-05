from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union
from jose import jwt
import bcrypt
from app.core.config import settings

def _truncate_password(password: str) -> bytes:
    """Truncate password to 71 bytes (bcrypt hard limit)."""
    encoded = password.encode("utf-8")
    if len(encoded) > 71:
        encoded = encoded[:71]
    return encoded

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Check if legacy or corrupted hash
        if not hashed_password.startswith("$2b$") and not hashed_password.startswith("$2a$"):
            return False
        return bcrypt.checkpw(
            _truncate_password(plain_password), 
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pwd_bytes = _truncate_password(password)
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return {}


# ── SIGNATURE CRYPTOGRAPHIQUE NUMÉRIQUE HMAC-SHA256 POUR QR CODE ──

import hmac
import hashlib


def sign_package_qr(tracking: str, package_id: str) -> str:
    """
    Génère une signature cryptographique inviolable HMAC-SHA256 pour le colis.
    Empêche tout tiers de fabriquer de fausses étiquettes physiques.
    """
    secret = (getattr(settings, "JWT_SECRET", None) or "mog-super-secure-secret-key").encode("utf-8")
    msg = f"{str(tracking).strip()}:{str(package_id).strip()}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()[:16]


def create_secure_qr_payload(tracking: str, package_id: str) -> str:
    """Crée le payload sécurisé et signé au format : MOG:{tracking}:{hmac_sha256_sig}."""
    sig = sign_package_qr(tracking, package_id)
    return f"MOG:{str(tracking).strip()}:{sig}"


def parse_qr_scan_input(raw_input: str) -> tuple[str, Optional[str]]:
    """
    Extrait le numéro de suivi et la signature HMAC à partir du scan.
    Supporte à la fois les QR signés et les scans legacy ou saisies manuelles.
    """
    cleaned = str(raw_input).strip()
    if cleaned.startswith("MOG:"):
        parts = cleaned.split(":")
        if len(parts) >= 3:
            return parts[1].strip(), parts[2].strip()
    return cleaned, None


def verify_package_signature(tracking: str, package_id: str, signature: Optional[str]) -> bool:
    """Vérifie la validité mathématique de la signature HMAC-SHA256."""
    if not signature:
        return False
    expected = sign_package_qr(tracking, package_id)
    return hmac.compare_digest(signature.lower(), expected.lower())

