"""
Factory helpers for creating test model instances with sensible defaults.
"""
from typing import Optional
from sqlalchemy.orm import Session
from models.user_model import User
from models.model import Proposal, Remarks, MessageGroup, GroupMember, Message, MessageSeen


def create_user_factory(
    db: Session,
    name: str = "Test User",
    email: Optional[str] = None,
    role: str = "scientist",
    center: str = "C-SMPM",
    group: str = "SMPM",
    password: str = "securepassword123"
) -> User:
    import uuid
    if not email:
        email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        name=name,
        email=email,
        role=role,
        center=center,
        group=group,
        password=password
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_proposal_factory(
    db: Session,
    customer_name: str = "Sample Corporation",
    email: str = "contact@samplecorp.com",
    quote_reference: str = "REF-2026-99",
    quote_description: str = "Prototyping & Inspection",
    quote_amount: str = "250000",
    proposal_status: str = "Active"
) -> Proposal:
    proposal = Proposal(
        customer_name=customer_name,
        email=email,
        quote_reference=quote_reference,
        quote_description=quote_description,
        quote_amount=quote_amount,
        proposal_status=proposal_status
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def create_remark_factory(
    db: Session,
    from_: str = "Scientist A",
    to: str = "Group Head",
    project_id: int = 1,
    remarks_description: str = "Initial technical proposal review comment",
    respond_to_remarks: Optional[str] = None,
    replyer: Optional[str] = None,
    message_seen: bool = False,
    reply_seen: bool = False,
    attachment_url: Optional[str] = None,
    attachment_name: Optional[str] = None,
    attachment_type: Optional[str] = None
) -> Remarks:
    remark = Remarks(
        from_=from_,
        to=to,
        project_id=project_id,
        remarks_description=remarks_description,
        respond_to_remarks=respond_to_remarks,
        replyer=replyer,
        message_seen=message_seen,
        reply_seen=reply_seen,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        attachment_type=attachment_type
    )
    db.add(remark)
    db.commit()
    db.refresh(remark)
    return remark


def create_message_group_factory(
    db: Session,
    name: str = "Project SMPM Alpha Chat"
) -> MessageGroup:
    group = MessageGroup(name=name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def create_group_member_factory(
    db: Session,
    group_id: int,
    user_id: int
) -> GroupMember:
    member = GroupMember(group_id=group_id, user_id=user_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def create_group_message_factory(
    db: Session,
    group_id: int,
    sender_id: int,
    message: str = "Hello team, project design update is ready.",
    attachment_url: Optional[str] = None,
    attachment_name: Optional[str] = None,
    attachment_type: Optional[str] = None
) -> Message:
    msg = Message(
        group_id=group_id,
        sender_id=sender_id,
        message=message,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        attachment_type=attachment_type
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def create_message_seen_factory(
    db: Session,
    message_id: int,
    user_id: int
) -> MessageSeen:
    seen = MessageSeen(message_id=message_id, user_id=user_id)
    db.add(seen)
    db.commit()
    db.refresh(seen)
    return seen
