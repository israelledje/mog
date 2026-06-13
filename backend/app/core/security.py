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
