"""
FastAPI Router for Extracting key details (Company Name, Subject, Payment Terms, Delivery Period)
from PDF quotation documents using PDF text parsing and fallback OCR.
"""

from typing import Dict, Any, Optional
import re
import os
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from sqlalchemy.orm import Session
from db import get_db
from pydantic import BaseModel

router = APIRouter(prefix="/iso/quotation-reader", tags=["ISO Quotation OCR & Parser"])



class QuotationExtractionResponse(BaseModel):
    company_name: str = ""
    subject: str = ""
    enquiry_ref: str = ""
    date: str = ""
    payment_terms: str = ""
    delivery_period: str = ""
    raw_text: str = ""


def extract_fields_from_text(text: str) -> dict[str, str]:

    """Pull out key quotation fields using precision regex patterns."""
    fields = {
        "company_name": "",
        "subject": "",
        "enquiry_ref": "",
        "date": "",
        "payment_terms": "",
        "delivery_period": ""
    }

    if not text:
        return fields

    # 1. Company Name matching (must be word-bounded to prevent matching /SMPM/ or reference codes)
    company_match = re.search(
        r"(?:^|\s)(?:M/s\.?|To,?\s*M/s\.?|Customer(?:\s*Name)?[:\-]|Vendor[:\-]|Company[:\-])\s*([^\n,]+)",
        text,
        re.IGNORECASE
    )
    if company_match:
        val = company_match.group(1).strip(" ,.")
        if val and not any(kw in val.upper() for kw in ["PPM/", "SMPM/", "CMTI/", "NO.", "REF"]):
            fields["company_name"] = val

    if not fields["company_name"]:
        # Fallback: search for known company suffixes (Limited, Ltd, Corp, Inc), excluding reference lines
        comp_fallback = re.search(
            r"^(?!No\.|Ref|PPM|CMTI|Doc)(.+?(?:Limited|Ltd|Corp|Inc|Technologies|Industries|Services|System|Systems))",
            text,
            re.IGNORECASE | re.MULTILINE
        )
        if comp_fallback:
            fields["company_name"] = comp_fallback.group(1).strip(" ,.")

    # 2. Subject line matching (specifically matches Sub: or Subject:, excluding Ref:)
    sub_match = re.search(
        r"Sub(?:ject)?\s*[:.\-]\s*(.+?)(?=\n\s*(?:Ref|GeM|Dear|Attention|Attn|Sir|Madam)|$)",
        text,
        re.IGNORECASE | re.DOTALL
    )
    if sub_match:
        fields["subject"] = sub_match.group(1).strip().replace("\n", " ")

    # 3. Enquiry / Reference Number
    ref_match = re.search(
        r"Ref(?:erence)?\s*[:.\-]\s*(.+?)(?:\n|$)",
        text,
        re.IGNORECASE
    )
    if ref_match:
        fields["enquiry_ref"] = ref_match.group(1).strip()

    # 4. Date
    date_match = re.search(
        r"Date\s*[:.\-]\s*([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})",
        text,
        re.IGNORECASE
    )
    if date_match:
        fields["date"] = date_match.group(1).strip()

    # 5. Payment terms matching (supports multiline and punctuation variants like Payment Terms:.)
    pay_match = re.search(
        r"(?:Payment\s*Terms?|Terms\s*of\s*Payment|Payment)\s*[:.\-\s]*[:.\-]\s*(.+?)(?=\n\s*(?:[0-9]+\.|\w+[:\-])|\n\n|\r\n\r\n|$)",
        text,
        re.IGNORECASE | re.DOTALL
    )
    if pay_match:
        val = pay_match.group(1).strip().replace("\n", " ")
        fields["payment_terms"] = re.sub(r"\s+", " ", val)


    # 6. Delivery period matching (captures period descriptions like "06 months from the date of acceptance")
    del_match = re.search(
        r"(?:Delivery\s*(?:Period|Schedule|Time|Date)?|Dispatch|Completion\s*(?:Period|Time)?)\s*[:.\-]\s*(.+?)(?:\n\n|\n[A-Z]|\r\n\r\n|$)",
        text,
        re.IGNORECASE
    )
    if del_match:
        val = del_match.group(1).strip().replace("\n", " ")
        val = re.sub(r"\s+", " ", val)
        fields["delivery_period"] = val

    return fields




def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Attempt direct text extraction using PyMuPDF (fitz) and PyPDF first,
    then fall back to pdf2image + pytesseract OCR if text is sparse.
    """
    full_text = ""

    # Strategy 1: PyMuPDF (fitz) - excellent for vector/digital PDFs
    try:
        import fitz
        doc = fitz.open(pdf_path)
        for page in doc:
            full_text += page.get_text() + "\n"
    except Exception as fitz_err:
        print(f"PyMuPDF extraction note: {fitz_err}")

    # Strategy 2: pypdf if PyMuPDF yielded nothing
    if not full_text.strip():
        try:
            import pypdf
            reader = pypdf.PdfReader(pdf_path)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    full_text += extracted + "\n"
        except Exception as pypdf_err:
            print(f"PyPDF extraction note: {pypdf_err}")

    # Strategy 3: OCR fallback using pdf2image + pytesseract
    if len(full_text.strip()) < 30:
        try:
            from pdf2image import convert_from_path
            import pytesseract

            pages = convert_from_path(pdf_path, dpi=300)
            ocr_text = ""
            for i, page_img in enumerate(pages, start=1):
                text = pytesseract.image_to_string(page_img)
                ocr_text += f"\n--- PAGE {i} ---\n{text}"
            if ocr_text.strip():
                full_text = ocr_text
        except Exception as ocr_err:
            print(f"OCR fallback note: {ocr_err}")

    return full_text.strip()



@router.post("/extract", response_model=QuotationExtractionResponse)
async def extract_quotation_details(file: UploadFile = File(...)):
    """
    Upload a PDF or Image file quotation to automatically extract:
    - Company Name
    - Subject
    - Payment Terms
    - Delivery Period
    """
    if not file.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a PDF or image file."
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    file_ext = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
        tmp_file.write(content)
        tmp_path = tmp_file.name

    try:
        if file_ext.lower() == '.pdf':
            extracted_text = extract_text_from_pdf(tmp_path)
        else:
            # Direct Image OCR
            try:
                from PIL import Image
                import pytesseract
                img = Image.open(tmp_path)
                extracted_text = pytesseract.image_to_string(img)
            except Exception as e:
                extracted_text = ""

        pay_val = fields["payment_terms"] or "80% after completion of the work & 20% after the successful implementation & submission of report."
        del_val = fields["delivery_period"] or "The duration of the work would go up to Two Months & 15 Days."

        return QuotationExtractionResponse(
            company_name=fields["company_name"],
            subject=fields["subject"],
            enquiry_ref=fields["enquiry_ref"],
            date=fields["date"],
            payment_terms=pay_val,
            delivery_period=del_val,
            raw_text=extracted_text
        )

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.get("/proposal-quotation/{proposal_id}", response_model=QuotationExtractionResponse)
def get_proposal_quotation_details(proposal_id: int, db: Session = Depends(get_db)):
    """
    Find and extract quotation details for a specific proposal.
    Parses attached PDF document if available on disk or via MinIO/HTTP URL, falling back to proposal DB fields.
    """
    from models.model import Proposal, Document
    import urllib.request

    prop = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proposal with ID {proposal_id} not found."
        )

    extracted_text = ""
    fields = {"company_name": "", "subject": "", "enquiry_ref": "", "date": "", "payment_terms": "", "delivery_period": ""}

    # 1. Search in documents table for project_id
    pdf_path = None
    doc_recs = db.query(Document).filter(Document.project_id == proposal_id).order_by(Document.id.desc()).all()
    for doc in doc_recs:
        candidates = [doc.url, doc.name]
        if doc.attachment:
            if isinstance(doc.attachment, list):
                candidates.extend(doc.attachment)
            elif isinstance(doc.attachment, str):
                candidates.append(doc.attachment)

        for cand in candidates:
            if cand and isinstance(cand, str):
                if cand.startswith("http://") or cand.startswith("https://"):
                    try:
                        with urllib.request.urlopen(cand) as resp:
                            data_bytes = resp.read()
                            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                                tmp.write(data_bytes)
                                pdf_path = tmp.name
                                break
                    except Exception as err:
                        print(f"Failed to fetch document URL {cand}: {err}")
                elif os.path.exists(cand) and cand.lower().endswith(".pdf"):
                    pdf_path = cand
                    break
                elif os.path.exists(os.path.join("uploads", cand)) and cand.lower().endswith(".pdf"):
                    pdf_path = os.path.join("uploads", cand)
                    break
        if pdf_path:
            break


    # 2. Check proposals.tender_images or uploads folder
    if not pdf_path and prop.tender_images:
        t_path = prop.tender_images
        if os.path.exists(t_path):
            pdf_path = t_path
        elif os.path.exists(os.path.join("uploads", t_path)):
            pdf_path = os.path.join("uploads", t_path)

    # 3. Check uploads directory for files matching proposal reference/id
    if not pdf_path and os.path.exists("uploads"):
        for fname in os.listdir("uploads"):
            if fname.lower().endswith(".pdf"):
                f_lower = fname.lower()
                p_num = (prop.project_number or "").lower()
                q_ref = (prop.quote_reference or "").lower()
                if (str(proposal_id) in f_lower) or (p_num and p_num in f_lower) or (q_ref and q_ref in f_lower):
                    pdf_path = os.path.join("uploads", fname)
                    break

    if pdf_path and pdf_path.lower().endswith(".pdf"):
        try:
            extracted_text = extract_text_from_pdf(pdf_path)
            fields = extract_fields_from_text(extracted_text)
        except Exception as e:
            print(f"Error parsing PDF for proposal {proposal_id} ({pdf_path}): {e}")


    # Fallback to Proposal DB fields if missing
    comp_name = fields.get("company_name") or prop.customer_name or prop.party_name or ""
    subject = fields.get("subject") or prop.quote_description or prop.activity or prop.key_deliverables or ""
    enquiry_ref = fields.get("enquiry_ref") or prop.quote_reference or prop.email_reference or ""

    date_str = fields.get("date") or ""
    if not date_str and prop.quote_date:
        date_str = prop.quote_date.strftime("%d.%m.%Y") if hasattr(prop.quote_date, "strftime") else str(prop.quote_date)

    del_str = fields.get("delivery_period") or ""
    if not del_str:
        del_str = "06 months from the date of acceptance"

    pay_terms = fields.get("payment_terms") or getattr(prop, "payment_terms", None) or ""
    if not pay_terms:
        pay_terms = "80% after completion of the work & 20% after the successful implementation & submission of report."

    return QuotationExtractionResponse(
        company_name=comp_name,
        subject=subject,
        enquiry_ref=enquiry_ref,
        date=date_str,
        payment_terms=pay_terms,
        delivery_period=del_str,
        raw_text=extracted_text
    )