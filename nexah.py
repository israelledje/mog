import logging
import requests
from django.conf import settings
from flowsms.services.sms.base import BaseSMSProvider

logger = logging.getLogger(__name__)

class NexahProvider(BaseSMSProvider):
    """
    Nexah SMS Provider implementation.
    Documentation: ado SMS API Interfaces
    """

    def __init__(self):
        self.name = 'nexah'
        self.user = getattr(settings, 'NEXAH_USER', '')
        self.password = getattr(settings, 'NEXAH_PASSWORD', '')
        self.api_url = getattr(settings, 'NEXAH_API_URL', 'https://smsvas.com/bulk/public/index.php/api/v1/sendsms')
        self.status_url = getattr(settings, 'NEXAH_STATUS_URL', 'https://smsvas.com/bulk/public/index.php/api/v1/getstatus')

    def send_sms(self, phone: str, content: str, sender_id: str = None, **kwargs) -> dict:
        """
        Send a single SMS via Nexah.
        """
        return self.send_batch([phone], content, sender_id, **kwargs)

    def send_batch(self, recipients: list, content: str, sender_id: str = None, **kwargs) -> dict:
        """
        Send a batch of SMS via Nexah.
        Recipients are joined by commas as per Nexah documentation.
        """
        print(f"[DEBUG] NexahProvider (Django natif) appele pour {len(recipients)} destinataires")
        if not self.user or not self.password:
            logger.error("Nexah credentials missing")
            return {"success": False, "error": "Nexah credentials missing"}

        if not sender_id:
            logger.error("Nexah requires a sender_id")
            return {"success": False, "error": "Sender ID is required"}

        payload = {
            "user": self.user,
            "password": self.password,
            "senderid": sender_id,
            "sms": content,
            "mobiles": ",".join(recipients)
        }

        # Support smsclientid pour le suivi précis des DLR
        if kwargs.get('sms_client_id'):
            payload["smsclientid"] = kwargs.get('sms_client_id')

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

        try:
            logger.debug(f"Sending Nexah SMS to {len(recipients)} recipients")
            response = requests.post(self.api_url, json=payload, headers=headers, timeout=15)
            response_data = response.json()

            # responsecode: 1 is success, anything else is error
            # User provided codes: -10019 (Inactive), -10008 (Balance), etc.
            resp_code = str(response_data.get('responsecode'))
            overall_success = resp_code == '1'
            
            sms_results = response_data.get('sms', [])
            processed_results = []

            # Mapping for common error codes from documentation
            error_mapping = {
                "-10019": "Utilisateur inactif",
                "-10003": "Numéro mobile invalide",
                "-10026": "Limite de Client SMS ID dépassée",
                "-10008": "Solde insuffisant",
            }

            for item in sms_results:
                phone = item.get('mobileno')
                status = item.get('status') # 'success' or 'error'
                msg_id = item.get('messageid')
                err_code = str(item.get('errorcode') or "")
                
                # Use provided error description or map it or fallback to response message
                err_desc = (
                    item.get('errordescription') or 
                    item.get('errordetails') or 
                    error_mapping.get(err_code) or
                    response_data.get('responsemessage') or
                    "Erreur inconnue"
                )

                is_success = status == 'success' and overall_success
                processed_results.append({
                    "to": phone,
                    "status": 200 if is_success else 400,
                    "mapped_status": 'SENT' if is_success else 'FAILED',
                    "response": "Success" if is_success else err_desc,
                    "message_id": msg_id,
                    "error_code": err_code or resp_code if not is_success else ""
                })

            # Fallback if no individual results but overall success
            if not processed_results:
                for phone in recipients:
                    processed_results.append({
                        "to": phone,
                        "status": 200 if overall_success else 400,
                        "mapped_status": 'SENT' if overall_success else 'FAILED',
                        "response": response_data.get('responsemessage') or (error_mapping.get(resp_code) if not overall_success else "Success"),
                        "error_code": resp_code if not overall_success else ""
                    })

            success = overall_success and all(r['status'] == 200 for r in processed_results)

            return {
                "success": success,
                "message_id": response_data.get('messageid'),
                "error": response_data.get('responsemessage') if not success else None,
                "raw_response": response_data,
                "results": processed_results
            }
        except Exception as e:
            logger.exception("Nexah API Connection Error")
            return {
                "success": False, 
                "error": str(e),
                "results": [{"to": phone, "status": 500, "response": str(e)} for phone in recipients]
            }

    def check_status(self, message_id: str) -> str:
        """
        Nexah doesn't support polling efficiently; we rely on Webhooks (DLRCallback).
        Stubbing this to satisfy BaseProvider but it returns 'SENT'.
        """
        return 'SENT'
