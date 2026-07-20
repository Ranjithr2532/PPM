from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.model import Centre
from pydantic_schema.centre_group import (
    CentreCreate, CentreResponse, CentreUpdate
)

router = APIRouter(prefix="/centres", tags=["Centres"])


# CREATE CENTRE
@router.post("/", response_model=CentreResponse)
def create_centre(centre: CentreCreate, db: Session = Depends(get_db)):
    new_centre = Centre(**centre.dict())
    db.add(new_centre)
    db.commit()
    db.refresh(new_centre)
    return new_centre


# GET ALL CENTRES
@router.get("/", response_model=list[CentreResponse])
def get_centres(db: Session = Depends(get_db)):
    return db.query(Centre).all()


# GET SINGLE CENTRE
@router.get("/{centre_id}", response_model=CentreResponse)
def get_centre(centre_id: int, db: Session = Depends(get_db)):
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(404, "Centre not found")
    return centre


# UPDATE CENTRE
@router.put("/{centre_id}", response_model=CentreResponse)
def update_centre(centre_id: int, data: CentreUpdate, db: Session = Depends(get_db)):
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(404, "Centre not found")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(centre, key, value)

    db.commit()
    db.refresh(centre)
    return centre


# DELETE CENTRE
@router.delete("/{centre_id}")
def delete_centre(centre_id: int, db: Session = Depends(get_db)):
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(404, "Centre not found")

    db.delete(centre)
    db.commit()
    return {"message": "Centre deleted successfully"}
