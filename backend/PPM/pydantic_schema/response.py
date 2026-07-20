from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ---------------------------------------------------------
# PROPOSAL RESPONSE
# ---------------------------------------------------------
class ProposalResponse(BaseModel):
    id: int
    enquiry_date: Optional[str] = None
    customer_type: Optional[str] = None
    customer_name: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone_no: Optional[str] = None
    alternate_contact_details: Optional[str] = None
    request_type: Optional[str] = None
    email_reference: Optional[str] = None
    quote_reference: Optional[str] = None
    quote_description: Optional[str] = None
    quote_date: Optional[str] = None
    quote_amount: Optional[str] = None
    proposal_status: Optional[str] = None

    revised_negotiated: Optional[str] = Field(
        default=None, alias="revised/negotiated"
    )
    revised_negotiated_quote_date: Optional[str] = Field(
        default=None, alias="revised/negotiated_quote_date"
    )
    revised_negotiated_quote_amount: Optional[str] = Field(
        default=None, alias="revised/negotiated_quote_amount"
    )

    quotation_given_by_name: Optional[str] = None
    quotation_given_by_department: Optional[str] = None
    project_number: Optional[str] = None
    party_name: Optional[str] = None
    activity: Optional[str] = None
    key_deliverables: Optional[str] = None
    order_number: Optional[str] = None
    order_date: Optional[str] = None
    delivery_date: Optional[str] = None
    extended_delivery_date: Optional[str] = None
    date_of_actual_commencement: Optional[str] = None
    order_value: Optional[str] = None
    details_of_external_internal_review_meeting: Optional[str] = None
    project_co_ordinator: Optional[str] = None
    center: Optional[str] = None
    co_ordinator_remarks: Optional[str] = None

    # THIS FIELD MUST UPDATE FROM DOCUMENT API
    closer_report: Optional[str] = None

    technical_completed_year: Optional[str] = None
    financial_completed_year: Optional[str] = None
    dispatch_date: Optional[str] = None
    project_allotment_date: Optional[str] = None
    review_meeting_date: Optional[str] = None
    small_value_project: Optional[str] = None
    ppm_remarks: Optional[str] = None
    updated_by: Optional[str] = None

    created_at: datetime
    updated_at: datetime
    group: Optional[str] = None
    is_acknowledged: Optional[bool] = None
    status: Optional[str] = None
    proposals_converted: Optional[str] = None
    if_not_reason: Optional[str] = None
    payments: Optional[List[dict]] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class StageResponse(BaseModel):
    id: int
    name: Optional[str] = None
    position: int                # NEW
    access: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True



# ---------------------------------------------------------
# PAYMENT RESPONSE
# ---------------------------------------------------------
class PaymentResponse(BaseModel):
    id: int
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    gross_amount: Optional[str] = None
    get_amount: Optional[str] = None
    amount_claimed: Optional[str] = None
    amount_recieved: Optional[str] = None
    recieved_date: Optional[str] = None
    tds: Optional[str] = None
    get_tds: Optional[str] = None
    ld: Optional[str] = None
    bal: Optional[str] = None
    follow_up_status: Optional[str] = None
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    updated_by: Optional[str] = None
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


# ---------------------------------------------------------
# DOCUMENT RESPONSE (Updated)
# ---------------------------------------------------------
class DocumentResponse(BaseModel):
    id: int
    name: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    attachment: Optional[List[str]] = None  
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    uploaded_by: Optional[str] = None
    version: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # This is manually computed in /documents API (not in DB)
    closure_report: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------
# PROGRESS RESPONSE
# ---------------------------------------------------------
class ProgressResponse(BaseModel):
    id: int
    remarks: Optional[str] = None
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    updated_by: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True
