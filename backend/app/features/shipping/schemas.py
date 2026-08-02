from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

class TimelineEvent(BaseModel):
    status: str
    label: str
    timestamp: datetime
    location: Optional[str] = None
    operator: Optional[str] = None

class PackageBase(BaseModel):
    supplier_name: Optional[str] = None
    platform: Optional[str] = "Other"
    order_ref: Optional[str] = None
    supplier_tracking: Optional[str] = None  # Tracking fournisseur (obligatoire à la déclaration)
    description: str
    category: str = "other"  # taxonomie marchandises (electronics, clothing…)
    category_key: str = "standard"  # grille tarifaire simulateur (express, bales…)
    declared_value: float = 0.0
    currency: str = "CNY"
    transport_mode: str = "sea"
    delivery_address: Optional[str] = None
    insurance_enabled: bool = False
    instructions: Optional[str] = None
    payment_status: str = "pending" # pending, waiting_validation, paid, rejected, bank_pending
    payment_method: Optional[str] = None  # om, momo, bank, points
    payment_proof_url: Optional[str] = None
    invoice_status: str = "none" # none, draft, final
    invoice_id: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    client_group_id: Optional[str] = None  # Groupement client d'expédition
    loyalty_points_used: int = 0
    
    # Keeping some logistics fields for operators
    weight_real: float = 0.0
    weight_volumetric: float = 0.0
    dimensions: Optional[dict] = Field(default_factory=lambda: {"l": 0, "w": 0, "h": 0})
    total_price: float = 0.0
    include_vat: bool = False

    @field_validator("declared_value", mode="before")
    @classmethod
    def coerce_declared_value(cls, v):
        if v is None or v == "":
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0


class PackageCreate(PackageBase):
    owner_id: Optional[str] = None
    tracking_number: Optional[str] = None

    @field_validator("supplier_tracking", mode="before")
    @classmethod
    def normalize_supplier_tracking(cls, v):
        if v is None or str(v).strip() == "":
            return None
        return str(v).strip()

    @field_validator("photos", mode="before")
    @classmethod
    def normalize_photos(cls, v):
        if v is None:
            return []
        if len(v) > 3:
            raise ValueError("Maximum 3 photos autorisées à la déclaration")
        return v

class PackageUpdate(BaseModel):
    status: Optional[str] = None
    location: Optional[str] = None

class InvoiceUpdate(BaseModel):
    total_price: float
    include_vat: bool = False

class PackageReceive(BaseModel):
    weight_real: float
    dimensions: dict # {"l": 0, "w": 0, "h": 0}
    nature: Optional[str] = None
    warehouse_location: Optional[str] = "Zone A"
    status: Optional[str] = "received" # received, damaged
    entrepot_id: Optional[str] = None
    transport_mode: Optional[str] = None
    category_key: Optional[str] = None


class PackageAuditUpdate(BaseModel):
    """Mise à jour audit opérateur (colis déjà réceptionné)."""
    weight_real: Optional[float] = None
    dimensions: Optional[dict] = None
    nature: Optional[str] = None
    category_key: Optional[str] = None
    transport_mode: Optional[str] = None
    entrepot_id: Optional[str] = None

class PackageInDB(PackageBase):
    id: str
    tracking_number: str
    owner_id: str
    status: str = "draft"
    nature: Optional[str] = None
    warehouse_location: Optional[str] = None
    current_entrepot_id: Optional[str] = None
    current_entrepot_name: Optional[str] = None
    origin_warehouse_entry: Optional[str] = None
    dest_warehouse_entry: Optional[str] = None
    warehouse_history: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    timeline: List[TimelineEvent] = Field(default_factory=list)
    container_id: Optional[str] = None
    container_number: Optional[str] = None
    groupage_id: Optional[str] = None
    estimated_arrival: Optional[datetime] = None
