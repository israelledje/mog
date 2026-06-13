from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    city: Optional[str] = None
    role: str = "client"
    gender: str = "male"
    badge_secret: Optional[str] = None
    phone: Optional[str] = None
    client_code: Optional[str] = None
    default_delivery_address: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_language: Optional[str] = "fr"
    notification_preferences: dict = Field(default_factory=lambda: {"received": True, "quoted": True, "departed": True, "delivered": True})

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserBase

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    type: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str
    new_password: str
