"""
Queue légère basée sur asyncio pour les tâches de notification en arrière-plan.

Avantage : aucune dépendance externe (pas de Redis, Celery, ARQ).
Limitation : les tâches sont perdues si le worker redémarre. Pour une garantie
de livraison forte, utiliser ARQ ou Celery avec Redis en backend.

Usage :
    from app.core.task_queue import fire_and_forget

    # Dans un endpoint FastAPI :
    fire_and_forget(
        NotificationService.notify_colis_created(package_data),
        label="notify_colis_created:CTG-001"
    )
    return package_data  # réponse immédiate, notification partie en arrière-plan
"""
import asyncio
import logging
from typing import Coroutine, Any

logger = logging.getLogger(__name__)


def fire_and_forget(coro: Coroutine[Any, Any, Any], label: str = "bg_task") -> asyncio.Task:
    """
    Lance une coroutine en arrière-plan sans bloquer la réponse HTTP.
    Les erreurs sont loggées mais n'affectent pas le client.
    """
    async def _wrapper():
        try:
            await coro
        except Exception as e:
            logger.error(
                f"[BG:{label}] Tâche en arrière-plan échouée: {e}",
                exc_info=True,
            )

    task = asyncio.create_task(_wrapper())
    task.set_name(label)
    return task
