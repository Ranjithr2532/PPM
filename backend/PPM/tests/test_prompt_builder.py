import pytest
from ai.prompt_builder import PromptBuilder, prompt_builder


class TestPromptBuilder:
    def test_build_summary_prompt_contains_system_rules_and_data(self):
        """Verifies build_summary_prompt includes system rules and structured context."""
        context = {
            "proposal": {
                "id": 42,
                "customer_name": "M/s. Toyota Industries Engine India Pvt Ltd.",
                "quote_reference": "PPM/SMPM/020/2026-27(11)",
                "quote_amount": "260000"
            },
            "customer": {
                "name": "M/s. Toyota Industries Engine India Pvt Ltd.",
                "gst": "29ABCDE1234F1ZH"
            },
            "payments": [
                {"invoice_no": "INV-001", "amount": "130000", "payment_status": "Paid"}
            ]
        }

        builder = PromptBuilder()
        prompt = builder.build_summary_prompt(context)

        # Assert mandatory rules and sections present
        assert "You are an AI assistant for the Proposal Management System." in prompt
        assert "Answer ONLY using the supplied context." in prompt
        assert "The requested information is not available in the current database." in prompt
        assert "Proposal Overview" in prompt
        assert "Toyota Industries" in prompt
        assert "PPM/SMPM/020/2026-27(11)" in prompt
        assert "INV-001" in prompt

    def test_build_question_prompt_includes_user_question(self):
        """Verifies build_question_prompt formats user question alongside context."""
        context = {
            "proposal": {"id": 42, "quote_amount": "260000"},
            "payments": [{"invoice_no": "INV-001", "payment_status": "Paid"}]
        }
        question = "What is the payment status?"

        prompt = prompt_builder.build_question_prompt(context, question)

        assert "--- USER QUESTION ---" in prompt
        assert "What is the payment status?" in prompt
        assert "INV-001" in prompt
        assert "Never fabricate information." in prompt

    def test_build_document_summary_prompt(self):
        """Verifies build_document_summary_prompt includes document text and section guides."""
        doc_text = "Quotation for Migration support for GD & TNGA Plant. Total cost: Rs. 2,60,000/-"
        prompt = prompt_builder.build_document_summary_prompt(doc_text)

        assert "--- DOCUMENT TEXT ---" in prompt
        assert "Migration support for GD & TNGA Plant" in prompt
        assert "Purpose" in prompt
        assert "Scope" in prompt
        assert "Deliverables" in prompt

    def test_build_remark_summary_prompt_with_list(self):
        """Verifies build_remark_summary_prompt handles remarks list."""
        remarks = [
            {"from_": "Scientist", "remarks_description": "Draft quotation uploaded."},
            {"from_": "Group Head", "remarks_description": "Approved."}
        ]
        prompt = prompt_builder.build_remark_summary_prompt(remarks)

        assert "Draft quotation uploaded." in prompt
        assert "Approved." in prompt
        assert "Key Discussion Points" in prompt
        assert "Unresolved / Pending Remarks & Actions" in prompt
