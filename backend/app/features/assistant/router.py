from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import httpx
import os

from app.core.deps import get_current_user
from app.core.database import get_database
from app.core.config import settings

router = APIRouter(prefix="/assistant", tags=["Assistant"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=40)
    locale: Optional[str] = "fr"


class ChatResponse(BaseModel):
    reply: str
    model: str


def _company_context(tarifs: list) -> str:
    tarif_lines = []
    for t in tarifs[:40]:
        mode = t.get("transport_mode", "")
        label = t.get("label", t.get("category_key", ""))
        price = t.get("price")
        unit = t.get("unit", "")
        extra = ""
        if t.get("price_bulk"):
            extra += f" (dès 10: {t['price_bulk']} {unit})"
        if t.get("price_max"):
            extra += f" (jusqu'à {t['price_max']})"
        if t.get("price_high"):
            extra += f" (tier élevé: {t['price_high']})"
        tarif_lines.append(f"- [{mode}] {label}: {price} FCFA / {unit}{extra}")

    tarifs_block = "\n".join(tarif_lines) if tarif_lines else "(grille non chargée — renvoyer vers le simulateur in-app)"

    return f"""Tu es **MOG Assistant**, l'assistant officiel de **{settings.COMPANY_NAME}** ({settings.COMPANY_TAGLINE}).

## Identité
- Société : SARL M.O.G GROUP MULTISERVICE
- Activités : prestations de services, commerce général, import-export Chine ↔ Afrique
- Adresse : Kassalafam, à côté du commissariat du 6e, Douala (Cameroun)
- Téléphones : +237 655 36 76 19 / +237 694 534 159
- Email : contact@moggroupmultiservice.com
- Slogan : « Le futur se construit avec vous et c'est maintenant »

## Ce que tu fais
- Réponds clairement, professionnellement et chaleureusement en français (sauf si le client écrit dans une autre langue).
- Explique les services, tarifs indicatifs, délais, process de déclaration de colis, groupage, paiements, fidélité.
- Guide le client dans l'app : déclarer un colis, simulateur de fret, formulaires de services, documents, suivi.
- Si une estimation précise dépend du poids/volume/catégorie, propose d'utiliser le **Simulateur de Fret** dans l'onglet Expéditions, ou de laisser une demande service.
- Pour les demandes opérationnelles (accueil aéroport, hôtel, traducteur, véhicules, remplissage conteneur), oriente vers les formulaires Services de l'app.

## Services additionnels
1. Assistance client pendant le séjour en Chine
2. Accueil à l'aéroport
3. Inscription étudiant
4. Réservation d'hôtel
5. Traducteur FR/EN/ZH
6. Achat & expédition de véhicules (Afrique centrale & Côte d'Ivoire)
7. Remplissage de conteneur (clients ayant déjà acheté, besoin de groupage/expédition)

## Fidélité
- 100 points / CBM (mer) ou CBM équivalent air (poids taxable / 167)
- 1 point = 20 FCFA de réduction au paiement

## Destinations fréquentes
Cameroun, Gabon, Guinée équatoriale, Congo, RD Congo, Tchad, Côte d'Ivoire.

## Grille tarifaire indicative (FCFA)
{tarifs_block}

## Règles strictes
- Ne invente pas de tarifs hors grille ; si doute, dis que c'est indicatif et recommande devis opérateur.
- Ne révèle jamais de secrets techniques, clés API, ni données d'autres clients.
- Ne donne pas de conseils illégaux (contrebande, fausse déclaration douane).
- Si tu ne sais pas, propose WhatsApp / contact opérateur M.O.G.
- Réponses structurées, concises, utiles (listes courtes quand pertinent).
"""


async def _load_tarifs(db) -> list:
    try:
        cursor = db.tarifs.find({})
        return [t async for t in cursor]
    except Exception:
        return []


@router.post("/chat", response_model=ChatResponse)
async def assistant_chat(
    payload: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    api_key = (settings.DEEPSEEK_API_KEY or os.getenv("DEEPSEEK_API_KEY", "")).strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Assistant temporairement indisponible (clé DeepSeek non configurée).",
        )

    deepseek_url = (settings.DEEPSEEK_API_URL or "https://api.deepseek.com/chat/completions").strip()
    deepseek_model = (settings.DEEPSEEK_MODEL or "deepseek-chat").strip()

    # Ne garder que user/assistant côté client ; system injecté côté serveur
    history = [
        {"role": m.role, "content": m.content.strip()}
        for m in payload.messages
        if m.role in ("user", "assistant") and m.content.strip()
    ]
    if not history or history[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="Le dernier message doit venir de l'utilisateur.")

    # Limiter la taille
    history = history[-20:]
    last = history[-1]["content"]
    if len(last) > 4000:
        raise HTTPException(status_code=400, detail="Message trop long.")

    tarifs = await _load_tarifs(db)
    system_prompt = _company_context(tarifs)

    user_name = current_user.get("full_name") or current_user.get("email") or "Client"
    system_prompt += f"\n\nClient connecté : {user_name}."

    body = {
        "model": deepseek_model,
        "messages": [{"role": "system", "content": system_prompt}, *history],
        "temperature": 0.4,
        "max_tokens": 1200,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                deepseek_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="L'assistant met trop de temps à répondre. Réessayez.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur réseau assistant: {e}")

    if res.status_code >= 400:
        detail = res.text[:300]
        raise HTTPException(status_code=502, detail=f"DeepSeek erreur {res.status_code}: {detail}")

    data = res.json()
    try:
        reply = data["choices"][0]["message"]["content"].strip()
    except Exception:
        raise HTTPException(status_code=502, detail="Réponse DeepSeek invalide")

    if not reply:
        reply = "Je n'ai pas pu formuler une réponse. Reformulez votre question ou contactez un opérateur M.O.G."

    return ChatResponse(reply=reply, model=data.get("model", deepseek_model))
