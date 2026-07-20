from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RemarksBase(BaseModel):
    from_: Optional[str] = None
    to: Optional[str] = None
    project_id: Optional[int] = None
    remarks_description: Optional[str] = None
    respond_to_remarks: Optional[str] = None
    message_seen: Optional[bool] = False
    replyer: Optional[str] = None
    reply_seen: Optional[bool] = False

class RemarksCreate(RemarksBase):
    pass

class RemarksUpdate(RemarksBase):
    pass

class RemarksResponse(RemarksBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TransitionResponse(BaseModel):
    id: int
    from_: Optional[str] = None
    to: Optional[str] = None
    project_id: Optional[int] = None
    remarks_description: Optional[str] = None
    respond_to_remarks: Optional[str] = None
    message_seen: Optional[bool] = False
    replyer: Optional[str] = None
    reply_seen: Optional[bool] = False
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True