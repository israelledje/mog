import logging
from typing import Optional
import httpx
from app.core.config import settings
from app.core.database import get_database

from app.core.nexah_provider import NexahProvider

logger = logging.getLogger(__name__)

class NotificationService:
    @staticmethod
    async def send_whatsapp(
        to_phone: str,
        message: str,
        *,
        media_base64: Optional[str] = None,
        mimetype: Optional[str] = None,
        filename: Optional[str] = None,
        media_url: Optional[str] = None,
    ) -> dict:
        """
        Envoie un message via le microservice WhatsApp Web.
        En cas d'échec ou de déconnexion, bascule sur Nexah SMS (texte seul).
        """
        whatsapp_url = f"{settings.WHATSAPP_SERVICE_URL}/send"
        payload: dict = {
            "to": to_phone,
            "message": message,
        }
        if media_base64:
            payload["mediaBase64"] = media_base64
            payload["mimetype"] = mimetype or "image/jpeg"
            payload["filename"] = filename or "colis.jpg"
        elif media_url:
            payload["mediaUrl"] = media_url

        whatsapp_error = None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(whatsapp_url, json=payload, timeout=45.0)
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
    async def notify_phone(
        to_phone: Optional[str],
        message: str,
        *,
        media_base64: Optional[str] = None,
        mimetype: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> dict:
        """Envoie WhatsApp (optionnellement avec image) puis SMS Nexah si besoin."""
        if not to_phone:
            return {"success": False, "error": "no_phone"}
        try:
            return await NotificationService.send_whatsapp(
                to_phone,
                message,
                media_base64=media_base64,
                mimetype=mimetype,
                filename=filename,
            )
        except Exception as e:
            logger.exception(f"[NOTIFY PHONE] Échec pour {to_phone}: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def _owner_user(package_data: dict):
        db = get_database()
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
    def _first_package_photo_media(package_data: dict) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Retourne (base64, mimetype, filename) de la 1re photo du colis si dispo."""
        import base64
        import os
        from app.core.paths import upload_file_path

        photos = package_data.get("photos") or []
        if not photos:
            return None, None, None
        raw = photos[0]
        fname = os.path.basename(str(raw).replace("\\", "/").split("?")[0])
        if not fname:
            return None, None, None
        path = upload_file_path(fname)
        if not os.path.isfile(path):
            return None, None, None
        try:
            with open(path, "rb") as f:
                data = f.read()
            # Limite ~4 Mo pour WhatsApp Web
            if len(data) > 4_500_000:
                logger.warning(f"[NOTIFY] Photo trop lourde ignorée: {fname}")
                return None, None, None
            ext = fname.lower().rsplit(".", 1)[-1] if "." in fname else "jpg"
            mime = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "webp": "image/webp",
            }.get(ext, "image/jpeg")
            return base64.b64encode(data).decode("ascii"), mime, fname
        except Exception as e:
            logger.warning(f"[NOTIFY] Lecture photo échouée ({fname}): {e}")
            return None, None, None

    @staticmethod
    async def notify_warehouse_receive(
        package_data: dict,
        *,
        entrepot_name: str,
        entrepot_city: str = "",
        entrepot_type: str = "origin",
        new_status: str = "received",
    ) -> dict:
        """Notifie le client après réception d'office en entrepôt (WhatsApp + photo si possible)."""
        try:
            user = await NotificationService._owner_user(package_data)
            if not user:
                return {"success": False, "error": "owner_not_found"}

            tracking = package_data.get("tracking_number") or "N/A"
            place = entrepot_name or entrepot_city or "entrepôt MOG"
            if entrepot_type == "destination":
                msg = (
                    f"MOG : Votre colis {tracking} est arrivé à {place}. "
                    f"Il est disponible pour retrait / formalités."
                )
            else:
                msg = (
                    f"MOG : Votre colis {tracking} a été réceptionné à {place}. "
                    f"Il est désormais en stock chez MOG."
                )

            media_b64, mime, fname = NotificationService._first_package_photo_media(package_data)
            result = await NotificationService.notify_phone(
                user.get("phone"),
                msg,
                media_base64=media_b64,
                mimetype=mime,
                filename=fname,
            )

            if user.get("push_token"):
                await NotificationService.send_push(
                    user["push_token"],
                    "Réception MOG",
                    msg,
                    data={
                        "colis_id": str(package_data.get("id") or package_data.get("_id") or ""),
                        "type": "warehouse_receive",
                        "status": new_status,
                        "tracking_number": tracking,
                    },
                    owner_email=user.get("email"),
                )
            return result
        except Exception as e:
            logger.exception(f"[NOTIFY WAREHOUSE] Échec: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def notify_groupage_created(owner_email: str, group_label: str, package_count: int, tracking_numbers: Optional[list] = None):
        """Notification à la création d'un groupage client."""
        db = get_database()
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
    def _status_message(new_status: str, tracking: str, container_number: str = "", count: int = 1) -> Optional[str]:
        ref = tracking if count == 1 else f"{count} colis ({tracking})"
        group_bit = f" (groupage {container_number})" if container_number else ""
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
                f"MOG : Le conteneur de votre {ref}{group_bit} est clôturé. Départ imminent."
            ),
            "departed": f"MOG : Votre {ref}{group_bit} a quitté la Chine.",
            "in_transit": (
                f"MOG : Votre {ref}{group_bit} est en expédition vers le Cameroun."
            ),
            "customs": (
                f"MOG : Votre {ref}{group_bit} est en douane au Cameroun."
            ),
            "arrived": (
                f"MOG : Votre {ref}{group_bit} est arrivé à l'entrepôt à Douala. "
                f"Prêt pour retrait !"
            ),
            "distributed": f"MOG : Votre {ref}{group_bit} est disponible pour retrait.",
            "delivered": (
                f"MOG : Confirmation — votre colis {tracking} a été retiré. Merci de votre confiance."
            ),
        }
        return messages.get(new_status)

    @staticmethod
    async def notify_status_change(package_data: dict, new_status: str, container_number: str = ""):
        """
        Déclenche les notifications automatiques basées sur le changement de statut.
        """
        try:
            user = await NotificationService._owner_user(package_data)
            if not user:
                logger.warning(
                    f"[NOTIFY STATUS] Propriétaire introuvable pour {package_data.get('tracking_number')}"
                )
                return {"success": False, "error": "owner_not_found"}

            to_phone = user.get("phone")
            push_token = user.get("push_token")
            tracking = package_data.get("tracking_number") or "N/A"
            msg = NotificationService._status_message(new_status, tracking, container_number)
            if not msg:
                return {"success": False, "error": "no_message_for_status"}

            result = {"success": False, "channel": None, "phone": to_phone}
            if to_phone:
                result = await NotificationService.notify_phone(to_phone, msg)
            else:
                logger.warning(f"[NOTIFY STATUS] Pas de téléphone pour {user.get('email')}")
                result = {"success": False, "error": "no_phone"}

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
            return result
        except Exception as e:
            logger.exception(f"[NOTIFY STATUS] Échec pour {package_data.get('tracking_number')}: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def notify_groupage_packages_status(
        packages: list,
        new_status: str,
        container_number: str = "",
    ) -> dict:
        """
        Notifie 1 fois par client (évite le spam SMS si plusieurs colis).
        """
        by_owner: dict = {}
        for pkg in packages:
            email = pkg.get("owner_id")
            if email:
                by_owner.setdefault(email, []).append(pkg)

        sent = 0
        failed = 0
        skipped = 0
        details = []

        for email, pkgs in by_owner.items():
            trackings = [p.get("tracking_number") for p in pkgs if p.get("tracking_number")]
            tracking_preview = ", ".join(trackings[:3]) if trackings else "N/A"
            if len(trackings) > 3:
                tracking_preview += "…"

            user = await NotificationService._owner_user(pkgs[0])
            if not user:
                skipped += 1
                details.append({"email": email, "ok": False, "error": "owner_not_found"})
                continue

            msg = NotificationService._status_message(
                new_status,
                tracking_preview,
                container_number,
                count=len(pkgs),
            )
            if not msg:
                skipped += 1
                continue

            phone = user.get("phone")
            if not phone:
                skipped += 1
                details.append({"email": email, "ok": False, "error": "no_phone"})
                logger.warning(f"[NOTIFY GROUPAGE] Pas de téléphone pour {email}")
                continue

            result = await NotificationService.notify_phone(phone, msg)
            if result.get("success"):
                sent += 1
            else:
                failed += 1
            details.append({
                "email": email,
                "ok": bool(result.get("success")),
                "channel": result.get("channel"),
                "error": result.get("error") or result.get("sms_error") or result.get("whatsapp_error"),
            })

            if user.get("push_token"):
                await NotificationService.send_push(
                    user["push_token"],
                    "Mise à jour MOG",
                    msg,
                    data={
                        "type": "groupage_status",
                        "status": new_status,
                        "container_number": container_number,
                    },
                    owner_email=email,
                )

        return {
            "owners": len(by_owner),
            "sent": sent,
            "failed": failed,
            "skipped": skipped,
            "details": details,
        }

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
                    db = get_database()
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
