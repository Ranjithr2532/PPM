from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ---------------------------------------
# CUSTOMER SCHEMAS
# ---------------------------------------
class CustomerBase(BaseModel):
    name: str
    customer_type: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    tan: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone_no: Optional[str] = None
    alternate_contact_details: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    customer_type: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    tan: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone_no: Optional[str] = None
    alternate_contact_details: Optional[str] = None


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerFromProposalResponse(CustomerBase):
    addresses: list[str] = []

    class Config:
        from_attributes = True
