import json
from typing import Dict, Any, List, Union, Optional


class PromptBuilder:
    """
    PromptBuilder Service
    --------------------
    Responsible ONLY for converting structured database context, document text,
    or chat remarks into zero-hallucination, provider-agnostic prompts for LLMs.

    Design Principles:
    - Pure Prompt Formatting: No database queries, no LLM invocations.
    - Strict Zero-Hallucination Framing: Constrains LLM to rely strictly on provided context.
    - Provider Agnostic: Compatible with Qwen2.5, Llama 3.1, Gemma, Mistral, Claude, Gemini, and OpenAI.
    - Modular & Extensible: Simple helpers to format context and build target prompts.
    """

    SYSTEM_RULES = (
        "You are an AI assistant for the Proposal Management System.\n"
        "Answer ONLY using the supplied context.\n"
        "Always respond strictly in English. If the context contains bilingual or non-English text, extract and output exclusively in clear English.\n"
        "Never fabricate information.\n"
        "Never guess.\n"
        "Never estimate.\n"
        "Never predict.\n"
        "Never invent dates.\n"
        "Never invent customer information.\n"
        "Never invent payment details.\n"
        "Never invent proposal stages.\n"
        "Never use your own knowledge.\n"
        "If the answer is not available in the supplied context, respond exactly:\n"
        '"The requested information is not available in the current database."'
    )

    # =========================================================================
    # PUBLIC PROMPT BUILDING METHODS
    # =========================================================================

    def build_summary_prompt(self, context: Dict[str, Any]) -> str:
        """
        Builds a comprehensive 360-degree executive summary prompt for a proposal.

        Args:
            context: Structured dictionary returned by ContextBuilder.

        Returns:
            str: Complete prompt ready to be sent to the LLM.
        """
        formatted_context = self._format_context(context)

        return (
            f"{self.SYSTEM_RULES}\n\n"
            "--- INSTRUCTIONS ---\n"
            "Produce a professional, concise executive summary in GitHub-flavored Markdown.\n"
            "Organize the summary into the following sections ONLY IF relevant data exists in the context:\n"
            "1. Proposal Overview\n"
            "2. Current Status\n"
            "3. Customer\n"
            "4. Progress\n"
            "5. Payments\n"
            "6. Documents\n"
            "7. Pending Remarks\n"
            "8. Important Dates\n\n"
            "DO NOT create empty sections or invent information for missing sections.\n"
            "Use clear bullet points and bold key values.\n\n"
            "--- CONTEXT DATA ---\n"
            f"{formatted_context}\n\n"
            "--- OUTPUT ---"
        )

    def build_question_prompt(self, context: Dict[str, Any], question: str) -> str:
        """
        Builds a single-question Q&A prompt grounded strictly in the project context.

        Args:
            context: Structured dictionary returned by ContextBuilder.
            question: Natural language question asked by the user.

        Returns:
            str: Complete prompt ready for LLM query.
        """
        formatted_context = self._format_context(context)
        clean_question = (question or "").strip()

        return (
            f"{self.SYSTEM_RULES}\n\n"
            "--- INSTRUCTIONS ---\n"
            "Answer the user's question using ONLY the factual data provided in the context below.\n"
            "Provide a concise, direct, and professional answer in Markdown.\n\n"
            "--- CONTEXT DATA ---\n"
            f"{formatted_context}\n\n"
            "--- USER QUESTION ---\n"
            f"{clean_question}\n\n"
            "--- ANSWER ---"
        )

    def build_document_summary_prompt(self, document_text: str) -> str:
        """
        Builds a prompt to summarize extracted document text (e.g. from DOCX/PDF).

        Args:
            document_text: Extracted plain text string of the document.

        Returns:
            str: Complete prompt for document summarization.
        """
        clean_text = (document_text or "").strip()

        return (
            f"{self.SYSTEM_RULES}\n\n"
            "--- INSTRUCTIONS ---\n"
            "Analyze the extracted proposal/quotation document text below and summarize it in Markdown.\n"
            "Include the following sections ONLY if the information is explicitly present in the text:\n"
            "- Purpose\n"
            "- Scope\n"
            "- Important Details\n"
            "- Deliverables\n"
            "- Technical Notes\n\n"
            "Never invent details, scope items, or values not explicitly written in the document text.\n\n"
            "--- DOCUMENT TEXT ---\n"
            f"{clean_text}\n\n"
            "--- DOCUMENT SUMMARY ---"
        )

    def build_remark_summary_prompt(self, remarks: Union[List[Dict[str, Any]], str]) -> str:
        """
        Builds a prompt to summarize remarks and communication chat history.

        Args:
            remarks: List of remarks dictionaries or serialized remarks string.

        Returns:
            str: Complete prompt for remarks digest.
        """
        if isinstance(remarks, list):
            formatted_remarks = json.dumps(remarks, indent=2, default=str)
        else:
            formatted_remarks = str(remarks).strip()

        return (
            f"{self.SYSTEM_RULES}\n\n"
            "--- INSTRUCTIONS ---\n"
            "Summarize the remarks and communication history provided below.\n"
            "Group the output into:\n"
            "1. Key Discussion Points\n"
            "2. Unresolved / Pending Remarks & Actions\n\n"
            "Summarize ONLY actual remarks. Never invent remarks or actions.\n\n"
            "--- REMARKS HISTORY ---\n"
            f"{formatted_remarks}\n\n"
            "--- REMARKS SUMMARY ---"
        )

    # =========================================================================
    # PRIVATE FORMATTING HELPERS
    # =========================================================================

    def _format_context(self, context: Dict[str, Any]) -> str:
        """
        Serializes context dictionary into compact JSON text for prompt inclusion.
        Removes None/empty values to keep prompt token size minimal.
        """
        if not context or not isinstance(context, dict):
            return "No database records provided."

        clean_data = self._clean_empty_keys(context)
        try:
            return json.dumps(clean_data, indent=2, default=str)
        except Exception:
            return str(clean_data)

    def _clean_empty_keys(self, data: Any) -> Any:
        """Recursively removes keys with None or empty values to optimize token count."""
        if isinstance(data, dict):
            return {
                k: self._clean_empty_keys(v)
                for k, v in data.items()
                if v not in (None, "", [], {})
            }
        elif isinstance(data, list):
            return [self._clean_empty_keys(v) for v in data if v not in (None, "", [], {})]
        return data


# Singleton Instance for global service injection
prompt_builder = PromptBuilder()
