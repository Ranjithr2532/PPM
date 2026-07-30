import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.model import MessageGroup, GroupMember, Message, MessageSeen
from models.user_model import User
from tests.factories import (
    create_user_factory,
    create_message_group_factory,
    create_group_member_factory,
    create_group_message_factory,
    create_message_seen_factory,
)
from tests.utils import generate_dummy_file


# ============================================================================
# 1. POST /group-chats/upload-attachment
# ============================================================================
class TestGroupUploadAttachment:
    def test_upload_group_attachment_success(self, client: TestClient):
        """Test uploading a file attachment for group chat."""
        file_tuple = generate_dummy_file("project_schematic v2.pdf", b"%PDF content", "application/pdf")
        response = client.post("/group-chats/upload-attachment", files={"file": file_tuple[1]})

        assert response.status_code == 200
        data = response.json()
        assert "attachment_url" in data
        assert data["attachment_name"] == "project_schematic v2.pdf"
        assert data["attachment_type"] == "application/pdf"
        assert "project_schematic_v2.pdf" in data["attachment_url"]


# ============================================================================
# 2. POST /group-chats/ (Create Group)
# ============================================================================
class TestCreateGroup:
    def test_create_group_success(self, client: TestClient):
        """Test creating a new message group."""
        payload = {"name": "CMTI Robotics Division Chat"}
        response = client.post("/group-chats/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["name"] == "CMTI Robotics Division Chat"

    def test_create_group_missing_name_422(self, client: TestClient):
        """Test creating group without name returns 422 validation error."""
        response = client.post("/group-chats/", json={})
        assert response.status_code == 422


# ============================================================================
# 3. GET /group-chats/ (List Groups)
# ============================================================================
class TestListGroups:
    def test_list_groups_empty(self, client: TestClient):
        """Test listing groups when none exist returns empty list."""
        response = client.get("/group-chats/")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_groups_filtered_by_user_id(self, client: TestClient, db_session: Session):
        """Test listing groups filtered by user membership with unread counts."""
        user1 = create_user_factory(db_session, name="User One")
        user2 = create_user_factory(db_session, name="User Two")

        group1 = create_message_group_factory(db_session, name="Group 1")
        group2 = create_message_group_factory(db_session, name="Group 2")

        # Add User 1 to Group 1 only
        create_group_member_factory(db_session, group_id=group1.id, user_id=user1.id)
        # Add User 2 to Group 2 only
        create_group_member_factory(db_session, group_id=group2.id, user_id=user2.id)

        # Query groups for User 1
        response = client.get("/group-chats/", params={"user_id": user1.id})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == group1.id

    def test_list_groups_filtered_by_user_name(self, client: TestClient, db_session: Session):
        """Test listing groups filtered by user_name resolves user_id correctly."""
        user = create_user_factory(db_session, name="Dr. Anita Sharma")
        group = create_message_group_factory(db_session, name="Anita's Project Team")
        create_group_member_factory(db_session, group_id=group.id, user_id=user.id)

        response = client.get("/group-chats/", params={"user_name": "  Dr. Anita Sharma  "})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == group.id

    def test_list_groups_unread_messages_count(self, client: TestClient, db_session: Session):
        """Test unread_count is properly computed for unseen group messages."""
        user_me = create_user_factory(db_session, name="Me User")
        user_other = create_user_factory(db_session, name="Other User")

        group = create_message_group_factory(db_session, name="Unread Test Group")
        create_group_member_factory(db_session, group_id=group.id, user_id=user_me.id)
        create_group_member_factory(db_session, group_id=group.id, user_id=user_other.id)

        # Message sent by other user (Unseen by me)
        msg1 = create_group_message_factory(db_session, group_id=group.id, sender_id=user_other.id, message="Unseen msg 1")
        msg2 = create_group_message_factory(db_session, group_id=group.id, sender_id=user_other.id, message="Unseen msg 2")

        # Mark msg1 as seen by me
        create_message_seen_factory(db_session, message_id=msg1.id, user_id=user_me.id)

        response = client.get("/group-chats/", params={"user_id": user_me.id})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["unread_count"] == 1  # Only msg2 is unread


# ============================================================================
# 4. GET /group-chats/{group_id} (Get Group)
# ============================================================================
class TestGetGroup:
    def test_get_group_success(self, client: TestClient, db_session: Session):
        """Test getting details of a single message group."""
        group = create_message_group_factory(db_session, name="Design Review Group")

        response = client.get(f"/group-chats/{group.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == group.id
        assert data["name"] == "Design Review Group"

    def test_get_group_not_found_404(self, client: TestClient):
        """Test getting non-existent group ID returns 404."""
        response = client.get("/group-chats/99999")
        assert response.status_code == 404
        assert response.json()["detail"] == "Message group not found"


# ============================================================================
# 5. DELETE /group-chats/{group_id} (Delete Group)
# ============================================================================
class TestDeleteGroup:
    def test_delete_group_success_cascade(self, client: TestClient, db_session: Session):
        """Test deleting a group cascades deletion to members and messages."""
        user = create_user_factory(db_session)
        group = create_message_group_factory(db_session, name="Group to Delete")
        member = create_group_member_factory(db_session, group_id=group.id, user_id=user.id)
        msg = create_group_message_factory(db_session, group_id=group.id, sender_id=user.id)

        response = client.delete(f"/group-chats/{group.id}")
        assert response.status_code == 204

        # Verify DB cascades
        assert db_session.query(MessageGroup).filter(MessageGroup.id == group.id).first() is None
        assert db_session.query(GroupMember).filter(GroupMember.group_id == group.id).first() is None
        assert db_session.query(Message).filter(Message.group_id == group.id).first() is None

    def test_delete_group_not_found_404(self, client: TestClient):
        """Test deleting non-existent group returns 404."""
        response = client.delete("/group-chats/88888")
        assert response.status_code == 404


# ============================================================================
# 6. POST /group-chats/{group_id}/members (Add Member)
# ============================================================================
class TestAddGroupMember:
    def test_add_group_member_success(self, client: TestClient, db_session: Session):
        """Test adding a valid user to a message group."""
        user = create_user_factory(db_session, name="New Member", role="scientist")
        group = create_message_group_factory(db_session)

        response = client.post(f"/group-chats/{group.id}/members", params={"user_id": user.id})
        assert response.status_code == 201
        data = response.json()
        assert data["group_id"] == group.id
        assert data["user_id"] == user.id
        assert data["user_name"] == "New Member"
        assert data["user_role"] == "scientist"

    def test_add_group_member_idempotent_if_existing(self, client: TestClient, db_session: Session):
        """Test adding an existing group member returns existing membership without duplicate row."""
        user = create_user_factory(db_session)
        group = create_message_group_factory(db_session)
        member = create_group_member_factory(db_session, group_id=group.id, user_id=user.id)

        response = client.post(f"/group-chats/{group.id}/members", params={"user_id": user.id})
        assert response.status_code == 201
        assert response.json()["id"] == member.id

    def test_add_group_member_group_not_found_404(self, client: TestClient, db_session: Session):
        """Test adding member to non-existent group returns 404."""
        user = create_user_factory(db_session)
        response = client.post("/group-chats/99999/members", params={"user_id": user.id})
        assert response.status_code == 404

    def test_add_group_member_user_not_found_404(self, client: TestClient, db_session: Session):
        """Test adding non-existent user to group returns 404."""
        group = create_message_group_factory(db_session)
        response = client.post(f"/group-chats/{group.id}/members", params={"user_id": 99999})
        assert response.status_code == 404


# ============================================================================
# 7. GET /group-chats/{group_id}/members (List Members)
# ============================================================================
class TestGetGroupMembers:
    def test_get_group_members_success(self, client: TestClient, db_session: Session):
        """Test listing all members in a group."""
        u1 = create_user_factory(db_session, name="Member One")
        u2 = create_user_factory(db_session, name="Member Two")
        group = create_message_group_factory(db_session)

        create_group_member_factory(db_session, group_id=group.id, user_id=u1.id)
        create_group_member_factory(db_session, group_id=group.id, user_id=u2.id)

        response = client.get(f"/group-chats/{group.id}/members")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        names = [m["user_name"] for m in data]
        assert "Member One" in names
        assert "Member Two" in names

    def test_get_group_members_group_not_found_404(self, client: TestClient):
        """Test getting members for non-existent group returns 404."""
        response = client.get("/group-chats/99999/members")
        assert response.status_code == 404


# ============================================================================
# 8. DELETE /group-chats/{group_id}/members/{user_id} (Remove Member)
# ============================================================================
class TestRemoveGroupMember:
    def test_remove_group_member_success(self, client: TestClient, db_session: Session):
        """Test removing a user from a message group."""
        user = create_user_factory(db_session)
        group = create_message_group_factory(db_session)
        create_group_member_factory(db_session, group_id=group.id, user_id=user.id)

        response = client.delete(f"/group-chats/{group.id}/members/{user.id}")
        assert response.status_code == 204

        # Confirm DB removal
        member = db_session.query(GroupMember).filter(GroupMember.group_id == group.id, GroupMember.user_id == user.id).first()
        assert member is None

    def test_remove_group_member_not_found_404(self, client: TestClient, db_session: Session):
        """Test removing non-existent group member returns 404."""
        group = create_message_group_factory(db_session)
        response = client.delete(f"/group-chats/{group.id}/members/99999")
        assert response.status_code == 404


# ============================================================================
# 9. POST /group-chats/{group_id}/messages (Send Message)
# ============================================================================
class TestSendGroupMessage:
    def test_send_group_message_success(self, client: TestClient, db_session: Session):
        """Test sending a text message to a group."""
        user = create_user_factory(db_session, name="Sender User", role="gh")
        group = create_message_group_factory(db_session)

        payload = {
            "group_id": group.id,
            "sender_id": user.id,
            "message": "Weekly progress meeting at 11 AM",
            "attachment_url": "http://minio/agenda.pdf",
            "attachment_name": "agenda.pdf",
            "attachment_type": "application/pdf"
        }

        response = client.post(f"/group-chats/{group.id}/messages", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["group_id"] == group.id
        assert data["sender_id"] == user.id
        assert data["sender_name"] == "Sender User"
        assert data["sender_role"] == "gh"
        assert data["message"] == payload["message"]

    def test_send_group_message_group_not_found_404(self, client: TestClient, db_session: Session):
        """Test sending message to non-existent group returns 404."""
        user = create_user_factory(db_session)
        payload = {"group_id": 99999, "sender_id": user.id, "message": "Test"}

        response = client.post("/group-chats/99999/messages", json=payload)
        assert response.status_code == 404

    def test_send_group_message_sender_not_found_404(self, client: TestClient, db_session: Session):
        """Test sending message with non-existent sender_id returns 404."""
        group = create_message_group_factory(db_session)
        payload = {"group_id": group.id, "sender_id": 99999, "message": "Test"}

        response = client.post(f"/group-chats/{group.id}/messages", json=payload)
        assert response.status_code == 404


# ============================================================================
# 10. GET /group-chats/{group_id}/messages (Get Messages)
# ============================================================================
class TestGetGroupMessages:
    def test_get_group_messages_success_with_seen_by(self, client: TestClient, db_session: Session):
        """Test retrieving group messages including per-user read receipts."""
        sender = create_user_factory(db_session, name="Sender User")
        reader = create_user_factory(db_session, name="Reader User")
        group = create_message_group_factory(db_session)

        msg = create_group_message_factory(db_session, group_id=group.id, sender_id=sender.id, message="Hello team")
        create_message_seen_factory(db_session, message_id=msg.id, user_id=reader.id)

        response = client.get(f"/group-chats/{group.id}/messages")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == msg.id
        assert len(data[0]["seen_by"]) == 1
        assert data[0]["seen_by"][0]["user_name"] == "Reader User"

    def test_get_group_messages_cursor_pagination(self, client: TestClient, db_session: Session):
        """Test before_id, after_id, and limit pagination for group messages."""
        user = create_user_factory(db_session)
        group = create_message_group_factory(db_session)
        messages = [
            create_group_message_factory(db_session, group_id=group.id, sender_id=user.id, message=f"Msg {i}")
            for i in range(5)
        ]

        # Pagination with limit
        response = client.get(f"/group-chats/{group.id}/messages", params={"limit": 2})
        assert response.status_code == 200
        assert len(response.json()) == 2

        # Pagination with before_id
        mid_id = messages[3].id
        response_before = client.get(f"/group-chats/{group.id}/messages", params={"before_id": mid_id})
        assert response_before.status_code == 200
        for m in response_before.json():
            assert m["id"] < mid_id

    def test_get_group_messages_group_not_found_404(self, client: TestClient):
        """Test fetching messages for non-existent group returns 404."""
        response = client.get("/group-chats/99999/messages")
        assert response.status_code == 404


# ============================================================================
# 11. READ RECEIPTS (Mark Seen & Seen By)
# ============================================================================
class TestMessageReadReceipts:
    def test_mark_message_seen_success(self, client: TestClient, db_session: Session):
        """Test marking a group message as seen by a specific user."""
        user = create_user_factory(db_session, name="Reader Person")
        group = create_message_group_factory(db_session)
        msg = create_group_message_factory(db_session, group_id=group.id, sender_id=user.id)

        response = client.post(f"/group-chats/messages/{msg.id}/mark-seen", params={"user_id": user.id})
        assert response.status_code == 200
        data = response.json()
        assert data["message_id"] == msg.id
        assert data["user_id"] == user.id
        assert data["user_name"] == "Reader Person"

    def test_mark_message_seen_idempotent(self, client: TestClient, db_session: Session):
        """Test marking message seen multiple times returns existing receipt."""
        user = create_user_factory(db_session)
        group = create_message_group_factory(db_session)
        msg = create_group_message_factory(db_session, group_id=group.id, sender_id=user.id)
        seen = create_message_seen_factory(db_session, message_id=msg.id, user_id=user.id)

        response = client.post(f"/group-chats/messages/{msg.id}/mark-seen", params={"user_id": user.id})
        assert response.status_code == 200
        assert response.json()["id"] == seen.id

    def test_mark_message_seen_message_not_found_404(self, client: TestClient, db_session: Session):
        """Test marking non-existent message as seen returns 404."""
        user = create_user_factory(db_session)
        response = client.post("/group-chats/messages/99999/mark-seen", params={"user_id": user.id})
        assert response.status_code == 404

    def test_get_message_seen_by(self, client: TestClient, db_session: Session):
        """Test getting list of users who have seen a specific group message."""
        u1 = create_user_factory(db_session, name="Viewer A")
        u2 = create_user_factory(db_session, name="Viewer B")
        group = create_message_group_factory(db_session)
        msg = create_group_message_factory(db_session, group_id=group.id, sender_id=u1.id)

        create_message_seen_factory(db_session, message_id=msg.id, user_id=u1.id)
        create_message_seen_factory(db_session, message_id=msg.id, user_id=u2.id)

        response = client.get(f"/group-chats/messages/{msg.id}/seen-by")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        names = [item["user_name"] for item in data]
        assert "Viewer A" in names
        assert "Viewer B" in names


# ============================================================================
# 12. EDGE CASES & SECURITY TESTS
# ============================================================================
class TestGroupChatEdgeCases:
    def test_send_group_message_unicode_and_emojis(self, client: TestClient, db_session: Session):
        """Test group message containing Unicode text and emojis."""
        user = create_user_factory(db_session)
        group = create_message_group_factory(db_session)

        unicode_msg = "Milestone achieved! 🎉 🚀 Project approved (Status: 100%)"
        payload = {
            "group_id": group.id,
            "sender_id": user.id,
            "message": unicode_msg
        }

        response = client.post(f"/group-chats/{group.id}/messages", json=payload)
        assert response.status_code == 201
        assert response.json()["message"] == unicode_msg

    def test_create_group_special_characters(self, client: TestClient):
        """Test creating group with special characters and symbols in name."""
        special_name = "C-SMPM / High-Precision & Quality Testing [Group #1]"
        response = client.post("/group-chats/", json={"name": special_name})

        assert response.status_code == 201
        assert response.json()["name"] == special_name
