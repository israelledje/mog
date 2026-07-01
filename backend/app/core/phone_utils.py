import re

def normalize_phone(phone: str) -> str:
    """Normalise un numéro en format international +XXXXXXXX."""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    if not cleaned.startswith("+"):
        cleaned = f"+{cleaned.lstrip('0')}"
    return cleaned

def is_valid_phone(phone: str) -> bool:
    normalized = normalize_phone(phone)
    digits = re.sub(r"\D", "", normalized)
    return 8 <= len(digits) <= 15
