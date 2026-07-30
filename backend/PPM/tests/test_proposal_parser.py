import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import io

from services.quoation_generator import generate_quotation_docx
from services.quotation_parser import parse_docx_quotation


class TestDocxQuotationParser:
    def test_parse_docx_quotation_success(self):
        """Test parsing structured docx quotation bytes."""
        sample_data = {
            "date": "21/07/2026",
            "dept": "C-SMPM",
            "email_to": ["client@primary.com"],
            "email_cc": ["head@cc.com"],
            "customer_lines": ["Hindalco Industries Ltd", "Plot 10, Industrial Estate", "Bengaluru - 560058"],
            "kind_attention": "Mr. Vikram Sarabhai",
            "reference": "REF/2026/PROJ-01",
            "subject": "Quotation for High-Precision CNC Machining",
            "tables": [{"title": "Costing", "headers": ["Item", "Price"], "rows": [["Fabrication", "450000"]]}]
        }
        docx_bytes = generate_quotation_docx(sample_data).getvalue()
        res = parse_docx_quotation(docx_bytes, "test_quotation.docx")

        assert res["enquiry_date"] == "21/07/2026"
        assert res["customer_name"] == "Hindalco Industries Ltd"
        assert "Plot 10, Industrial Estate" in res["address"]
        assert res["email"] == "client@primary.com"  # Primary email only, not CC
        assert res["alternate_contact_details"] == "Mr. Vikram Sarabhai"
        assert res["email_reference"] == "REF/2026/PROJ-01"
        assert res["quote_reference"] == "REF/2026/PROJ-01"
        assert res["quote_description"] == "Quotation for High-Precision CNC Machining"
        assert res["center"] == "C-SMPM"
        assert res["quote_amount"] == "450000"

    def test_parse_invalid_file_format_raises_valueerror(self):
        """Test parsing non-docx bytes raises ValueError."""
        pdf_bytes = b"%PDF-1.4 Fake PDF Content"
        with pytest.raises(ValueError) as excinfo:
            parse_docx_quotation(pdf_bytes, "invalid.pdf")
        assert "Only Microsoft Word (.docx) files are supported" in str(excinfo.value)

    def test_parse_unrecognized_docx_raises_valueerror(self):
        """Test parsing an unrelated docx file (e.g. essay/resume) raises ValueError."""
        from docx import Document
        doc = Document()
        doc.add_paragraph("This is a generic document about astronomy and space exploration.")
        buf = io.BytesIO()
        doc.save(buf)

        with pytest.raises(ValueError) as excinfo:
            parse_docx_quotation(buf.getvalue(), "essay.docx")
        assert "Invalid proposal document format" in str(excinfo.value)


class TestAddProposalCoordinatorAPI:
    def test_upload_mode_docx_parsing_endpoint(self, client: TestClient):
        """Test POST /proposals/add-proposal-coordinator with mode=upload and valid docx file."""
        sample_data = {
            "date": "15/08/2026",
            "dept": "C-PPM",
            "email_to": ["target@company.com"],
            "customer_lines": ["BHEL Heavy Engineering", "Bengaluru"],
            "kind_attention": "Dr. A. P. J. Abdul Kalam",
            "reference": "REF/BHEL/2026",
            "subject": "Proposal for Aerodynamic Blade Testing"
        }
        docx_bytes = generate_quotation_docx(sample_data).getvalue()

        files = {
            "file": ("proposal_quotation.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        }
        data = {"mode": "upload"}

        response = client.post("/proposals/add-proposal-coordinator", data=data, files=files)

        assert response.status_code in [200, 201]
        res = response.json()
        assert res["success"] is True
        assert res["mode"] == "upload"
        parsed = res["data"]
        assert parsed["customer_name"] == "BHEL Heavy Engineering"
        assert parsed["email"] == "target@company.com"
        assert parsed["enquiry_date"] == "15/08/2026"
        assert parsed["quote_reference"] == "REF/BHEL/2026"

    def test_upload_mode_rejects_pdf_format_400(self, client: TestClient):
        """Test upload mode rejects .pdf files with 400 Bad Request."""
        files = {
            "file": ("document.pdf", b"%PDF-1.5 test content", "application/pdf")
        }
        data = {"mode": "upload"}

        response = client.post("/proposals/add-proposal-coordinator", data=data, files=files)

        assert response.status_code == 400
        assert "Only Microsoft Word (.docx) files are supported" in response.json()["detail"]

    def test_manual_mode_json_creation(self, client: TestClient):
        """Test POST /proposals/add-proposal-coordinator with JSON body creates proposal in DB."""
        payload = {
            "enquiry_date": "2026-07-29",
            "customer_name": "ISRO Satellite Center",
            "address": "HAL Airport Road, Bengaluru",
            "email": "contact@isro.gov.in",
            "quote_reference": "ISRO/PPM/2026/01",
            "quote_description": "Satellite Testing Platform",
            "quote_amount": "1250000",
            "proposal_status": "Submitted"
        }

        response = client.post("/proposals/add-proposal-coordinator", json=payload)

        assert response.status_code == 201
        res = response.json()
        assert res["proposal_id"] is not None
        assert res["data"]["customer_name"] == "ISRO Satellite Center"
