import time
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Path
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db import get_db
from security.auth import get_current_user
from ai.ai_service import ai_service as default_ai_service, AIService

# Set up logging for AI Routes
logger = logging.getLogger("ai_routes")
logger.setLevel(logging.INFO)

router = APIRouter(
    prefix="/api/v1/ai",
    tags=["AI"]
)


# =========================================================================
# PYDANTIC SCHEMAS
# =========================================================================

class QuestionRequest(BaseModel):
    """Request model for proposal Q&A endpoint."""
    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Natural language question to ask about the proposal",
        example="What is the payment status and remaining balance?"
    )


class StandardAIResponse(BaseModel):
    """Standardized API response wrapper for AI endpoints."""
    success: bool = True
    message: str = "AI response generated successfully."
    data: Dict[str, Any]


class StandardAIErrorResponse(BaseModel):
    """Standardized API error response wrapper for AI endpoints."""
    success: bool = False
    message: str
    error: Optional[Dict[str, Any]] = None


# =========================================================================
# HTTP ENDPOINTS
# =========================================================================

@router.get("/health")
def ai_health_check():
    """
    Health check endpoint for AI Service.
    Does NOT call the LLM engine.
    """
    return {
        "status": "healthy",
        "provider": "ollama",
        "model": "qwen2.5:7b"
    }


@router.get(
    "/proposals/{proposal_id}/summary",
    response_model=StandardAIResponse,
    responses={
        400: {"model": StandardAIErrorResponse},
        401: {"model": StandardAIErrorResponse},
        403: {"model": StandardAIErrorResponse},
        404: {"model": StandardAIErrorResponse},
        500: {"model": StandardAIErrorResponse},
    }
)
def get_proposal_ai_summary(
    proposal_id: int = Path(..., ge=1, description="Unique integer ID of the proposal"),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AIService = Depends(lambda: default_ai_service)
):
    """
    Generates a zero-hallucination 360° AI summary for a specific proposal.
    Requires valid JWT token and proper RBAC permissions.
    """
    start_time = time.perf_counter()
    user_id = current_user.get("sub") or current_user.get("username") or "anonymous"
    logger.info(f"[AIRoutes] GET summary for proposal_id={proposal_id} by user={user_id}")

    try:
        result = service.generate_proposal_summary(db, proposal_id)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(f"[AIRoutes] Completed GET summary for proposal_id={proposal_id} in {elapsed_ms}ms")

        return StandardAIResponse(
            success=True,
            message="Proposal summary generated successfully.",
            data=result
        )
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"[AIRoutes] Exception on proposal_id={proposal_id}: {str(err)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing the AI summary request."
        )


@router.post(
    "/proposals/{proposal_id}/ask",
    response_model=StandardAIResponse,
    responses={
        400: {"model": StandardAIErrorResponse},
        401: {"model": StandardAIErrorResponse},
        403: {"model": StandardAIErrorResponse},
        404: {"model": StandardAIErrorResponse},
        422: {"model": StandardAIErrorResponse},
        500: {"model": StandardAIErrorResponse},
    }
)
def ask_proposal_question(
    body: QuestionRequest,
    proposal_id: int = Path(..., ge=1, description="Unique integer ID of the proposal"),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AIService = Depends(lambda: default_ai_service)
):
    """
    Answers a natural language question about a proposal using strictly retrieved DB records.
    """
    start_time = time.perf_counter()
    user_id = current_user.get("sub") or current_user.get("username") or "anonymous"
    logger.info(f"[AIRoutes] POST ask for proposal_id={proposal_id} by user={user_id}")

    try:
        result = service.ask_proposal_question(db, proposal_id, body.question)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(f"[AIRoutes] Completed POST ask for proposal_id={proposal_id} in {elapsed_ms}ms")

        return StandardAIResponse(
            success=True,
            message="Question answered successfully.",
            data=result
        )
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"[AIRoutes] Exception on POST ask proposal_id={proposal_id}: {str(err)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your question."
        )


@router.post(
    "/documents/{document_id}/summary",
    response_model=StandardAIResponse,
    responses={
        400: {"model": StandardAIErrorResponse},
        401: {"model": StandardAIErrorResponse},
        403: {"model": StandardAIErrorResponse},
        404: {"model": StandardAIErrorResponse},
        500: {"model": StandardAIErrorResponse},
    }
)
def summarize_uploaded_document(
    document_id: int = Path(..., ge=1, description="Unique integer ID of the document"),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AIService = Depends(lambda: default_ai_service)
):
    """
    Generates an AI summary for an uploaded document record.
    """
    start_time = time.perf_counter()
    user_id = current_user.get("sub") or current_user.get("username") or "anonymous"
    logger.info(f"[AIRoutes] POST document summary document_id={document_id} by user={user_id}")

    try:
        result = service.summarize_document(db, document_id)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(f"[AIRoutes] Completed document summary for document_id={document_id} in {elapsed_ms}ms")

        return StandardAIResponse(
            success=True,
            message="Document summary generated successfully.",
            data=result
        )
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"[AIRoutes] Exception on document_id={document_id}: {str(err)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while summarizing the document."
        )


@router.get(
    "/proposals/{proposal_id}/remarks-summary",
    response_model=StandardAIResponse,
    responses={
        400: {"model": StandardAIErrorResponse},
        401: {"model": StandardAIErrorResponse},
        403: {"model": StandardAIErrorResponse},
        404: {"model": StandardAIErrorResponse},
        500: {"model": StandardAIErrorResponse},
    }
)
def get_proposal_remarks_summary(
    proposal_id: int = Path(..., ge=1, description="Unique integer ID of the proposal"),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AIService = Depends(lambda: default_ai_service)
):
    """
    Summarizes the communication remarks / chat history for a proposal.
    """
    start_time = time.perf_counter()
    user_id = current_user.get("sub") or current_user.get("username") or "anonymous"
    logger.info(f"[AIRoutes] GET remarks summary for proposal_id={proposal_id} by user={user_id}")

    try:
        result = service.summarize_remarks(db, proposal_id)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(f"[AIRoutes] Completed remarks summary for proposal_id={proposal_id} in {elapsed_ms}ms")

        return StandardAIResponse(
            success=True,
            message="Remarks summary generated successfully.",
            data=result
        )
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"[AIRoutes] Exception on remarks summary proposal_id={proposal_id}: {str(err)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while summarizing proposal remarks."
        )
