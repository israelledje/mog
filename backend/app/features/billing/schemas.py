from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class InvoicePackageItem(BaseModel):
    package_id: str
    transport_mode: Optional[str] = None
    calculated_unit_price: float = 0.0
    manual_unit_price: Optional[float] = None
    weight_or_volume: float = 0.0
    unit: str = "kg"

class InvoiceCreate(BaseModel):
    customer_id: str
    packages: List[InvoicePackageItem]
    total_price: float
    include_vat: bool = False
    discount: float = 0.0
    
class InvoiceUpdate(BaseModel):
    packages: Optional[List[InvoicePackageItem]] = None
    total_price: Optional[float] = None
    include_vat: Optional[bool] = None
    discount: Optional[float] = None
    status: Optional[str] = None

class InvoiceInDB(BaseModel):
    id: str
    invoice_number: str
    customer_id: str
    packages: List[InvoicePackageItem]
    total_price: float
    include_vat: bool
    discount: float = 0.0
    status: str # "draft" or "final"
    payment_status: str # "pending", "paid"
    payment_proof_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
