from typing import Optional, List, Any
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime

from db import get_db
from models.model import Remarks, Proposal
from models.user_model import User
from services.minio_client import upload_file_to_minio
# from pydantic_schema.response import schemas
# ✅ CORRECT
from pydantic_schema import schemas

router = APIRouter(prefix="/Remarkss", tags=["Remarkss"])


# ---------------- UPLOAD CHAT ATTACHMENT TO MINIO (documents/messages/) ----------------
@router.post("/upload-attachment")
async def upload_chat_attachment(file: UploadFile = File(...)):
    """Uploads a chat document/photo attachment to MinIO under documents/messages."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    sanitized_name = file.filename.replace(" ", "_")
    object_name = f"documents/messages/{uuid4().hex}_{sanitized_name}"
    
    obj_path, public_url = await upload_file_to_minio(file, object_name=object_name)
    
    return {
        "attachment_url": public_url,
        "attachment_name": file.filename,
        "attachment_type": file.content_type or "application/octet-stream"
    }


# ---------------- MARK MESSAGE SEEN ----------------
@router.patch("/{id}/mark-seen")
def mark_message_seen(id: int, db: Session = Depends(get_db)):
    """Called when the recipient opens the chat modal — marks the message as read with timestamp."""
    item = db.query(Remarks).filter(Remarks.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.message_seen = True
    item.message_seen_at = datetime.now()
    db.commit()
    return {"message": "Marked as seen", "id": id, "seen_at": item.message_seen_at}


# ---------------- MARK REPLY SEEN ----------------
@router.patch("/{id}/mark-reply-seen")
def mark_reply_seen(id: int, db: Session = Depends(get_db)):
    """Called when the original sender opens the chat and sees the reply."""
    item = db.query(Remarks).filter(Remarks.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.reply_seen = True
    item.reply_seen_at = datetime.now()
    db.commit()
    return {"message": "Reply marked as seen", "id": id, "reply_seen_at": item.reply_seen_at}


# ---------------- TOTAL UNREAD PROPOSAL REMARKS COUNT ----------------
def _norm(s: Optional[str]) -> str:
    return (s or '').lower().replace(' ', '').strip()


def check_is_to_me(item_to: Optional[str], user_name: str, user_role: str, user_group: str) -> bool:
    if not item_to:
        return False
    to_val = _norm(item_to)
    u_n = _norm(user_name)
    u_r = _norm(user_role)
    u_g = _norm(user_group)

    if to_val == u_n or (u_r and to_val == u_r):
        return True
    if u_n and (u_n in to_val or to_val in u_n):
        return True
    if u_r == 'admin' and ('admin' in to_val or 'manjunath' in to_val):
        return True
    if u_r == 'gh' and ('gh' in to_val or 'grouphead' in to_val or (u_g and u_g in to_val)):
        return True
    if u_r == 'scientist' and (u_n in to_val or 'coordinator' in to_val or 'project' in to_val):
        return True
    return False


def check_is_from_me(item_from: Optional[str], user_name: str, user_role: str, user_group: str) -> bool:
    if not item_from:
        return False
    from_val = _norm(item_from)
    u_n = _norm(user_name)
    u_r = _norm(user_role)
    u_g = _norm(user_group)

    if from_val == u_n or (u_r and from_val == u_r):
        return True
    if u_n and (u_n in from_val or from_val in u_n):
        return True
    if u_r == 'admin' and ('admin' in from_val or 'manjunath' in from_val):
        return True
    if u_r == 'gh' and ('gh' in from_val or 'grouphead' in from_val or (u_g and u_g in from_val)):
        return True
    if u_r == 'scientist' and (u_n in from_val or 'coordinator' in from_val or 'project' in from_val):
        return True
    return False


@router.get("/unread_count")
def get_unread_remarks_count(user_name: Optional[str] = None, user_role: Optional[str] = None, user_group: Optional[str] = None, db: Session = Depends(get_db)):
    """Returns the exact count of proposal chats with unread messages for a user."""
    if not user_name:
        return {"unread_count": 0}

    u_name = user_name.strip()
    u_role = (user_role or '').strip().lower()
    u_grp = (user_group or '').strip()

    all_remarks = db.query(Remarks).all()
    proposals_map = {}
    for r in all_remarks:
        pid = r.project_id
        if pid not in proposals_map:
            proposals_map[pid] = []
        proposals_map[pid].append(r)

    unread_proposals_cnt = 0
    for pid, r_list in proposals_map.items():
        has_unread = False
        for r in r_list:
            is_to = check_is_to_me(r.to, u_name, u_role, u_grp)
            is_from = check_is_from_me(r.from_, u_name, u_role, u_grp)
            unseen_msg = is_to and not r.message_seen
            unseen_reply = is_from and r.respond_to_remarks and not r.reply_seen
            if unseen_msg or unseen_reply:
                has_unread = True
                break
        if has_unread:
            unread_proposals_cnt += 1

    return {"unread_count": unread_proposals_cnt}


# ---------------- CREATE ----------------
@router.post("/", response_model=schemas.TransitionResponse)
def create_Remarks(data: schemas.RemarksCreate, db: Session = Depends(get_db)):
    now = datetime.now()
    new_item = Remarks(
        from_=data.from_,
        to=data.to,
        project_id=data.project_id,
        remarks_description=data.remarks_description,
        respond_to_remarks=data.respond_to_remarks,
        attachment_url=data.attachment_url,
        attachment_name=data.attachment_name,
        attachment_type=data.attachment_type,
        is_delivered=True,
        delivered_at=now,
        message_seen=False,
        reply_seen=False,
        created_at=now,
        updated_at=now
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


# ---------------- READ ALL ----------------
@router.get("/", response_model=list[schemas.RemarksResponse])
def get_all_Remarkss(project_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Remarks)
    if project_id is not None:
        query = query.filter(Remarks.project_id == project_id)
    return query.all()


# ---------------- CHAT HISTORY (BIDIRECTIONAL BETWEEN TWO PARTICIPANTS FOR PROJECT) ----------------
@router.get("/chat-history", response_model=list[schemas.RemarksResponse])
def get_user_chat_history(
    user1: str = None,
    user2: str = None,
    sender: str = None,
    recipient: str = None,
    project_id: int = None,
    user_name: str = None,
    user_role: str = None,
    user_group: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Remarks)
    if project_id is not None:
        query = query.filter(Remarks.project_id == project_id)

    u1 = (user1 or sender)
    u2 = (user2 or recipient)

    # Normalize value helper to collapse multiple whitespace and trim
    def clean_value(val: str) -> str:
        if not val:
            return ""
        return " ".join(val.lower().split())

    # Helper to clean DB columns for comparison
    def db_clean(col):
        return func.lower(func.trim(func.regexp_replace(col, r'\s+', ' ', 'g')))

    # Gather user 1 aliases (name, role, group)
    p1_aliases = [clean_value(x) for x in [u1, user_name, user_role, user_group] if x]
    p2_aliases = [clean_value(u2)] if u2 else []

    # Dynamically query user table for all admin user names if 'admin' is in aliases
    if 'admin' in p1_aliases:
        admin_users = db.query(User.name).filter(func.lower(User.role) == 'admin').all()
        for au in admin_users:
            if au[0]:
                cleaned = clean_value(au[0])
                if cleaned and cleaned not in p1_aliases:
                    p1_aliases.append(cleaned)

    if 'admin' in p2_aliases:
        admin_users = db.query(User.name).filter(func.lower(User.role) == 'admin').all()
        for au in admin_users:
            if au[0]:
                cleaned = clean_value(au[0])
                if cleaned and cleaned not in p2_aliases:
                    p2_aliases.append(cleaned)

    # 1. Bidirectional check between two participants (P1 <-> P2)
    if p1_aliases and p2_aliases:
        query = query.filter(
            # P1 sent to P2 OR P1 replied by P2
            (db_clean(Remarks.from_).in_(p1_aliases) & db_clean(Remarks.to).in_(p2_aliases)) |
            (db_clean(Remarks.from_).in_(p1_aliases) & db_clean(Remarks.replyer).in_(p2_aliases)) |
            # P2 sent to P1 OR P2 replied by P1
            (db_clean(Remarks.from_).in_(p2_aliases) & db_clean(Remarks.to).in_(p1_aliases)) |
            (db_clean(Remarks.from_).in_(p2_aliases) & db_clean(Remarks.replyer).in_(p1_aliases)) |
            # Replies across both directions
            (db_clean(Remarks.replyer).in_(p1_aliases) & db_clean(Remarks.to).in_(p2_aliases)) |
            (db_clean(Remarks.replyer).in_(p2_aliases) & db_clean(Remarks.to).in_(p1_aliases))
        )
    # 2. General user scoping (all messages involving user)
    elif p1_aliases:
        query = query.filter(
            db_clean(Remarks.from_).in_(p1_aliases) |
            db_clean(Remarks.to).in_(p1_aliases) |
            db_clean(Remarks.replyer).in_(p1_aliases)
        )

    return query.all()


# ---------------- READ ONE ----------------
@router.get("/{id}", response_model=schemas.TransitionResponse)
def get_Remarks(id: int, db: Session = Depends(get_db)):
    item = db.query(Remarks).filter(Remarks.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


# ---------------- UPDATE ----------------
@router.put("/{id}", response_model=schemas.TransitionResponse)
def update_Remarks(id: int, data: schemas.RemarksUpdate, db: Session = Depends(get_db)):
    item = db.query(Remarks).filter(Remarks.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    now = datetime.now()

    if data.from_ is not None:
        item.from_ = data.from_
    if data.to is not None:
        item.to = data.to
    if data.project_id is not None:
        item.project_id = data.project_id
    if data.remarks_description is not None:
        item.remarks_description = data.remarks_description
    if data.respond_to_remarks is not None:
        item.respond_to_remarks = data.respond_to_remarks
        item.replied_at = now
        item.reply_delivered = True
        item.reply_delivered_at = now
        item.message_seen = True
        if not item.message_seen_at:
            item.message_seen_at = now
        # Auto-set replyer to whoever sent this update (from_ field)
        if data.replyer is not None:
            item.replyer = data.replyer
        elif data.from_ is not None:
            item.replyer = data.from_
        # Reset reply_seen so the original sender knows there is a new reply to see
        item.reply_seen = False
        item.reply_seen_at = None

    if data.attachment_url is not None:
        item.attachment_url = data.attachment_url
    if data.attachment_name is not None:
        item.attachment_name = data.attachment_name
    if data.attachment_type is not None:
        item.attachment_type = data.attachment_type

    item.updated_at = now

    db.commit()
    db.refresh(item)
    return item


# ---------------- DELETE ----------------
@router.delete("/{id}")
def delete_Remarks(id: int, db: Session = Depends(get_db)):
    item = db.query(Remarks).filter(Remarks.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(item)
    db.commit()
    return {"message": "Deleted successfully"}