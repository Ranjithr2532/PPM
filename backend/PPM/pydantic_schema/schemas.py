from pydantic import BaseModel
from typing import Optional, Any, List
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

    # Attachment fields
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None

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


# ---------------------------------------------------------
# GROUP CHAT SCHEMAS
# ---------------------------------------------------------
class GroupCreate(BaseModel):
    name: str


class GroupResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    head: Optional[str] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None
    unread_count: Optional[int] = 0

    class Config:
        from_attributes = True


class GroupMemberCreate(BaseModel):
    group_id: int
    user_id: int


class GroupMemberResponse(BaseModel):
    id: int
    group_id: int
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GroupMessageCreate(BaseModel):
    group_id: int
    sender_id: int
    message: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None


class GroupMessageResponse(BaseModel):
    id: int
    group_id: int
    sender_id: int
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    message: Optional[str] = None
    created_at: Optional[datetime] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    seen_by: Optional[List[Any]] = None

    class Config:
        from_attributes = True


class MessageSeenCreate(BaseModel):
    message_id: int
    user_id: int


class MessageSeenResponse(BaseModel):
    id: int
    message_id: int
    user_id: int
    user_name: Optional[str] = None
    seen_at: Optional[datetime] = None

    class Config:
        from_attributes = True