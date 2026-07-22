from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RemarksBase(BaseModel):
    from_: Optional[str] = None
    to: Optional[str] = None
    project_id: Optional[int] = None
    remarks_description: Optional[str] = None
    
    # Message delivery & read status
    is_delivered: Optional[bool] = True
    delivered_at: Optional[datetime] = None
    message_seen: Optional[bool] = False
    message_seen_at: Optional[datetime] = None

    # Reply details & replyer info
    respond_to_remarks: Optional[str] = None
    replyer: Optional[str] = None
    replied_at: Optional[datetime] = None

    # Reply delivery & read status
    reply_delivered: Optional[bool] = True
    reply_delivered_at: Optional[datetime] = None
    reply_seen: Optional[bool] = False
    reply_seen_at: Optional[datetime] = None

class RemarksCreate(RemarksBase):
    pass

class RemarksUpdate(RemarksBase):
    pass

class RemarksResponse(RemarksBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TransitionResponse(RemarksBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True