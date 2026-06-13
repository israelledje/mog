from fastapi import Depends, HTTPException, status, Query
from typing import Optional

from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_token
from app.core.database import get_database

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    token_query: Optional[str] = Query(None, alias="token"),
    db = Depends(get_database)
):
    actual_token = token or token_query
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not actual_token:
        raise credentials_exception
        
    payload = decode_token(actual_token)
    email: str = payload.get("sub")
    if email is None or payload.get("type") != "access":
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
        
    return user

def check_role(roles: list):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous n'avez pas les permissions nécessaires pour cette action"
            )
        return user
    return role_checker
