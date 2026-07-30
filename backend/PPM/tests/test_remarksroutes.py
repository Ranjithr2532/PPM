import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.model import Remarks, Proposal
from tests.factories import (
    create_user_factory,
    create_proposal_factory,
    create_remark_factory,
)
from tests.utils import generate_dummy_file


# ============================================================================
# 1. POST /Remarkss/upload-attachment
# ============================================================================
class TestUploadAttachment:
    def test_upload_attachment_success(self, client: TestClient):
        """Test successful attachment file upload to MinIO."""
        file_tuple = generate_dummy_file("diagram report.png", b"fake image bytes", "image/png")
        response = client.post("/Remarkss/upload-attachment", files={"file": file_tuple[1]})

        assert response.status_code == 200
        data = response.json()
        assert "attachment_url" in data
        assert data["attachment_name"] == "diagram report.png"
        assert data["attachment_type"] == "image/png"
        assert "diagram_report.png" in data["attachment_url"]

    def test_upload_attachment_sanitizes_filename_spaces(self, client: TestClient):
        """Test spaces in filename are sanitized with underscores."""
        file_tuple = generate_dummy_file("my test pdf.pdf", b"%PDF data", "application/pdf")
        response = client.post("/Remarkss/upload-attachment", files={"file": file_tuple[1]})

        assert response.status_code == 200
        data = response.json()
        assert "my_test_pdf.pdf" in data["attachment_url"]

    def test_upload_attachment_missing_file_422(self, client: TestClient):
        """Test request without file payload returns 422 Unprocessable Entity."""
        response = client.post("/Remarkss/upload-attachment")
        assert response.status_code == 422


# ============================================================================
# 2. PATCH /Remarkss/{id}/mark-seen
# ============================================================================
class TestMarkMessageSeen:
    def test_mark_message_seen_success(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test marking a remark message as seen."""
        remark = create_remark_factory(db_session, project_id=test_proposal.id, message_seen=False)
        assert remark.message_seen is False

        response = client.patch(f"/Remarkss/{remark.id}/mark-seen")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Marked as seen"
        assert data["id"] == remark.id
        assert data["seen_at"] is not None

        # Verify DB state
        db_session.refresh(remark)
        assert remark.message_seen is True
        assert remark.message_seen_at is not None

    def test_mark_message_seen_not_found_404(self, client: TestClient):
        """Test marking non-existent remark returns 404."""
        response = client.patch("/Remarkss/99999/mark-seen")
        assert response.status_code == 404
        assert response.json()["detail"] == "Not found"

    def test_mark_message_seen_invalid_id_422(self, client: TestClient):
        """Test passing non-integer ID returns 422."""
        response = client.patch("/Remarkss/invalid_id/mark-seen")
        assert response.status_code == 422


# ============================================================================
# 3. PATCH /Remarkss/{id}/mark-reply-seen
# ============================================================================
class TestMarkReplySeen:
    def test_mark_reply_seen_success(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test marking a remark reply as seen."""
        remark = create_remark_factory(
            db_session,
            project_id=test_proposal.id,
            respond_to_remarks="Reply text",
            reply_seen=False
        )

        response = client.patch(f"/Remarkss/{remark.id}/mark-reply-seen")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Reply marked as seen"
        assert data["id"] == remark.id
        assert data["reply_seen_at"] is not None

        # Verify DB state
        db_session.refresh(remark)
        assert remark.reply_seen is True
        assert remark.reply_seen_at is not None

    def test_mark_reply_seen_not_found_404(self, client: TestClient):
        """Test marking reply seen for non-existent remark returns 404."""
        response = client.patch("/Remarkss/88888/mark-reply-seen")
        assert response.status_code == 404


# ============================================================================
# 4. GET /Remarkss/unread_count
# ============================================================================
class TestUnreadRemarksCount:
    def test_unread_count_no_user_name_returns_zero(self, client: TestClient):
        """Test request without user_name query parameter returns 0 unread count."""
        response = client.get("/Remarkss/unread_count")
        assert response.status_code == 200
        assert response.json() == {"unread_count": 0}

    def test_unread_count_calculation_for_recipient(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test unread count accurately calculates unread proposal chats for recipient."""
        # Remark 1 to Dr. Scientist B (Unseen)
        create_remark_factory(
            db_session,
            from_="Admin",
            to="Dr. Scientist B",
            project_id=test_proposal.id,
            message_seen=False
        )

        response = client.get(
            "/Remarkss/unread_count",
            params={"user_name": "Dr. Scientist B", "user_role": "scientist", "user_group": "SMPM"}
        )
        assert response.status_code == 200
        assert response.json()["unread_count"] == 1

    def test_unread_count_admin_role(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test unread count for admin role matching remarks addressed to admin."""
        create_remark_factory(
            db_session,
            from_="Scientist X",
            to="admin",
            project_id=test_proposal.id,
            message_seen=False
        )

        response = client.get(
            "/Remarkss/unread_count",
            params={"user_name": "System Administrator", "user_role": "admin"}
        )
        assert response.status_code == 200
        assert response.json()["unread_count"] == 1

    def test_unread_count_grouphead_role(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test unread count for Group Head role (GH / GroupHead)."""
        create_remark_factory(
            db_session,
            from_="Scientist Y",
            to="gh",
            project_id=test_proposal.id,
            message_seen=False
        )

        response = client.get(
            "/Remarkss/unread_count",
            params={"user_name": "GH User", "user_role": "grouphead", "user_group": "SMPM"}
        )
        assert response.status_code == 200
        assert response.json()["unread_count"] == 1

    def test_unread_count_reply_unseen_for_sender(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test unread count increments when original sender has unseen reply."""
        create_remark_factory(
            db_session,
            from_="Alice",
            to="Bob",
            project_id=test_proposal.id,
            message_seen=True,
            respond_to_remarks="Bob's reply to Alice",
            reply_seen=False
        )

        response = client.get(
            "/Remarkss/unread_count",
            params={"user_name": "Alice", "user_role": "scientist"}
        )
        assert response.status_code == 200
        assert response.json()["unread_count"] == 1


# ============================================================================
# 5. POST /Remarkss/
# ============================================================================
class TestCreateRemarks:
    def test_create_remark_success(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test creating a new proposal remark."""
        payload = {
            "from_": "Scientist A",
            "to": "Group Head",
            "project_id": test_proposal.id,
            "remarks_description": "Please review budget breakdown.",
            "attachment_url": "http://minio/doc.pdf",
            "attachment_name": "doc.pdf",
            "attachment_type": "application/pdf"
        }

        response = client.post("/Remarkss/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None
        assert data["from_"] == payload["from_"]
        assert data["to"] == payload["to"]
        assert data["project_id"] == test_proposal.id
        assert data["remarks_description"] == payload["remarks_description"]

    def test_create_remark_proposal_not_found_404(self, client: TestClient):
        """Test creating remark for non-existent proposal ID returns 404."""
        payload = {
            "from_": "Scientist A",
            "to": "Admin",
            "project_id": 99999,
            "remarks_description": "Non existent proposal test"
        }
        response = client.post("/Remarkss/", json=payload)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    @pytest.mark.parametrize("invalid_payload,expected_status", [
        ({"project_id": "invalid_id"}, 422),
        ({"project_id": None}, 404),
    ])
    def test_create_remark_validation_errors(self, client: TestClient, invalid_payload, expected_status):
        """Test invalid data types return validation errors."""
        response = client.post("/Remarkss/", json=invalid_payload)
        assert response.status_code == expected_status


# ============================================================================
# 6. GET /Remarkss/
# ============================================================================
class TestGetAllRemarks:
    def test_get_all_remarks_empty(self, client: TestClient):
        """Test fetching remarks when database is empty returns empty list."""
        response = client.get("/Remarkss/")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_all_remarks_filter_by_project_id(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test filtering remarks by project_id."""
        prop2 = create_proposal_factory(db_session, quote_reference="REF/2026/002")

        r1 = create_remark_factory(db_session, project_id=test_proposal.id, remarks_description="Prop 1 remark")
        r2 = create_remark_factory(db_session, project_id=prop2.id, remarks_description="Prop 2 remark")

        response = client.get("/Remarkss/", params={"project_id": test_proposal.id})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == r1.id

    def test_get_all_remarks_unread_only_filter(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test fetching unread-only remarks for a specific user."""
        r_unread = create_remark_factory(
            db_session,
            from_="Sender",
            to="Recipient User",
            project_id=test_proposal.id,
            message_seen=False
        )
        r_read = create_remark_factory(
            db_session,
            from_="Sender",
            to="Recipient User",
            project_id=test_proposal.id,
            message_seen=True
        )

        response = client.get(
            "/Remarkss/",
            params={"unread_only": True, "user_name": "Recipient User", "user_role": "scientist"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == r_unread.id


# ============================================================================
# 7. GET /Remarkss/chat-history
# ============================================================================
class TestGetChatHistory:
    def test_chat_history_bidirectional(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test bidirectional chat history retrieval between user1 and user2."""
        r1 = create_remark_factory(db_session, from_="UserA", to="UserB", project_id=test_proposal.id)
        r2 = create_remark_factory(db_session, from_="UserB", to="UserA", project_id=test_proposal.id)

        response = client.get(
            "/Remarkss/chat-history",
            params={"user1": "UserA", "user2": "UserB", "project_id": test_proposal.id}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        ids = [item["id"] for item in data]
        assert r1.id in ids
        assert r2.id in ids

    def test_chat_history_admin_alias_expansion(self, client: TestClient, db_session: Session, test_proposal: Proposal, test_user_admin):
        """Test chat history resolves admin user name automatically when 'admin' is specified."""
        r1 = create_remark_factory(db_session, from_=test_user_admin.name, to="Scientist B", project_id=test_proposal.id)

        response = client.get(
            "/Remarkss/chat-history",
            params={"user1": "admin", "user2": "Scientist B", "project_id": test_proposal.id}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["id"] == r1.id

    def test_chat_history_cursor_pagination(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test chat history before_id and limit pagination parameters."""
        r_list = [
            create_remark_factory(db_session, from_="Sender", to="Receiver", project_id=test_proposal.id, remarks_description=f"Msg {i}")
            for i in range(5)
        ]

        # Fetch with limit=2
        response = client.get(
            "/Remarkss/chat-history",
            params={"user1": "Sender", "user2": "Receiver", "project_id": test_proposal.id, "limit": 2}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        # Fetch before_id
        mid_id = r_list[3].id
        response_before = client.get(
            "/Remarkss/chat-history",
            params={"user1": "Sender", "user2": "Receiver", "project_id": test_proposal.id, "before_id": mid_id}
        )
        assert response_before.status_code == 200
        data_before = response_before.json()
        for item in data_before:
            assert item["id"] < mid_id


# ============================================================================
# 8. GET /Remarkss/{id}
# ============================================================================
class TestGetRemarkById:
    def test_get_remark_by_id_success(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test retrieving single remark details by valid ID."""
        remark = create_remark_factory(db_session, project_id=test_proposal.id, remarks_description="Detail test")

        response = client.get(f"/Remarkss/{remark.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == remark.id
        assert data["remarks_description"] == "Detail test"

    def test_get_remark_by_id_not_found_404(self, client: TestClient):
        """Test non-existent remark ID returns 404."""
        response = client.get("/Remarkss/77777")
        assert response.status_code == 404
        assert response.json()["detail"] == "Not found"


# ============================================================================
# 9. PUT /Remarkss/{id}
# ============================================================================
class TestUpdateRemarks:
    def test_update_remark_text_success(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test updating remark text description."""
        remark = create_remark_factory(db_session, project_id=test_proposal.id, remarks_description="Old description")

        payload = {"remarks_description": "Updated description text"}
        response = client.put(f"/Remarkss/{remark.id}", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["remarks_description"] == "Updated description text"

        db_session.refresh(remark)
        assert remark.remarks_description == "Updated description text"

    def test_update_remark_reply_flow(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test sending a reply to a remark auto-sets delivery and seen fields."""
        remark = create_remark_factory(
            db_session,
            from_="Scientist A",
            to="Group Head",
            project_id=test_proposal.id,
            remarks_description="Question regarding test timeline",
            message_seen=False
        )

        reply_payload = {
            "respond_to_remarks": "Testing can start on Monday.",
            "from_": "Group Head",
            "replyer": "Group Head"
        }

        response = client.put(f"/Remarkss/{remark.id}", json=reply_payload)
        assert response.status_code == 200

        db_session.refresh(remark)
        assert remark.respond_to_remarks == "Testing can start on Monday."
        assert remark.replyer == "Group Head"
        assert remark.replied_at is not None
        assert remark.reply_delivered is True
        assert remark.message_seen is True
        assert remark.reply_seen is False

    def test_update_remark_not_found_404(self, client: TestClient):
        """Test updating non-existent remark returns 404."""
        response = client.put("/Remarkss/66666", json={"remarks_description": "Ghost remark"})
        assert response.status_code == 404


# ============================================================================
# 10. DELETE /Remarkss/{id}
# ============================================================================
class TestDeleteRemarks:
    def test_delete_remark_success(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test deleting a remark by ID."""
        remark = create_remark_factory(db_session, project_id=test_proposal.id)

        response = client.delete(f"/Remarkss/{remark.id}")
        assert response.status_code == 200
        assert response.json()["message"] == "Deleted successfully"

        # Verify DB deletion
        deleted_item = db_session.query(Remarks).filter(Remarks.id == remark.id).first()
        assert deleted_item is None

    def test_delete_remark_not_found_404(self, client: TestClient):
        """Test deleting non-existent remark returns 404."""
        response = client.delete("/Remarkss/55555")
        assert response.status_code == 404


# ============================================================================
# 11. EDGE CASES & SECURITY TESTS
# ============================================================================
class TestRemarksEdgeCases:
    def test_create_remark_with_unicode_and_emojis(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test remark description containing Unicode non-ASCII characters and emojis."""
        unicode_text = "Proposal update ✅ Approved by 🔬 CMTI Scientist (₹ 15,00,000)"
        payload = {
            "from_": "Dr. Ramesh",
            "to": "Admin",
            "project_id": test_proposal.id,
            "remarks_description": unicode_text
        }

        response = client.post("/Remarkss/", json=payload)
        assert response.status_code == 200
        assert response.json()["remarks_description"] == unicode_text

    def test_create_remark_xss_and_sql_injection_strings(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test API safely handles XSS tags and SQL injection string attempts."""
        malicious_string = "<script>alert('xss')</script> '; DROP TABLE remarks; --"
        payload = {
            "from_": malicious_string,
            "to": "Security Audit",
            "project_id": test_proposal.id,
            "remarks_description": malicious_string
        }

        response = client.post("/Remarkss/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["remarks_description"] == malicious_string

        # Confirm DB was not damaged
        count = db_session.query(Remarks).count()
        assert count >= 1

    def test_create_remark_large_text_payload(self, client: TestClient, db_session: Session, test_proposal: Proposal):
        """Test creating remark with very large text payload (50KB string)."""
        large_text = "A" * 50000
        payload = {
            "from_": "Tester",
            "to": "Reviewer",
            "project_id": test_proposal.id,
            "remarks_description": large_text
        }

        response = client.post("/Remarkss/", json=payload)
        assert response.status_code == 200
        assert len(response.json()["remarks_description"]) == 50000
