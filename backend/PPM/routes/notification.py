from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from db import get_db
from models.model import Notification, Proposal, Document
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ---------------------------
# Pydantic Schemas
# ---------------------------

class NotificationBase(BaseModel):
    user_name: str
    message: str
    is_read: int
    related_proposal_id: Optional[int] = None
    related_document_id: Optional[int] = None
    trigerred_by: Optional[str] = None


class NotificationUpdate(BaseModel):
    is_read: int


class NotificationResponse(BaseModel):
    id: int
    user_name: str
    message: str
    is_read: int
    project_number: Optional[str] = None
    proposal_name: Optional[str] = None
    document_name: Optional[str] = None
    trigerred_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------
# GET ALL NOTIFICATIONS
# ---------------------------

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    user_name: str,
    role: str,
    db: Session = Depends(get_db)
):
    normalized_role = (role or '').strip().lower()
    role_names = [normalized_role] if normalized_role else []

    # Treat guest as admin-equivalent for role-based notifications.
    if normalized_role in ['admin', 'guest', 'role']:
        role_names = ['admin', 'guest', 'role']

    filters = [Notification.user_name == user_name]
    if role_names:
        filters.append(Notification.user_name.in_(role_names))

    notifications = db.query(Notification).filter(
        or_(*filters)
    ).order_by(Notification.created_at.desc()).all()
    response_data = []

    for n in notifications:
        # fetch proposal data
        proposal = None
        project_number = None
        proposal_name = None

        if n.related_proposal_id:
            proposal = db.query(Proposal).filter(Proposal.id == n.related_proposal_id).first()
            if proposal:
                project_number = proposal.project_number
                proposal_name = proposal.party_name

        # fetch document data
        document = None
        document_name = None

        if n.related_document_id:
            document = db.query(Document).filter(Document.id == n.related_document_id).first()
            if document:
                document_name = document.name

        response_data.append(
            NotificationResponse(
                id=n.id,
                user_name=n.user_name,
                message=n.message,
                is_read=n.is_read,
                project_number=project_number,
                proposal_name=proposal_name,
                document_name=document_name,
                trigerred_by= n.trigerred_by,
                created_at = n.created_at
            )
        )

    return response_data


# ---------------------------
# UPDATE is_read ONLY
# ---------------------------

@router.put("/{notification_id}", response_model=NotificationResponse)
def update_notification(notification_id: int, data: NotificationUpdate, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Only update is_read
    notification.is_read = data.is_read
    db.commit()
    db.refresh(notification)

    # get proposal fields
    project_number = None
    proposal_name = None
    if notification.related_proposal_id:
        proposal = db.query(Proposal).filter(Proposal.id == notification.related_proposal_id).first()
        if proposal:
            project_number = proposal.project_number
            proposal_name = proposal.party_name

    # get document fields
    document_name = None
    if notification.related_document_id:
        document = db.query(Document).filter(Document.id == notification.related_document_id).first()
        if document:
            document_name = document.name

    return NotificationResponse(
        id=notification.id,
        user_name=notification.user_name,
        message=notification.message,
        is_read=notification.is_read,
        project_number=project_number,
        proposal_name=proposal_name,
        document_name=document_name,
        trigerred_by= notification.trigerred_by,
        created_at= notification.created_at
    )



@router.get("/by-quotation-user", response_model=List[NotificationResponse])
def get_notifications_by_quotation_user(
    name: str,
    db: Session = Depends(get_db)
):
    """
    Get notifications where the related proposal has quotation_given_by_name = name
    """
    # Step-1: Fetch proposals that match name
    proposals = db.query(Proposal).filter(
        Proposal.quotation_given_by_name == name
    ).all()

    if not proposals:
        return []  # simply return empty list

    # Collect proposal IDs
    proposal_ids = [p.id for p in proposals]

    # Step-2: Fetch notifications linked to those proposals
    notifications = db.query(Notification).filter(
        Notification.related_proposal_id.in_(proposal_ids)
    ).all()

    response_data = []
    for n in notifications:
        project_number = None
        proposal_name = None
        document_name = None

        # Proposal info
        proposal = db.query(Proposal).filter(Proposal.id == n.related_proposal_id).first()
        if proposal:
            project_number = proposal.project_number
            proposal_name = proposal.party_name

        # Document info
        if n.related_document_id:
            document = db.query(Document).filter(Document.id == n.related_document_id).first()
            if document:
                document_name = document.name

        response_data.append(
            NotificationResponse(
                id=n.id,
                user_name=n.user_name,
                message=n.message,
                is_read=n.is_read,
                project_number=project_number,
                proposal_name=proposal_name,
                document_name=document_name,
                trigerred_by=n.trigerred_by,
                created_at=n.created_at
            )
        )

    return response_data

