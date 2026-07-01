from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.features.auth.router import router as auth_router
from app.features.shipping.router import router as shipping_router
from app.features.logistics.router import router as logistics_router
from app.features.admin.router import router as admin_router
from app.features.tarifs.router import router as tarifs_router
from app.features.entrepots.router import router as entrepots_router
from app.features.billing.router import router as billing_router
from app.features.settings.router import router as settings_router
from app.features.whatsapp.router import router as whatsapp_router
from app.core.database import connect_to_mongo, close_mongo_connection
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    
    # Seed Global Settings
    from app.core.database import db_manager
    if db_manager.db is not None:
        settings_count = await db_manager.db.settings.count_documents({"_id": "global"})
        if settings_count == 0:
            await db_manager.db.settings.insert_one({
                "_id": "global",
                "exchange_rate_cny_xaf_under_1m": 100.0,
                "exchange_rate_cny_xaf_over_1m": 85.0,
                "storage_free_days": 7,
                "storage_daily_fee": 1000.0,
                "air_delay_days": 7,
                "air_express_delay_days": 3,
                "sea_delay_days": 45,
                "support_phone": "237694581150"
            })
            print("Global settings seeded successfully.")

    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    title="Cargo Tracker API",
    description="Backend API for CargoLine Logistics (China-Cameroon)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import logging
import time
from fastapi import Request

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(message)s")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    logging.info(f"👉 REQUÊTE : {request.method} {request.url}")

    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000
    logging.info(f"✅ RÉPONSE : {response.status_code} (Temps: {process_time:.2f}ms)\n")
    return response

from fastapi import APIRouter
notifs_router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@notifs_router.get("")
async def get_notifications():
    return []

@notifs_router.post("/{notif_id}/read")
async def mark_read(notif_id: str):
    return {"status": "ok"}

@notifs_router.post("/read-all")
async def mark_all_read():
    return {"status": "ok"}

app.include_router(auth_router, prefix="/api")
app.include_router(shipping_router, prefix="/api")
app.include_router(logistics_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(tarifs_router, prefix="/api")
app.include_router(entrepots_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(whatsapp_router, prefix="/api")
app.include_router(notifs_router)

# Serve Uploads (volume persistant Docker : /app/uploads)
import os
from app.core.paths import UPLOAD_DIR

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "avatars"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "project": "Cargo Tracker"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
