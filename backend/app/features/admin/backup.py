"""
Service de sauvegarde MongoDB via mongodump en subprocess async.

Les backups sont stockés dans /app/backups/ (volume Docker persistant).
Les 10 plus récentes sont conservées automatiquement.

Usage via l'API admin :
    POST /api/admin/backup/create   → déclenche un backup
    GET  /api/admin/backup/list     → liste les archives disponibles
    GET  /api/admin/backup/download/{filename} → télécharge une archive
"""
import asyncio
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "/app/backups"))


async def run_backup(db_name: str = "cargo_app") -> dict:
    """
    Lance mongodump en subprocess async et retourne les métadonnées du backup.
    Crée une archive .tar.gz unique dans BACKUP_DIR.
    Timeout : 120 secondes.
    """
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"backup_{timestamp}"
    mongo_uri = os.getenv("MONGO_URI", "mongodb://mongodb:27017")

    cmd = [
        "mongodump",
        f"--uri={mongo_uri}",
        f"--db={db_name}",
        f"--out={backup_path}",
        "--gzip",
    ]

    logger.info(f"[BACKUP] Démarrage mongodump → {backup_path}")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)

        if proc.returncode != 0:
            err = stderr.decode(errors="replace")
            logger.error(f"[BACKUP] mongodump échoué (code {proc.returncode}): {err}")
            raise RuntimeError(f"mongodump failed: {err}")

        # Créer une archive .tar.gz unique à partir du dossier
        archive_base = str(backup_path)
        shutil.make_archive(archive_base, "gztar", str(backup_path))
        archive_path = Path(archive_base + ".tar.gz")

        # Nettoyer le dossier intermédiaire
        shutil.rmtree(backup_path, ignore_errors=True)

        size_bytes = archive_path.stat().st_size
        logger.info(f"[BACKUP] ✅ Archive créée : {archive_path.name} ({size_bytes // 1024} Ko)")

        return {
            "success": True,
            "filename": archive_path.name,
            "size_bytes": size_bytes,
            "created_at": timestamp,
        }

    except asyncio.TimeoutError:
        # Nettoyer le dossier partiel
        shutil.rmtree(backup_path, ignore_errors=True)
        raise RuntimeError("Backup timeout (>120s) — base de données peut-être trop volumineuse")


def list_backups() -> list[dict]:
    """
    Liste les archives de backup disponibles, triées de la plus récente à la plus ancienne.
    Retourne au maximum 20 entrées.
    """
    if not BACKUP_DIR.exists():
        return []

    files = sorted(BACKUP_DIR.glob("backup_*.tar.gz"), reverse=True)
    return [
        {
            "filename": f.name,
            "size_bytes": f.stat().st_size,
            "created_at": datetime.utcfromtimestamp(f.stat().st_mtime).isoformat() + "Z",
        }
        for f in files[:20]
    ]


def cleanup_old_backups(keep: int = 10) -> int:
    """
    Supprime les archives en excès — conserve les `keep` plus récentes.
    Retourne le nombre d'archives supprimées.
    """
    if not BACKUP_DIR.exists():
        return 0

    files = sorted(BACKUP_DIR.glob("backup_*.tar.gz"), reverse=True)
    deleted = 0
    for old_file in files[keep:]:
        old_file.unlink()
        logger.info(f"[BACKUP] 🗑️ Archive supprimée : {old_file.name}")
        deleted += 1
    return deleted
