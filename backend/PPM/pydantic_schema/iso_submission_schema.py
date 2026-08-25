from typing import Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel


class ISOSubmissionBase(BaseModel):
    doc_type: str  # FEASIBILITY, CONTRACT_REVIEW, PROJECT_TEAM
    document_no: str
    proposal_id: Optional[int] = None
    header_data: Optional[Dict[str, Any]] = {}
    form_data: Optional[Dict[str, Any]] = {}
    status: Optional[str] = "DRAFT"  # DRAFT, SUBMITTED, APPROVED, REJECTED
    rejection_comment: Optional[str] = None
    created_by: Optional[int] = None


class ISOSubmissionCreate(ISOSubmissionBase):
    pass


class ISOSubmissionUpdate(BaseModel):
    doc_type: Optional[str] = None
    document_no: Optional[str] = None
    proposal_id: Optional[int] = None
    header_data: Optional[Dict[str, Any]] = None
    form_data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    rejection_comment: Optional[str] = None
    updated_by: Optional[int] = None


class ISOSubmissionStatusUpdate(BaseModel):
    status: str  # APPROVED or REJECTED or DRAFT or SUBMITTED
    rejection_comment: Optional[str] = None
    approved_by: Optional[int] = None


class ISOSubmissionResponse(ISOSubmissionBase):
    id: int
    updated_by: Optional[int] = None
    approved_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
