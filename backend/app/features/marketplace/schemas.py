from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class ProductVariant(BaseModel):
    id: Optional[str] = None
    name: str
    sku: Optional[str] = None
    price_xaf: Optional[float] = None  # override prix produit si défini
    stock: int = 0
    attributes: dict = Field(default_factory=dict)  # color, size, year…


class MarketplaceProductCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    category: str = "other"  # vehicle | electronics | fashion | other
    price_xaf: float = Field(gt=0)
    currency: str = "XAF"
    images: List[str] = Field(default_factory=list)
    stock: int = 1
    transport_mode: str = "sea"  # sea | air | air_express
    origin_city: str = "Guangzhou"
    specs: dict = Field(default_factory=dict)
    variants: List[ProductVariant] = Field(default_factory=list)
    status: str = "published"  # draft | published | archived
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    cbm: Optional[float] = None


class MarketplaceProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price_xaf: Optional[float] = None
    images: Optional[List[str]] = None
    stock: Optional[int] = None
    transport_mode: Optional[str] = None
    origin_city: Optional[str] = None
    specs: Optional[dict] = None
    variants: Optional[List[ProductVariant]] = None
    status: Optional[str] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    cbm: Optional[float] = None


class MarketplacePurchase(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int = 1
    promo_code: Optional[str] = None
    delivery_city: Optional[str] = "Douala"
    notes: Optional[str] = None


class MarketplaceCheckoutPay(BaseModel):
    method: str  # om | momo | bank
    phone: Optional[str] = None
    reference: Optional[str] = None


class StockAdjust(BaseModel):
    stock: Optional[int] = None
    delta: Optional[int] = None
    variant_id: Optional[str] = None


class ProductReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class PromoCodeCreate(BaseModel):
    code: str
    label: Optional[str] = None
    discount_type: str = "percent"  # percent | fixed
    discount_value: float = Field(gt=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    max_uses: Optional[int] = None
    applicable_to: str = "all"  # all | groupage | marketplace
    min_amount_xaf: float = 0
    active: bool = True


class PromoCodeUpdate(BaseModel):
    label: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    max_uses: Optional[int] = None
    applicable_to: Optional[str] = None
    min_amount_xaf: Optional[float] = None
    active: Optional[bool] = None


class PromoValidateRequest(BaseModel):
    code: str
    amount_xaf: float
    context: str = "groupage"  # groupage | marketplace


class SalesAgentCreate(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    referral_code: Optional[str] = None
    commission_rate_percent: Optional[float] = None  # override global
    active: bool = True


class SalesAgentUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    commission_rate_percent: Optional[float] = None
    active: Optional[bool] = None
    referral_code: Optional[str] = None


class GrowthSettingsUpdate(BaseModel):
    default_commission_rate_percent: Optional[float] = None
    commission_on_marketplace: Optional[bool] = None
    commission_on_groupage: Optional[bool] = None
    commission_on_paid_packages: Optional[bool] = None
    referral_signup_bonus_points: Optional[int] = None
    marketplace_enabled: Optional[bool] = None
    point_value_xaf: Optional[int] = None
    air_kg_per_cbm: Optional[float] = None
    loyalty_tiers: Optional[list] = None
    vip_benefits: Optional[str] = None
    award_on_statuses: Optional[list] = None
