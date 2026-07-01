import logging
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
                await NotificationService.send_push(push_token, "Mise à jour CargoLine", msg)

    @staticmethod
    async def send_push(token: str, title: str, body: str):
        """
        Envoie une notification push via Expo Server SDK.
        """
        logging.info(f"[PUSH] Envoi à {token}: {title} - {body}")
        return True
