import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ai.context_builder import ContextBuilder, context_builder as default_context_builder
from ai.prompt_builder import PromptBuilder, prompt_builder as default_prompt_builder
from ai.llm_service import LLMService, llm_service as default_llm_service
from models.model import Document

# Set up logging for AIService
logger = logging.getLogger("ai_service")
logger.setLevel(logging.INFO)


class AIService:
    """
    AIService Orchestrator
    ----------------------
    Coordinates data retrieval (ContextBuilder), prompt construction (PromptBuilder),
    and LLM inference (LLMService) to execute AI workflows.

    Design Principles:
    - Single Responsibility: Orchestration and coordination only.
    - Open/Closed Principle: Extensible for new AI operations without altering existing logic.
    - Dependency Injection: Accepts dependencies via __init__.
    - Secure Logging: Logs operational metrics without exposing sensitive context/prompts.
    """

    def __init__(
        self,
        context_builder: Optional[ContextBuilder] = None,
        prompt_builder: Optional[PromptBuilder] = None,
        llm_service: Optional[LLMService] = None,
    ):
        self.context_builder = context_builder or default_context_builder
        self.prompt_builder = prompt_builder or default_prompt_builder
        self.llm_service = llm_service or default_llm_service

    # =========================================================================
    # PUBLIC ORCHESTRATION METHODS
    # =========================================================================

    def generate_proposal_summary(self, db: Session, proposal_id: int) -> Dict[str, Any]:
        """
        Orchestrates the 360-degree proposal summary workflow.
        """
        start_time = time.perf_counter()
        logger.info(f"[AIService] Starting summary generation for proposal_id={proposal_id}")

        try:
            # 1. Fetch real structured database context
            context = self.context_builder.build_proposal_context(db, proposal_id)

            # 2. Build zero-hallucination prompt
            prompt = self.prompt_builder.build_summary_prompt(context)

            # 3. Request LLM completion
            ai_response = self.llm_service.ask(prompt)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(f"[AIService] Summary completed for proposal_id={proposal_id} in {elapsed_ms}ms")

            return self._format_response(
                proposal_id=proposal_id,
                response_text=ai_response,
                execution_time_ms=elapsed_ms
            )

        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[AIService] Error generating summary for proposal_id={proposal_id}: {str(err)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate AI proposal summary due to an internal server error."
            )

    def ask_proposal_question(self, db: Session, proposal_id: int, question: str) -> Dict[str, Any]:
        """
        Orchestrates the project-specific Q&A workflow.
        """
        if not question or not question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question parameter cannot be empty."
            )

        start_time = time.perf_counter()
        logger.info(f"[AIService] Processing Q&A for proposal_id={proposal_id}")

        try:
            # 1. Fetch real structured database context
            context = self.context_builder.build_proposal_context(db, proposal_id)

            # 2. Build question prompt
            prompt = self.prompt_builder.build_question_prompt(context, question)

            # 3. Request LLM completion
            ai_response = self.llm_service.ask(prompt)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(f"[AIService] Q&A completed for proposal_id={proposal_id} in {elapsed_ms}ms")

            return self._format_response(
                proposal_id=proposal_id,
                response_text=ai_response,
                execution_time_ms=elapsed_ms
            )

        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[AIService] Error answering question for proposal_id={proposal_id}: {str(err)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process AI question due to an internal server error."
            )

    def summarize_document(self, db: Session, document_id: int) -> Dict[str, Any]:
        """
        Orchestrates document summarization workflow for an uploaded document record.
        """
        start_time = time.perf_counter()
        logger.info(f"[AIService] Summarizing document_id={document_id}")

        try:
            doc_obj = db.query(Document).filter(Document.id == document_id).first()
            if not doc_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Document with ID {document_id} not found."
                )

            # Extract text or fallback to document description/name
            doc_text = doc_obj.description or doc_obj.name or "No document text available."

            prompt = self.prompt_builder.build_document_summary_prompt(doc_text)
            ai_response = self.llm_service.ask(prompt)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(f"[AIService] Document summary completed for document_id={document_id} in {elapsed_ms}ms")

            return self._format_response(
                proposal_id=doc_obj.project_id,
                response_text=ai_response,
                execution_time_ms=elapsed_ms,
                extra={"document_id": document_id, "file_name": doc_obj.name}
            )

        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[AIService] Error summarizing document_id={document_id}: {str(err)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate document summary."
            )

    def summarize_remarks(self, db: Session, proposal_id: int) -> Dict[str, Any]:
        """
        Orchestrates remarks and chat history summarization workflow.
        """
        start_time = time.perf_counter()
        logger.info(f"[AIService] Summarizing remarks for proposal_id={proposal_id}")

        try:
            context = self.context_builder.build_proposal_context(db, proposal_id)
            remarks_data = context.get("remarks", [])

            prompt = self.prompt_builder.build_remark_summary_prompt(remarks_data)
            ai_response = self.llm_service.ask(prompt)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(f"[AIService] Remarks summary completed for proposal_id={proposal_id} in {elapsed_ms}ms")

            return self._format_response(
                proposal_id=proposal_id,
                response_text=ai_response,
                execution_time_ms=elapsed_ms
            )

        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[AIService] Error summarizing remarks for proposal_id={proposal_id}: {str(err)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate remarks summary."
            )

    def generate_meeting_brief(self, db: Session, proposal_id: int) -> Dict[str, Any]:
        """
        Orchestrates pre-meeting client briefing workflow for a proposal.
        """
        start_time = time.perf_counter()
        logger.info(f"[AIService] Generating meeting brief for proposal_id={proposal_id}")

        try:
            context = self.context_builder.build_proposal_context(db, proposal_id)
            prompt = self.prompt_builder.build_summary_prompt(context)
            ai_response = self.llm_service.ask(prompt)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(f"[AIService] Meeting brief completed for proposal_id={proposal_id} in {elapsed_ms}ms")

            return self._format_response(
                proposal_id=proposal_id,
                response_text=ai_response,
                execution_time_ms=elapsed_ms
            )

        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[AIService] Error generating meeting brief for proposal_id={proposal_id}: {str(err)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate client meeting brief."
            )

    # =========================================================================
    # PRIVATE RESPONSE FORMATTING HELPER
    # =========================================================================

    def _format_response(
        self,
        proposal_id: Optional[int],
        response_text: str,
        execution_time_ms: float,
        extra: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Standardizes AI service response dictionary structure.
        """
        model_name = getattr(self.llm_service, "model", "qwen2.5:7b")

        output = {
            "success": True,
            "proposal_id": proposal_id,
            "response": response_text,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": model_name,
            "execution_time_ms": execution_time_ms,
        }

        if extra:
            output.update(extra)

        return output


# Singleton Instance for global application usage
ai_service = AIService()
