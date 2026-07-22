from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from db import get_db
from models.model import Remarks
# from pydantic_schema.response import schemas
# ✅ CORRECT
from pydantic_schema import schemas

router = APIRouter(prefix="/Remarkss", tags=["Remarkss"])


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
        is_delivered=True,
        delivered_at=now,
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

    # Gather user 1 aliases (name, role, group)
    p1_aliases = [x.lower().strip() for x in [u1, user_name, user_role, user_group] if x]
    p2_aliases = [u2.lower().strip()] if u2 else []

    # 1. Bidirectional check between two participants (P1 <-> P2)
    if p1_aliases and p2_aliases:
        query = query.filter(
            # P1 sent to P2 OR P1 replied by P2
            (func.lower(Remarks.from_).in_(p1_aliases) & func.lower(Remarks.to).in_(p2_aliases)) |
            (func.lower(Remarks.from_).in_(p1_aliases) & func.lower(Remarks.replyer).in_(p2_aliases)) |
            # P2 sent to P1 OR P2 replied by P1
            (func.lower(Remarks.from_).in_(p2_aliases) & func.lower(Remarks.to).in_(p1_aliases)) |
            (func.lower(Remarks.from_).in_(p2_aliases) & func.lower(Remarks.replyer).in_(p1_aliases)) |
            # Replies across both directions
            (func.lower(Remarks.replyer).in_(p1_aliases) & func.lower(Remarks.to).in_(p2_aliases)) |
            (func.lower(Remarks.replyer).in_(p2_aliases) & func.lower(Remarks.to).in_(p1_aliases))
        )
    # 2. General user scoping (all messages involving user)
    elif p1_aliases:
        query = query.filter(
            func.lower(Remarks.from_).in_(p1_aliases) |
            func.lower(Remarks.to).in_(p1_aliases) |
            func.lower(Remarks.replyer).in_(p1_aliases)
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
        # Auto-set replyer to whoever sent this update (from_ field)
        if data.replyer is not None:
            item.replyer = data.replyer
        elif data.from_ is not None:
            item.replyer = data.from_
        # Reset reply_seen so the original sender knows there is a new reply to see
        item.reply_seen = False
        item.reply_seen_at = None

    item.updated_at = now

    db.commit()
    db.refresh(item)
    return item

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