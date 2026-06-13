import logging
import httpx
from app.core.config import settings
from app.core.database import get_database

class NotificationService:
    @staticmethod
    async def send_whatsapp(to_phone: str, message: str):
        """
        Envoie un message via WhatsApp Cloud API (Meta).
        """
        if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
            logging.warning(f"[WHATSAPP MOCK] Envoi à {to_phone}: {message}")
            return True

        url = f"https://graph.facebook.com/v17.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
            "Content-Type": "application/json",
        }
        
        # Note: Pour WhatsApp Cloud API, l'envoi de messages libres (session) n'est possible que si le client
        # a envoyé un message dans les dernières 24h. Sinon, il faut utiliser un TEMPLATE.
        
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone.replace("+", "").replace(" ", ""),
            "type": "text",
            "text": {"body": message}
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                logging.info(f"[WHATSAPP OK] Message envoyé à {to_phone}")
                return True
            except Exception as e:
                logging.error(f"[WHATSAPP ERR] Échec de l'envoi à {to_phone}: {e}")
                return False

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
