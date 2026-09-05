from typing import Optional
from pydantic import BaseModel, Field

class SettingsBase(BaseModel):
    exchange_rate_cny_xaf_under_1m: float = Field(default=100.0, description="Taux de change pour les paiements de moins de 1M FCFA")
    exchange_rate_cny_xaf_over_1m: float = Field(default=85.0, description="Taux de change pour les paiements de 1M FCFA et plus")
    storage_free_days: int = Field(default=7, description="Jours de franchise de stockage")
    storage_daily_fee: float = Field(default=1000.0, description="Pénalité de stockage par jour de retard")
    air_delay_days: int = Field(default=7, description="Délai estimé Aérien Normal")
    air_express_delay_days: int = Field(default=3, description="Délai estimé Aérien Express")
    sea_delay_days: int = Field(default=45, description="Délai estimé Fret Maritime")
    support_phone: str = Field(default="237694581150", description="Numéro WhatsApp du Support Client")
    cny_rate_updated_at: Optional[str] = Field(default=None, description="Date et heure de dernière mise à jour des taux")
    cny_rate_updated_by: Optional[str] = Field(default=None, description="Auteur de la dernière mise à jour des taux")

class SettingsResponse(SettingsBase):
    pass

class SettingsUpdate(SettingsBase):
    pass

class ExchangeRateUpdate(BaseModel):
    exchange_rate_cny_xaf_under_1m: float = Field(..., gt=0, description="Taux CNY/FCFA pour paiements < 1M FCFA")
    exchange_rate_cny_xaf_over_1m: float = Field(..., gt=0, description="Taux CNY/FCFA pour paiements ≥ 1M FCFA")

