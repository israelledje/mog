import logging
import httpx
from app.core.config import settings
from app.core.database import get_database

from app.core.nexah_provider import NexahProvider

class NotificationService:
    @staticmethod
    async def send_whatsapp(to_phone: str, message: str):
        """
        Envoie un message via le microservice WhatsApp Web.
        En cas d'échec ou de déconnexion, bascule sur Nexah SMS.
        """
        whatsapp_url = f"{settings.WHATSAPP_SERVICE_URL}/send"
        payload = {
            "to": to_phone,
            "message": message
        }

        whatsapp_success = False
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(whatsapp_url, json=payload, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        logging.info(f"[WHATSAPP OK] Message envoyé à {to_phone}")
                        whatsapp_success = True
                    else:
                        logging.warning(f"[WHATSAPP ERR] Echec: {data.get('error')}")
                else:
                    logging.warning(f"[WHATSAPP HTTP ERR] Code: {response.status_code}")
            except Exception as e:
                logging.error(f"[WHATSAPP CONN ERR] Impossible de joindre le service WhatsApp: {e}")

        # Fallback to SMS if WhatsApp failed
        if not whatsapp_success:
            logging.info(f"[SMS FALLBACK] Tentative d'envoi de SMS à {to_phone} via Nexah")
            nexah = NexahProvider()
            await nexah.send_sms(to_phone, message)
            
        return True

    @staticmethod
    async def notify_status_change(package_data: dict, new_status: str):
        """
        Déclenche les notifications automatiques basées sur le changement de statut.
        """
        sender_phone = package_data.get('owner_id') # Souvent l'email ou phone dans ce projet
        # Récupérer l'utilisateur pour avoir son phone et son push token
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
            # 1. WhatsApp
            if to_phone:
                await NotificationService.send_whatsapp(to_phone, msg)
            
            # 2. Push Notification
            if push_token:
                await NotificationService.send_push(push_token, "Mise à jour CargoLine", msg)

    @staticmethod
    async def send_push(token: str, title: str, body: str):
        """
        Envoie une notification push via Expo Server SDK.
        """
        logging.info(f"[PUSH] Envoi à {token}: {title} - {body}")
        # Logique réelle : 
        # from exponent_server_sdk import PushClient, PushMessage
        # client = PushClient()
        # client.publish(PushMessage(to=token, title=title, body=body))
        return True
