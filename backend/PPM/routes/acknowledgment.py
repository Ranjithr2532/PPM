from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
import os
import tempfile

from db import get_db
from models.model import Proposal
from pydantic import BaseModel
from services.acknowledgment_generator import build_document


router = APIRouter(prefix="/acknowledgment", tags=["Acknowledgment"])


class AcknowledgmentRequest(BaseModel):
    proposal_id: int
    kind_attn: Optional[str] = None
    purchase_order_no: Optional[str] = None
    purchase_order_date: Optional[str] = None


@router.post("/generate")
def generate_acknowledgment(
    payload: AcknowledgmentRequest,
    db: Session = Depends(get_db)
):
    """
    Generate acknowledgment document based on proposal ID.
    
    The following fields are auto-filled from the proposal:
    - ref_no: from quote_reference
    - current_date: current date
    - company_name: from customer_name
    - company_address: from address
    - subject: from quote_description or activity
    
    The following fields can be provided by the user (optional):
    - kind_attn: attention person
    - purchase_order_no: purchase order number
    - purchase_order_date: purchase order date
    """
    # Fetch proposal by ID
    proposal = db.query(Proposal).filter(Proposal.id == payload.proposal_id).first()
    
    if not proposal:
        raise HTTPException(
            status_code=404,
            detail=f"Proposal with ID {payload.proposal_id} not found"
        )
    
    # Extract data from proposal
    ref_no = proposal.quote_reference or ""
    
    # Current date in DD.MM.YYYY format
    current_date = datetime.now().strftime("%d.%m.%Y")
    
    company_name = proposal.customer_name or ""
    company_address = proposal.address or ""
    
    # Use quote_description for subject, fallback to activity
    subject = proposal.quote_description or proposal.activity or ""
    
    # User-provided fields with defaults
    kind_attn = payload.kind_attn or ""
    purchase_order_no = payload.purchase_order_no or ""
    purchase_order_date = payload.purchase_order_date or ""
    
    # Generate document
    document = build_document(
        ref_no=ref_no,
        current_date=current_date,
        company_name=company_name,
        company_address=company_address,
        kind_attn=kind_attn,
        subject=subject,
        purchase_order_no=purchase_order_no,
        purchase_order_date=purchase_order_date,
    )
    
    # Save to temporary file
    temp_dir = tempfile.gettempdir()
    # Sanitize company name for filename
    safe_company_name = company_name.replace(' ', '_').replace('/', '_').replace('\\', '_') if company_name else 'company'
    filename = f"acknowledgment_{safe_company_name}_{proposal.id}.docx"
    file_path = os.path.join(temp_dir, filename)
    
    document.save(file_path)
    
    # Return the file
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename
    )


@router.get("/proposal/{proposal_id}")
def get_acknowledgment_data(proposal_id: int, db: Session = Depends(get_db)):
    """
    Get acknowledgment data for a proposal to pre-fill the form.
    """
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    
    if not proposal:
        raise HTTPException(
            status_code=404,
            detail=f"Proposal with ID {proposal_id} not found"
        )
    
    return {
        "ref_no": proposal.quote_reference,
        "company_name": proposal.customer_name,
        "company_address": proposal.address,
        "subject": proposal.quote_description or proposal.activity,
        "order_number": proposal.order_number,
        "order_date": proposal.order_date,
    }
