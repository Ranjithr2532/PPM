import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from db import get_db
from models.model import MessageGroup, GroupMember, Message, MessageSeen
from models.user_model import User
from pydantic_schema import schemas
from services.minio_client import upload_file_to_minio

router = APIRouter(prefix="/group-chats", tags=["Group Chats"])


# ---------------------------------------------------------
# UPLOAD ATTACHMENT FOR GROUP CHATS
# ---------------------------------------------------------
@router.post("/upload-attachment")
async def upload_group_attachment(file: UploadFile = File(...)):
    """Uploads document or photo attachment to MinIO under documents/messages/"""
    sanitized_name = file.filename.replace(" ", "_") if file.filename else "file"
    unique_name = f"documents/messages/{uuid.uuid4().hex}_{sanitized_name}"
    object_name, public_url = await upload_file_to_minio(file, object_name=unique_name)
    return {
        "attachment_url": public_url,
        "attachment_name": file.filename,
        "attachment_type": file.content_type or "application/octet-stream"
    }


# ---------------------------------------------------------
# GROUPS CRUD
# ---------------------------------------------------------
@router.post("/", response_model=schemas.GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(data: schemas.GroupCreate, db: Session = Depends(get_db)):
    """Creates a new message group."""
    new_group = MessageGroup(name=data.name)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group


@router.get("/", response_model=List[schemas.GroupResponse])
def list_groups(user_id: Optional[int] = None, user_name: Optional[str] = None, db: Session = Depends(get_db)):
    """Lists message groups visible only to members of that group with unread counts."""
    query = db.query(MessageGroup)

    target_user_id = user_id
    if not target_user_id and user_name:
        usr = db.query(User).filter(func.lower(func.trim(User.name)) == func.lower(func.trim(user_name))).first()
        if usr:
            target_user_id = usr.id

    if target_user_id:
        query = query.join(GroupMember, GroupMember.group_id == MessageGroup.id).filter(GroupMember.user_id == target_user_id)

    groups = query.all()
    results = []
    for g in groups:
        unread_cnt = 0
        if target_user_id:
            seen_subq = db.query(MessageSeen.message_id).filter(MessageSeen.user_id == target_user_id).subquery()
            unread_cnt = db.query(Message).filter(
                Message.group_id == g.id,
                Message.sender_id != target_user_id,
                ~Message.id.in_(seen_subq)
            ).count()

        results.append(schemas.GroupResponse(
            id=g.id,
            name=g.name,
            code=getattr(g, 'code', None),
            head=getattr(g, 'head', None),
            created_at=g.created_at,
            updated_at=g.updated_at,
            unread_count=unread_cnt
        ))

    return results


@router.get("/{group_id}", response_model=schemas.GroupResponse)
def get_group(group_id: int, db: Session = Depends(get_db)):
    """Gets details of a single message group."""
    grp = db.query(MessageGroup).filter(MessageGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Message group not found")
    return grp


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    """Deletes a message group."""
    grp = db.query(MessageGroup).filter(MessageGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Message group not found")
    
    # Delete associated members & messages
    db.query(GroupMember).filter(GroupMember.group_id == group_id).delete()
    db.query(Message).filter(Message.group_id == group_id).delete()
    db.delete(grp)
    db.commit()
    return None


# ---------------------------------------------------------
# GROUP MEMBERS
# ---------------------------------------------------------
@router.post("/{group_id}/members", response_model=schemas.GroupMemberResponse, status_code=status.HTTP_201_CREATED)
def add_group_member(group_id: int, user_id: int, db: Session = Depends(get_db)):
    """Adds a user to a message group."""
    grp = db.query(MessageGroup).filter(MessageGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Message group not found")

    usr = db.query(User).filter(User.id == user_id).first()
    if not usr:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(GroupMember).filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id).first()
    if existing:
        return schemas.GroupMemberResponse(
            id=existing.id,
            group_id=existing.group_id,
            user_id=existing.user_id,
            user_name=usr.name,
            user_email=usr.email,
            user_role=usr.role,
            joined_at=existing.joined_at
        )

    member = GroupMember(group_id=group_id, user_id=user_id)
    db.add(member)
    db.commit()
    db.refresh(member)

    return schemas.GroupMemberResponse(
        id=member.id,
        group_id=member.group_id,
        user_id=member.user_id,
        user_name=usr.name,
        user_email=usr.email,
        user_role=usr.role,
        joined_at=member.joined_at
    )


@router.get("/{group_id}/members", response_model=List[schemas.GroupMemberResponse])
def get_group_members(group_id: int, db: Session = Depends(get_db)):
    """Gets all members in a message group with user details."""
    grp = db.query(MessageGroup).filter(MessageGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Message group not found")

    results = []
    members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    for m in members:
        usr = db.query(User).filter(User.id == m.user_id).first()
        results.append(schemas.GroupMemberResponse(
            id=m.id,
            group_id=m.group_id,
            user_id=m.user_id,
            user_name=usr.name if usr else "Unknown User",
            user_email=usr.email if usr else None,
            user_role=usr.role if usr else None,
            joined_at=m.joined_at
        ))
    return results


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_group_member(group_id: int, user_id: int, db: Session = Depends(get_db)):
    """Removes a user from a message group."""
    member = db.query(GroupMember).filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Group member not found")
    db.delete(member)
    db.commit()
    return None


# ---------------------------------------------------------
# GROUP MESSAGES
# ---------------------------------------------------------
@router.post("/{group_id}/messages", response_model=schemas.GroupMessageResponse, status_code=status.HTTP_201_CREATED)
def send_group_message(group_id: int, data: schemas.GroupMessageCreate, db: Session = Depends(get_db)):
    """Sends a new message to a message group."""
    grp = db.query(MessageGroup).filter(MessageGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Message group not found")

    usr = db.query(User).filter(User.id == data.sender_id).first()
    if not usr:
        raise HTTPException(status_code=404, detail="Sender user not found")

    msg = Message(
        group_id=group_id,
        sender_id=data.sender_id,
        message=data.message,
        attachment_url=data.attachment_url,
        attachment_name=data.attachment_name,
        attachment_type=data.attachment_type
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return schemas.GroupMessageResponse(
        id=msg.id,
        group_id=msg.group_id,
        sender_id=msg.sender_id,
        sender_name=usr.name,
        sender_role=usr.role,
        message=msg.message,
        created_at=msg.created_at,
        attachment_url=msg.attachment_url,
        attachment_name=msg.attachment_name,
        attachment_type=msg.attachment_type
    )


@router.get("/{group_id}/messages", response_model=List[schemas.GroupMessageResponse])
def get_group_messages(group_id: int, db: Session = Depends(get_db)):
    """Gets all messages for a message group with read receipt details."""
    grp = db.query(MessageGroup).filter(MessageGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Message group not found")

    results = []
    messages = db.query(Message).filter(Message.group_id == group_id).order_by(Message.created_at.asc()).all()
    for m in messages:
        usr = db.query(User).filter(User.id == m.sender_id).first()

        # Fetch per-user read receipts for this message
        seens = db.query(MessageSeen).filter(MessageSeen.message_id == m.id).all()
        seen_list = []
        for s in seens:
            s_usr = db.query(User).filter(User.id == s.user_id).first()
            seen_list.append({
                "id": s.id,
                "message_id": s.message_id,
                "user_id": s.user_id,
                "user_name": s_usr.name if s_usr else "Unknown User",
                "seen_at": s.seen_at
            })

        results.append(schemas.GroupMessageResponse(
            id=m.id,
            group_id=m.group_id,
            sender_id=m.sender_id,
            sender_name=usr.name if usr else "Unknown Sender",
            sender_role=usr.role if usr else None,
            message=m.message,
            created_at=m.created_at,
            attachment_url=m.attachment_url,
            attachment_name=m.attachment_name,
            attachment_type=m.attachment_type,
            seen_by=seen_list
        ))
    return results


# ---------------------------------------------------------
# MESSAGE READ RECEIPTS (message_seen)
# ---------------------------------------------------------
@router.post("/messages/{message_id}/mark-seen", response_model=schemas.MessageSeenResponse)
def mark_message_seen(message_id: int, user_id: int, db: Session = Depends(get_db)):
    """Marks a group message as seen by a specific user (id, message_id, user_id, seen_at)."""
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    usr = db.query(User).filter(User.id == user_id).first()
    if not usr:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(MessageSeen).filter(MessageSeen.message_id == message_id, MessageSeen.user_id == user_id).first()
    if existing:
        return schemas.MessageSeenResponse(
            id=existing.id,
            message_id=existing.message_id,
            user_id=existing.user_id,
            user_name=usr.name,
            seen_at=existing.seen_at
        )

    new_seen = MessageSeen(message_id=message_id, user_id=user_id)
    db.add(new_seen)
    db.commit()
    db.refresh(new_seen)

    return schemas.MessageSeenResponse(
        id=new_seen.id,
        message_id=new_seen.message_id,
        user_id=new_seen.user_id,
        user_name=usr.name,
        seen_at=new_seen.seen_at
    )


@router.get("/messages/{message_id}/seen-by", response_model=List[schemas.MessageSeenResponse])
def get_message_seen_by(message_id: int, db: Session = Depends(get_db)):
    """Gets list of all users who have seen a specific group message."""
    seens = db.query(MessageSeen).filter(MessageSeen.message_id == message_id).all()
    results = []
    for s in seens:
        usr = db.query(User).filter(User.id == s.user_id).first()
        results.append(schemas.MessageSeenResponse(
            id=s.id,
            message_id=s.message_id,
            user_id=s.user_id,
            user_name=usr.name if usr else "Unknown User",
            seen_at=s.seen_at
        ))
    return results
