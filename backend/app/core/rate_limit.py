"""
Rate limiting via slowapi — compatible FastAPI/asyncio.
Limite les endpoints sensibles par adresse IP.

Usage dans les routers :
    from app.core.rate_limit import limiter
    from fastapi import Request

    @router.post("/login")
    @limiter.limit("10/minute")
    async def login(request: Request, ...):
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])
