# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# ---------------------------------------
# CUSTOMER1 SCHEMAS
# ---------------------------------------
class Customer1Base(BaseModel):
    name: str
    customer_type: Optional[str] = None
    email: Optional[List[str]] = []
    phone: Optional[List[str]] = []
    address: Optional[List[str]] = []
    alternate_contact_details: Optional[List[str]] = []
    gst: Optional[List[str]] = []
    pan: Optional[List[str]] = []
    tan: Optional[List[str]] = []


class Customer1Create(Customer1Base):
    pass


class Customer1Update(BaseModel):
    name: Optional[str] = None
    customer_type: Optional[str] = None
    email: Optional[List[str]] = None
    phone: Optional[List[str]] = None
    address: Optional[List[str]] = None
    alternate_contact_details: Optional[List[str]] = None
    gst: Optional[List[str]] = None
    pan: Optional[List[str]] = None
    tan: Optional[List[str]] = None


class Customer1Response(Customer1Base):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
