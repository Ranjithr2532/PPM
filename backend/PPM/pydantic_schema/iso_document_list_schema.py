from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class ISODocumentListBase(BaseModel):
    name: str
    initial: Optional[str] = None
    code: Optional[str] = None
    document_no: Optional[str] = None
    is_active: Optional[bool] = True


class ISODocumentListCreate(ISODocumentListBase):
    pass


class ISODocumentListUpdate(BaseModel):
    name: Optional[str] = None
    initial: Optional[str] = None
    code: Optional[str] = None
    document_no: Optional[str] = None
    is_active: Optional[bool] = None


class ISODocumentListResponse(ISODocumentListBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
