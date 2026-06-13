from PIL import Image, ImageDraw, ImageFont
from datetime import datetime
import os

def apply_watermark(image_path: str, text: str):
    # Charger l'image
    image = Image.open(image_path)
    draw = ImageDraw.Draw(image)
    
    # Définir la police (on utilise une police par défaut)
    try:
        # Sur Windows, Arial est standard. Sinon on utilise la police par défaut.
        font = ImageFont.truetype("arial.ttf", 36)
    except Exception:
        font = ImageFont.load_default()
        
    # Texte à afficher : Tracking + Date
    full_text = f"{text} | {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    
    # Position : en bas à droite avec une marge
    width, height = image.size
    # On estime la taille du texte pour le positionnement (Pillow 10+ uses getbbox)
    bbox = draw.textbbox((0, 0), full_text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = width - text_width - 20
    y = height - text_height - 20
    
    # Dessiner une ombre pour la lisibilité
    draw.text((x+2, y+2), full_text, font=font, fill="black")
    draw.text((x, y), full_text, font=font, fill="white")
    
    # Sauvegarder l'image modifiée
    image.save(image_path)
