from fastapi import APIRouter, status, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from pydantic_schema.quotation_schema import QuotationRequest
from services.quoation_generator import default_filename, generate_quotation_docx
from services.proposal_generator import generate_proposal_docx
from services.quotation_parser import parse_cmti_quotation_docx

router = APIRouter(prefix="/quotation", tags=["Quotation Generator"])


@router.post(
    "/upload-parse",
    status_code=status.HTTP_200_OK,
    summary="Upload & Extract Quotation (.docx) Document Details",
)
async def upload_parse_quotation(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only Microsoft Word (.docx) files are supported."
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    try:
        extracted = parse_cmti_quotation_docx(file_bytes, filename=file.filename)
        return {
            "success": True,
            "filename": file.filename,
            "data": extracted
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/generate",
    status_code=status.HTTP_200_OK,
    summary="Generate Quotation Word Document (.docx)",
)
async def generate_quotation(payload: QuotationRequest):
    data = payload.dict() if hasattr(payload, "dict") else payload.model_dump()
    
    # Determine custom or default filename
    filename = payload.filename
    if not filename:
        date_str = payload.date or ""
        filename = default_filename(payload.customer_lines, date_str)
    
    if not filename.lower().endswith(".docx"):
        filename += ".docx"

    buffer = generate_quotation_docx(data)

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )


proposal_alias_router = APIRouter(prefix="/Proposal", tags=["Proposal Generator"])
proposal_lc_alias_router = APIRouter(prefix="/proposal", tags=["Proposal Generator"])

@proposal_alias_router.post("/generate", status_code=status.HTTP_200_OK)
@proposal_lc_alias_router.post("/generate", status_code=status.HTTP_200_OK)
async def generate_proposal_alias(payload: QuotationRequest):
    data = payload.dict() if hasattr(payload, "dict") else payload.model_dump()
    filename = payload.filename
    if not filename:
        date_str = payload.date or ""
        filename = default_filename(payload.customer_lines, date_str)
    if not filename.lower().endswith(".docx"):
        filename += ".docx"

    buffer = generate_proposal_docx(data)

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )
