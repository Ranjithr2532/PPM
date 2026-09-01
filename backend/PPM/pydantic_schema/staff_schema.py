from pydantic import BaseModel
from typing import Optional


# ---------------------------------------
# STAFF SCHEMAS
# ---------------------------------------
class StaffBase(BaseModel):
    name: str
    centre_id: Optional[int] = None
    group_id: Optional[int] = None
    designation: Optional[str] = None
    type: Optional[str] = None
    role: Optional[str] = None


class StaffCreate(StaffBase):
    pass


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    centre_id: Optional[int] = None
    group_id: Optional[int] = None
    designation: Optional[str] = None
    type: Optional[str] = None
    role: Optional[str] = None


class StaffResponse(StaffBase):
    pf_id: int
    centre_name: Optional[str] = None
    group_name: Optional[str] = None

    class Config:
        from_attributes = True
