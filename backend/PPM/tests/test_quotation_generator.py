import pytest
from fastapi.testclient import TestClient
from services.quoation_generator import generate_quotation_docx, build_quotation_document
from services.quotation_parser import parse_cmti_quotation_docx


class TestQuotationGeneratorBackend:
    def test_build_cmti_quotation_document_structure(self):
        """Test building full CMTI Quotation docx in memory."""
        data = {
            "ref_no": "PPM/SMPM/020/2026-27(11)",
            "date": "06.05.2026",
            "customer_lines": [
                "M/s. Toyota Industries Engine India Pvt Ltd.",
                "Phase-II, Jigani",
                "Bengaluru-560105."
            ],
            "kind_attention": "Mr. Yousuf & Mr. Lokesha B S",
            "subject": "Quotation for “Migration support for GD & TNGA Plant”.",
            "email_ref": "Your email dated: 26-10-2025",
            "item_description": "Migration support for GD & TNGA Plant",
            "quote_amount": "Rs. 2,60,000/- (Rupees Two Lakhs Sixty thousand only)",
            "scope_of_work": [
                "Software Migration work for GD Plant.",
                "Software Migration work for TNGA Plant.",
                "Testing & deployment cost."
            ],
            "validity": "This quotation is valid till 31/08/2026.",
            "payment_terms": "100% after completion of work & submission of report.",
            "delivery": "1 Month from the date of acceptance of PO."
        }
        buf = generate_quotation_docx(data)
        assert buf is not None
        assert len(buf.getvalue()) > 1000

    def test_parse_cmti_quotation_docx_service(self):
        """Test parse_cmti_quotation_docx extracts all CMTI template fields."""
        data = {
            "ref_no": "PPM/SMPM/020/2026-27(11)",
            "date": "06.05.2026",
            "customer_lines": [
                "M/s. Toyota Industries Engine India Pvt Ltd.",
                "Phase-II, Jigani",
                "Bengaluru-560105."
            ],
            "kind_attention": "Mr. Yousuf & Mr. Lokesha B S",
            "subject": "Quotation for “Migration support for GD & TNGA Plant”.",
            "email_ref": "Your email dated: 26-10-2025"
        }
        docx_bytes = generate_quotation_docx(data).getvalue()
        res = parse_cmti_quotation_docx(docx_bytes, "cmti_sample.docx")

        assert res["ref_no"] == "PPM/SMPM/020/2026-27(11)"
        assert res["date"] == "06.05.2026"
        assert res["kind_attention"] == "Mr. Yousuf & Mr. Lokesha B S"
        assert "Migration support for GD & TNGA Plant" in res["item_description"]

    def test_quotation_upload_parse_api_endpoint(self, client: TestClient):
        """Test POST /quotation/upload-parse API endpoint."""
        data = {
            "ref_no": "PPM/SMPM/099/2026",
            "date": "10.06.2026",
            "subject": "Quotation for High Precision Machining"
        }
        docx_bytes = generate_quotation_docx(data).getvalue()
        files = {
            "file": ("test_quote.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        }
        response = client.post("/quotation/upload-parse", files=files)
        assert response.status_code == 200
        res = response.json()
        assert res["success"] is True
        assert res["data"]["ref_no"] == "PPM/SMPM/099/2026"

    def test_quotation_generate_api_endpoint(self, client: TestClient):
        """Test POST /quotation/generate API endpoint streaming Word docx."""
        payload = {
            "ref_no": "PPM/SMPM/020/2026-27(11)",
            "date": "06.05.2026",
            "customer_lines": ["M/s. Toyota Industries Engine India Pvt Ltd."],
            "subject": "Quotation for Migration support",
            "quote_amount": "260000"
        }
        response = client.post("/quotation/generate", json=payload)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert len(response.content) > 1000

    def test_proposal_generate_api_endpoint(self, client: TestClient):
        """Test POST /Proposal/generate API endpoint streaming Word docx."""
        payload = {
            "date": "27/07/2026",
            "dept": "C-SMPM",
            "customer_lines": ["M/s. Tata Power Solar Systems Limited."],
            "subject": "Proposal on Design and implement a system",
            "scope_items": ["API development for local storage"]
        }
        response = client.post("/Proposal/generate", json=payload)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert len(response.content) > 1000
