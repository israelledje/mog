import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class NexahProvider:
    """
    Nexah SMS Provider implementation adapted for FastAPI.
    """

    def __init__(self):
        self.user = settings.NEXAH_USER
        self.password = settings.NEXAH_PASSWORD
        self.api_url = settings.NEXAH_API_URL
        self.sender_id = settings.NEXAH_SENDER_ID

    async def send_sms(self, phone: str, content: str) -> dict:
        """
        Send a single SMS via Nexah asynchronously using httpx.
        """
        if not self.user or not self.password:
            logger.error("Nexah credentials missing")
            return {"success": False, "error": "Nexah credentials missing"}

        payload = {
            "user": self.user,
            "password": self.password,
            "senderid": self.sender_id,
            "sms": content,
            "mobiles": phone.replace("+", "").replace(" ", "")
        }

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.api_url, json=payload, headers=headers, timeout=15.0)
                response_data = response.json()

                resp_code = str(response_data.get('responsecode'))
                overall_success = resp_code == '1'
                
                if overall_success:
                    logger.info(f"[NEXAH SMS OK] Envoyé à {phone}")
                else:
                    logger.error(f"[NEXAH SMS ERR] Echec envoi {phone}: {response_data}")

                return {
                    "success": overall_success,
                    "response": response_data
                }
        except Exception as e:
            logger.exception("Nexah API Connection Error")
            return {
                "success": False, 
                "error": str(e)
            }
