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
    async def notify_status_change(package_data: dict, new_status: str):
        """
        Déclenche les notifications automatiques basées sur le changement de statut.
        """
        db = await get_database()
        user = await db.users.find_one({"email": package_data["owner_id"]})
        
        if not user:
            return

        to_phone = user.get("phone")
        push_token = user.get("push_token")
        tracking = package_data.get('tracking_number')

        messages = {
            "pending_reception": f"Votre demande de groupage {tracking} est enregistrée. Fournissez le marquage à votre fournisseur.",
            "received": f"CargoLine : Votre colis {tracking} a été reçu à l'entrepôt de Foshan.",
            "grouped": f"Votre colis {tracking} est maintenant chargé dans un conteneur.",
            "closed": f"Le conteneur contenant votre colis {tracking} est fermé. Départ imminent !",
            "departed": f"Bonne nouvelle ! Votre colis {tracking} a quitté la Chine.",
            "in_transit": f"Votre colis {tracking} est en cours de transport international.",
            "arrived": f"Votre colis {tracking} est arrivé à destination. Prêt pour retrait !",
            "delivered": f"Confirmation : Votre colis {tracking} a été retiré. Merci de votre confiance."
        }

        msg = messages.get(new_status)
        if msg:
            if to_phone:
                await NotificationService.send_whatsapp(to_phone, msg)

            if push_token:
                colis_id = package_data.get("id") or package_data.get("_id")
                await NotificationService.send_push(
                    push_token,
                    "Mise à jour MOG Group",
                    msg,
                    data={
                        "colis_id": str(colis_id) if colis_id else None,
                        "type": "status_change",
                        "status": new_status,
                        "tracking_number": tracking,
                    },
                    owner_email=user.get("email"),
                )

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
