from fastapi import APIRouter, status
from fastapi.responses import StreamingResponse

from pydantic_schema.quotation_schema import QuotationRequest
from services.quoation_generator import default_filename, generate_quotation_docx

router = APIRouter(prefix="/quotation", tags=["Quotation Generator"])


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
