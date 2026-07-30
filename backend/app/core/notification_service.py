import logging
from typing import Optional
import httpx
from app.core.config import settings
from app.core.database import get_database

from app.core.nexah_provider import NexahProvider

logger = logging.getLogger(__name__)

class NotificationService:
    @staticmethod
    async def send_whatsapp(to_phone: str, message: str) -> dict:
        """
        Envoie un message via le microservice WhatsApp Web.
        En cas d'échec ou de déconnexion, bascule sur Nexah SMS.
        """
        whatsapp_url = f"{settings.WHATSAPP_SERVICE_URL}/send"
        payload = {
            "to": to_phone,
            "message": message
        }

        whatsapp_error = None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(whatsapp_url, json=payload, timeout=15.0)
                data = response.json() if response.content else {}

                if response.status_code == 200 and data.get("success"):
                    logger.info(f"[WHATSAPP OK] Message envoyé à {to_phone} (id={data.get('messageId')})")
                    return {"success": True, "channel": "whatsapp", "messageId": data.get("messageId")}

                whatsapp_error = data.get("error") or f"HTTP {response.status_code}"
                code = data.get("code")
                if code == "SELF_NUMBER":
                    logger.info(f"[WHATSAPP] Numéro identique au compte connecté ({to_phone}) → fallback SMS")
                else:
                    logger.warning(f"[WHATSAPP ERR] {to_phone}: {whatsapp_error} ({code})")
            except Exception as e:
                whatsapp_error = str(e)
                logger.error(f"[WHATSAPP CONN ERR] Impossible de joindre le service WhatsApp: {e}")

        logger.info(f"[SMS FALLBACK] Tentative d'envoi de SMS à {to_phone} via Nexah")
        nexah = NexahProvider()
        sms_result = await nexah.send_sms(to_phone, message)

        if sms_result.get("success"):
            return {"success": True, "channel": "sms", "whatsapp_error": whatsapp_error}

        return {
            "success": False,
            "channel": None,
            "whatsapp_error": whatsapp_error,
            "sms_error": sms_result.get("error") or sms_result.get("response"),
        }

    @staticmethod
    async def notify_phone(to_phone: Optional[str], message: str) -> dict:
        """Envoie WhatsApp puis SMS Nexah si besoin. Ne lève jamais d'exception."""
        if not to_phone:
            return {"success": False, "error": "no_phone"}
        try:
            return await NotificationService.send_whatsapp(to_phone, message)
        except Exception as e:
            logger.exception(f"[NOTIFY PHONE] Échec pour {to_phone}: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def _owner_user(package_data: dict):
        db = await get_database()
        owner_id = package_data.get("owner_id")
        if not owner_id:
            return None
        return await db.users.find_one({"email": owner_id})

    @staticmethod
    async def notify_colis_created(package_data: dict):
        """Notification à la création réussie d'un colis."""
        user = await NotificationService._owner_user(package_data)
        if not user:
            return
        tracking = package_data.get("tracking_number") or "N/A"
        msg = (
            f"MOG : Votre colis {tracking} a été créé avec succès. "
            f"Il est en attente de réception à Foshan. "
            f"Communiquez le marquage (shipping mark) à votre fournisseur."
        )
        await NotificationService.notify_phone(user.get("phone"), msg)
        if user.get("push_token"):
            await NotificationService.send_push(
                user["push_token"],
                "Colis créé — MOG",
                msg,
                data={
                    "colis_id": str(package_data.get("id") or package_data.get("_id") or ""),
                    "type": "colis_created",
                    "tracking_number": tracking,
                },
                owner_email=user.get("email"),
            )

    @staticmethod
    async def notify_groupage_created(owner_email: str, group_label: str, package_count: int, tracking_numbers: Optional[list] = None):
        """Notification à la création d'un groupage client."""
        db = await get_database()
        user = await db.users.find_one({"email": owner_email})
        if not user:
            return
        refs = ", ".join(tracking_numbers[:5]) if tracking_numbers else f"{package_count} colis"
        if tracking_numbers and len(tracking_numbers) > 5:
            refs += "…"
        msg = (
            f"MOG : Votre groupage « {group_label} » a été créé ({package_count} colis : {refs}). "
            f"Vous serez informé à chaque étape de l'expédition."
        )
        await NotificationService.notify_phone(user.get("phone"), msg)
        if user.get("push_token"):
            await NotificationService.send_push(
                user["push_token"],
                "Groupage créé — MOG",
                msg,
                data={"type": "groupage_created", "label": group_label},
                owner_email=user.get("email"),
            )

    @staticmethod
    async def notify_status_change(package_data: dict, new_status: str):
        """
        Déclenche les notifications automatiques basées sur le changement de statut.
        """
        try:
            user = await NotificationService._owner_user(package_data)
            if not user:
                return

            to_phone = user.get("phone")
            push_token = user.get("push_token")
            tracking = package_data.get("tracking_number") or "N/A"

            messages = {
                "pending_reception": (
                    f"MOG : Votre colis {tracking} est enregistré. "
                    f"Fournissez le marquage à votre fournisseur."
                ),
                "received": f"MOG : Votre colis {tracking} a été reçu à l'entrepôt de Foshan.",
                "grouped": f"MOG : Votre colis {tracking} a été groupé pour expédition.",
                "loaded": (
                    f"MOG : Votre colis {tracking} a été chargé dans un conteneur (groupage)."
                ),
                "closed": (
                    f"MOG : Le conteneur de votre colis {tracking} est clôturé. Départ imminent."
                ),
                "departed": f"MOG : Votre colis {tracking} a quitté la Chine.",
                "in_transit": (
                    f"MOG : Votre colis {tracking} est en expédition vers le Cameroun."
                ),
                "customs": (
                    f"MOG : Votre colis {tracking} est en douane au Cameroun."
                ),
                "arrived": (
                    f"MOG : Votre colis {tracking} est arrivé à l'entrepôt à Douala. "
                    f"Prêt pour retrait !"
                ),
                "distributed": f"MOG : Votre colis {tracking} est disponible pour retrait.",
                "delivered": (
                    f"MOG : Confirmation — votre colis {tracking} a été retiré. Merci de votre confiance."
                ),
            }

            msg = messages.get(new_status)
            if not msg:
                return

            if to_phone:
                await NotificationService.notify_phone(to_phone, msg)

            if push_token:
                colis_id = package_data.get("id") or package_data.get("_id")
                await NotificationService.send_push(
                    push_token,
                    "Mise à jour MOG",
                    msg,
                    data={
                        "colis_id": str(colis_id) if colis_id else None,
                        "type": "status_change",
                        "status": new_status,
                        "tracking_number": tracking,
                    },
                    owner_email=user.get("email"),
                )
        except Exception as e:
            logger.exception(f"[NOTIFY STATUS] Échec pour {package_data.get('tracking_number')}: {e}")

    @staticmethod
    async def send_push(
        token: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
        owner_email: Optional[str] = None,
    ):
        """
        Envoie une notification push via l'API Expo Push.
        Le champ `data` est transmis à l'app pour permettre la navigation au tap.
        Si Expo signale un token invalide (DeviceNotRegistered), on le purge de la BDD
        pour éviter d'envoyer dans le vide à l'avenir.
        """
        if not token:
            return False

        payload = {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
        }
        if data:
            payload["data"] = {k: v for k, v in data.items() if v is not None}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=payload,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    timeout=15.0,
                )
            result = resp.json() if resp.content else {}
            ticket = result.get("data") if isinstance(result.get("data"), dict) else {}
            status = ticket.get("status")

            if resp.status_code == 200 and status != "error":
                logger.info(f"[PUSH OK] Envoyé à {token[:20]}...: {title}")
                return True

            # Purge des tokens invalides
            error_code = (ticket.get("details") or {}).get("error")
            if error_code in ("DeviceNotRegistered", "InvalidCredentials") and owner_email:
                try:
                    db = await get_database()
                    await db.users.update_one(
                        {"email": owner_email},
                        {"$unset": {"push_token": "", "push_platform": ""}},
                    )
                    logger.info(f"[PUSH] Token invalide purgé pour {owner_email} ({error_code})")
                except Exception as purge_err:
                    logger.warning(f"[PUSH] Échec purge token {owner_email}: {purge_err}")

            logger.warning(f"[PUSH ERR] {token[:20]}...: {result}")
            return False
        except Exception as e:
            logger.error(f"[PUSH CONN ERR] Impossible d'envoyer la notification push: {e}")
            return False
