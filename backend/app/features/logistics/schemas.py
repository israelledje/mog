from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ContainerBase(BaseModel):
    container_number: str
    destination_city: str
    mode: str = "sea" # "sea" ou "air"
    vessel_name: Optional[str] = None
    origin_port: Optional[str] = "Guangzhou"
    departure_date: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None
    total_price: float = 0.0
    include_vat: bool = False
    invoice_status: str = "none" # none, draft, final

class ContainerCreate(ContainerBase):
    pass

class ContainerUpdate(BaseModel):
    status: Optional[str] = None
    vessel_name: Optional[str] = None
    departure_date: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None
    container_number: Optional[str] = None
    destination_city: Optional[str] = None
    mode: Optional[str] = None

class ContainerInDB(ContainerBase):
    id: str
    status: str = "open" # open, closed, in_transit, arrived, distributed
    packages_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
