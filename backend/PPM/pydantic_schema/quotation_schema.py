from typing import List, Optional
from pydantic import BaseModel, Field


class TableSpec(BaseModel):
    title: Optional[str] = ""
    headers: List[str] = Field(default_factory=list)
    rows: List[List[str]] = Field(default_factory=list)


class SignatorySpec(BaseModel):
    name: Optional[str] = ""
    lines: List[str] = Field(default_factory=list)


class QuotationRequest(BaseModel):
    header_code: Optional[str] = "ISO 9001-2015 CMTI/PPBD/001/Rev-00"
    ref_no: Optional[str] = None
    date: Optional[str] = None
    dept: Optional[str] = None
    email_to: List[str] = Field(default_factory=list)
    email_cc: List[str] = Field(default_factory=list)
    customer_lines: List[str] = Field(default_factory=list)
    kind_attention: Optional[str] = None
    salutation: Optional[str] = "Dear Sir,"
    reference: Optional[str] = None
    email_ref: Optional[str] = None
    subject: Optional[str] = None
    item_description: Optional[str] = None
    quote_amount: Optional[str] = None
    sac_code: Optional[str] = None
    scope_intro: Optional[str] = None
    scope_items: List[str] = Field(default_factory=list)
    scope_of_work: List[str] = Field(default_factory=list)
    scope_attachments: List[str] = Field(default_factory=list)
    attachments: List[str] = Field(default_factory=list)
    validity: Optional[str] = None
    payment_terms: Optional[str] = None
    delivery: Optional[str] = None
    contact_details: Optional[str] = None
    commercial_contact: Optional[str] = None
    terms_items: List[str] = Field(default_factory=list)
    tables: List[TableSpec] = Field(default_factory=list)
    internal_cost_tables: List[TableSpec] = Field(default_factory=list)
    signatory_name: Optional[str] = None
    signatory_lines: List[str] = Field(default_factory=list)
    signatories: List[SignatorySpec] = Field(default_factory=list)
    filename: Optional[str] = None
    technical_requirements: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    delivery_time_date: Optional[str] = None
    mode_of_delivery: Optional[str] = None
    supporting_documentation: Optional[str] = None
    standards: Optional[str] = None
    penalty_clause: Optional[str] = None
    claims: Optional[str] = None
    legal_requirements: Optional[str] = None
    other_requirements: Optional[str] = None
