import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from ai.ai_service import AIService


class TestAIService:
    @pytest.fixture
    def mock_context_builder(self):
        builder = MagicMock()
        builder.build_proposal_context.return_value = {
            "proposal": {"id": 42, "customer_name": "Toyota Industries"},
            "customer": {"name": "Toyota Industries"},
            "payments": [],
            "stages": [],
            "progress": [],
            "documents": [],
            "remarks": [],
            "assigned_users": []
        }
        return builder

    @pytest.fixture
    def mock_prompt_builder(self):
        builder = MagicMock()
        builder.build_summary_prompt.return_value = "MOCK SUMMARY PROMPT"
        builder.build_question_prompt.return_value = "MOCK QUESTION PROMPT"
        builder.build_document_summary_prompt.return_value = "MOCK DOC PROMPT"
        builder.build_remark_summary_prompt.return_value = "MOCK REMARKS PROMPT"
        return builder

    @pytest.fixture
    def mock_llm_service(self):
        llm = MagicMock()
        llm.model = "qwen2.5:7b"
        llm.ask.return_value = "Mock AI Generated Response"
        return llm

    def test_generate_proposal_summary_flow(
        self, mock_context_builder, mock_prompt_builder, mock_llm_service
    ):
        """Verifies generate_proposal_summary orchestrates context, prompt, and LLM calls."""
        service = AIService(
            context_builder=mock_context_builder,
            prompt_builder=mock_prompt_builder,
            llm_service=mock_llm_service
        )
        mock_db = MagicMock()

        result = service.generate_proposal_summary(mock_db, proposal_id=42)

        # Verify orchestration calls
        mock_context_builder.build_proposal_context.assert_called_once_with(mock_db, 42)
        mock_prompt_builder.build_summary_prompt.assert_called_once()
        mock_llm_service.ask.assert_called_once_with("MOCK SUMMARY PROMPT")

        # Verify return structure
        assert result["success"] is True
        assert result["proposal_id"] == 42
        assert result["response"] == "Mock AI Generated Response"
        assert result["model"] == "qwen2.5:7b"
        assert "execution_time_ms" in result

    def test_ask_proposal_question_flow(
        self, mock_context_builder, mock_prompt_builder, mock_llm_service
    ):
        """Verifies ask_proposal_question flow."""
        service = AIService(
            context_builder=mock_context_builder,
            prompt_builder=mock_prompt_builder,
            llm_service=mock_llm_service
        )
        mock_db = MagicMock()

        result = service.ask_proposal_question(mock_db, proposal_id=42, question="What is the stage?")

        mock_context_builder.build_proposal_context.assert_called_once_with(mock_db, 42)
        mock_prompt_builder.build_question_prompt.assert_called_once_with(
            mock_context_builder.build_proposal_context.return_value, "What is the stage?"
        )
        mock_llm_service.ask.assert_called_once_with("MOCK QUESTION PROMPT")
        assert result["response"] == "Mock AI Generated Response"

    def test_empty_question_raises_http_400(self):
        """Verifies empty question raises HTTP 400."""
        service = AIService()
        mock_db = MagicMock()
        with pytest.raises(HTTPException) as exc:
            service.ask_proposal_question(mock_db, proposal_id=42, question="   ")

        assert exc.value.status_code == 400
        assert "cannot be empty" in exc.value.detail

    def test_summarize_remarks_flow(
        self, mock_context_builder, mock_prompt_builder, mock_llm_service
    ):
        """Verifies summarize_remarks flow."""
        service = AIService(
            context_builder=mock_context_builder,
            prompt_builder=mock_prompt_builder,
            llm_service=mock_llm_service
        )
        mock_db = MagicMock()

        result = service.summarize_remarks(mock_db, proposal_id=42)

        mock_prompt_builder.build_remark_summary_prompt.assert_called_once_with([])
        mock_llm_service.ask.assert_called_once_with("MOCK REMARKS PROMPT")
        assert result["success"] is True
