"""
Création des index MongoDB — idempotent, safe à relancer à chaque démarrage.
Les index existants ne sont pas recréés (MongoDB les ignore silencieusement).
"""
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def create_indexes(db: AsyncIOMotorDatabase):
    logger.info("🗂️  Création/vérification des index MongoDB...")

    # ── users ──────────────────────────────────────────────────────────────
    await db.users.create_index("email", unique=True, name="idx_users_email_unique")
    await db.users.create_index("phone", sparse=True, name="idx_users_phone")
    await db.users.create_index("client_code", sparse=True, name="idx_users_client_code")
    await db.users.create_index("badge_secret", sparse=True, name="idx_users_badge_secret")
    await db.users.create_index("role", name="idx_users_role")

    # ── packages ───────────────────────────────────────────────────────────
    await db.packages.create_index("owner_id", name="idx_packages_owner")
    await db.packages.create_index("status", name="idx_packages_status")
    await db.packages.create_index(
        "tracking_number", unique=True, name="idx_packages_tracking_unique"
    )
    await db.packages.create_index(
        [("owner_id", 1), ("status", 1)],
        name="idx_packages_owner_status",
    )
    await db.packages.create_index(
        [("owner_id", 1), ("created_at", -1)],
        name="idx_packages_owner_created",
    )
    await db.packages.create_index(
        "payment_status", name="idx_packages_payment_status"
    )
    await db.packages.create_index(
        "container_id", sparse=True, name="idx_packages_container"
    )
    await db.packages.create_index(
        "groupage_id", sparse=True, name="idx_packages_groupage"
    )
    await db.packages.create_index("created_at", name="idx_packages_created_at")

    # ── otp_codes — TTL auto-expiry après 30 min via MongoDB ───────────────
    await db.otp_codes.create_index(
        "email", unique=True, name="idx_otp_email_unique"
    )
    await db.otp_codes.create_index(
        "expires_at",
        expireAfterSeconds=1800,  # MongoDB supprime automatiquement après 30 min
        name="idx_otp_ttl",
    )

    # ── containers ─────────────────────────────────────────────────────────
    await db.containers.create_index("status", name="idx_containers_status")
    await db.containers.create_index(
        "transport_mode", name="idx_containers_mode"
    )
    await db.containers.create_index("created_at", name="idx_containers_created")

    # ── entrepots ──────────────────────────────────────────────────────────
    await db.entrepots.create_index("type", name="idx_entrepots_type")

    # ── counters (codes client atomiques) ──────────────────────────────────
    # _id est déjà indexé par défaut dans MongoDB — rien à faire

    logger.info("✅ Index MongoDB prêts.")
