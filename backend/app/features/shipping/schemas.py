from pydantic import BaseModel, Field
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
    description: str
    category: str = "other"
    declared_value: float = 0.0
    currency: str = "CNY"
    transport_mode: str = "sea"
    delivery_address: Optional[str] = None
    insurance_enabled: bool = False
    instructions: Optional[str] = None
    payment_status: str = "pending" # pending, waiting_validation, paid, rejected
    payment_proof_url: Optional[str] = None
    invoice_status: str = "none" # none, draft, final
    invoice_id: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    
    # Keeping some logistics fields for operators
    weight_real: float = 0.0
    weight_volumetric: float = 0.0
    dimensions: Optional[dict] = Field(default_factory=lambda: {"l": 0, "w": 0, "h": 0})
    total_price: float = 0.0
    include_vat: bool = False
    
class PackageCreate(PackageBase):
    owner_id: Optional[str] = None
    tracking_number: Optional[str] = None

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
