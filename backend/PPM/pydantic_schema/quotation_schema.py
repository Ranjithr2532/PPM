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
    date: Optional[str] = None
    dept: Optional[str] = None
    email_to: List[str] = Field(default_factory=list)
    email_cc: List[str] = Field(default_factory=list)
    customer_lines: List[str] = Field(default_factory=list)
    kind_attention: Optional[str] = None
    reference: Optional[str] = None
    subject: Optional[str] = None
    sac_code: Optional[str] = None
    scope_intro: Optional[str] = None
    scope_items: List[str] = Field(default_factory=list)
    terms_items: List[str] = Field(default_factory=list)
    tables: List[TableSpec] = Field(default_factory=list)
    signatory_name: Optional[str] = None
    signatory_lines: List[str] = Field(default_factory=list)
    signatories: List[SignatorySpec] = Field(default_factory=list)
    filename: Optional[str] = None
