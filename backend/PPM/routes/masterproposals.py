# routes/masterproposals.py
from typing import List, Optional, Generator, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import func

from db import get_db
import models  # make sure models.py is importable and contains MasterProposal

router = APIRouter(prefix="/master_proposals", tags=["master_proposals"])





# -----------------------
# Pydantic models (in-file, no schemas.py)
# -----------------------
class MasterProposalBase(BaseModel):
    quote_date: Optional[str] = None
    customer_name: Optional[str] = None
    description: Optional[str] = None
    quote_amt: Optional[str] = None
    reference: Optional[str] = None
    quotation_ref: Optional[str] = None
    indentor: Optional[str] = None
    department: Optional[str] = None
    contact_details: Optional[str] = None
    order_number: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[str] = None


class MasterProposalCreate(MasterProposalBase):
    pass


class MasterProposalUpdate(MasterProposalBase):
    # All fields optional for partial update
    pass


class MasterProposalOut(MasterProposalBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MasterProposalBulk(BaseModel):
    items: List[MasterProposalCreate]


# -----------------------
# CRUD Endpoints
# -----------------------

@router.get("/", response_model=List[MasterProposalOut])
def list_master_proposals( db: Session = Depends(get_db)):
    """
    List master proposals with optional pagination.
    """
    proposals = db.query(models.model.MasterProposal).all()
    return proposals


@router.get("/count", summary="Count master proposals")
def count_master_proposals(db: Session = Depends(get_db)):
    total = db.query(models.model.MasterProposal).count()
    return {"count": total}


@router.get("/{proposal_id}", response_model=MasterProposalOut)
def get_master_proposal(proposal_id: int, db: Session = Depends(get_db)):
    """
    Get a single master proposal by ID.
    """
    proposal = db.query(models.model.MasterProposal).filter(models.model.MasterProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MasterProposal not found")
    return proposal


@router.post("/", response_model=MasterProposalOut, status_code=status.HTTP_201_CREATED)
def create_master_proposal(payload: MasterProposalCreate, db: Session = Depends(get_db)):
    """
    Create a single master proposal.
    """
    obj = models.model.MasterProposal(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def create_master_proposals_bulk(payload: MasterProposalBulk, db: Session = Depends(get_db)):
    """
    Bulk create master proposals. Accepts { "items": [ {..}, {..}, ... ] }.
    Returns created count and list of created ids.
    """
    items = payload.items
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No items provided")

    objs = [models.model.MasterProposal(**item.dict()) for item in items]

    # add_all is fine for typical sizes; for very large loads consider bulk_save_objects
    db.add_all(objs)
    db.commit()

    # refresh to get IDs
    created_ids = []
    for o in objs:
        db.refresh(o)
        created_ids.append(o.id)

    return {"created": len(objs), "ids": created_ids}


@router.put("/{proposal_id}", response_model=MasterProposalOut)
def update_master_proposal(proposal_id: int, payload: MasterProposalUpdate, db: Session = Depends(get_db)):
    """
    Update a master proposal. Partial updates supported (only provide fields to change).
    """
    proposal = db.query(models.model.MasterProposal).filter(models.model.MasterProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MasterProposal not found")

    update_data: Dict[str, Any] = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        # ensure the attribute exists on the model
        if hasattr(proposal, field):
            setattr(proposal, field, value)

    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.delete("/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_master_proposal(proposal_id: int, db: Session = Depends(get_db)):
    """
    Delete a master proposal by ID.
    """
    proposal = db.query(models.model.MasterProposal).filter(models.model.MasterProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MasterProposal not found")

    db.delete(proposal)
    db.commit()
    return None



@router.get("/by-indentor/{name}", response_model=List[MasterProposalOut])
def get_master_proposals_by_indentor(
    name: str,
    db: Session = Depends(get_db)
):
    """
    Get all master proposals where the indentor contains the given name.
    Case-insensitive partial match.
    """
    proposals = (
        db.query(models.model.MasterProposal)
        .filter(models.model.MasterProposal.indentor.ilike(f"%{name}%"))
        .all()
    )

    return proposals



@router.get("/by-indentor/{name}/count", summary="Count master proposals by indentor")
def count_master_proposals_by_indentor(
    name: str,
    db: Session = Depends(get_db)
):
    """
    Count master proposals where the indentor contains the given name.
    """
    total = (
        db.query(func.count(models.model.MasterProposal.id))
        .filter(models.model.MasterProposal.indentor.ilike(f"%{name}%"))
        .scalar()
    )

    return {"count": total}


