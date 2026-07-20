from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------
# PROPOSAL BASE
# ---------------------------------------------
class ProposalBase(BaseModel):
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
    center: Optional[str] = None
    co_ordinator_remarks: Optional[str] = None
    closer_report: Optional[str] = None
    technical_completed_year: Optional[str] = None
    financial_completed_year: Optional[str] = None
    dispatch_date: Optional[str] = None
    project_allotment_date: Optional[str] = None
    review_meeting_date: Optional[str] = None
    small_value_project: Optional[str] = None
    ppm_remarks: Optional[str] = None
    project_co_ordinator: Optional[str] = None
    updated_by: Optional[str] = None
    group: Optional[str] = None
    status: Optional[str] = None
    proposals_converted: Optional[str] = None
    if_not_reason: Optional[str] = None

    class Config:
        populate_by_name = True


# CREATE & UPDATE PROPOSAL
class ProposalCreate(ProposalBase):
    pass


class ProposalUpdate(ProposalBase):
    pass


# ---------------------------------------------
# NEW: COORDINATOR UPDATE SCHEMA
# ---------------------------------------------
class CoordinatorUpdate(BaseModel):
    project_id: int
    co_ordinator_remarks: str
    extended_delivery_date: str
    proposal_status: Optional[str] = None
    technical_completed_year: Optional[str] = None
    updated_by: Optional[str] = None
    proposals_converted: Optional[str] = None
    if_not_reason: Optional[str] = None


# ---------------------------------------------
# STAGE SCHEMAS
# ---------------------------------------------
class StageBase(BaseModel):
    name: Optional[str] = None
    position: Optional[int] = None  # NEW
    access: Optional[str] = None      # NEW


class StageCreate(StageBase):
    name: str
    position: int


class StageUpdate(StageBase):
    pass


# ---------------------------------------------
# PAYMENT SCHEMAS
# ---------------------------------------------
class PaymentBase(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    gross_amount: Optional[str] = None
    get_amount: Optional[str] = None
    amount_claimed: Optional[str] = None
    amount_recieved: Optional[str] = None
    recieved_date: Optional[str] = None
    description: Optional[str] = None
    tds: Optional[str] = None
    get_tds: Optional[str] = None
    ld: Optional[str] = None
    bal: Optional[str] = None
    follow_up_status: Optional[str] = None
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    updated_by: Optional[str] = None
    


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(PaymentBase):
    pass


# ---------------------------------------------
# PROGRESS SCHEMAS
# ---------------------------------------------
class ProgressBase(BaseModel):
    remarks: Optional[str] = None
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    updated_by: Optional[str] = None


class ProgressCreate(ProgressBase):
    pass


class ProgressUpdate(ProgressBase):
    pass


class ProposalCoordinatorCreate(BaseModel):
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
    center: Optional[str] = None
    group: Optional[str] = None

    class Config:
        populate_by_name = True


class AcknowledgeUpdate(BaseModel):
    is_acknowledged: bool

# class DynamicTableCreate(BaseModel):
#     project_id: Optional[int] = None
#     header_name: str
#     columns: List[str]
#     rows: List[Dict[str, Any]]
#     created_by: Optional[str] = None

# class DynamicTableUpdate(BaseModel):
#     header_name: Optional[str] = None
#     columns: Optional[List[str]] = None
#     rows: Optional[List[Dict[str, Any]]] = None
    
# class DynamicTableItem(BaseModel):
#     header_name: str
#     columns: List[str]
#     rows: List[Dict[str, Any]]

# class DynamicTableCreate(BaseModel):
#     project_id: Optional[int] = None
#     created_by: Optional[str] = None
#     tables: List[DynamicTableItem]