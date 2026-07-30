from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from models.model import ManpowerRate
from pydantic_schema.manpower_schema import (
    ManpowerRateCreate,
    ManpowerRateUpdate,
)

router = APIRouter(prefix="/manpower-rates", tags=["Manpower Rates"])


# ---------- Endpoints ----------

@router.get("/")
def list_manpower_rates(db: Session = Depends(get_db)):
    rates = db.query(ManpowerRate).order_by(ManpowerRate.designation.asc()).all()
    return rates


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_manpower_rate(payload: ManpowerRateCreate, db: Session = Depends(get_db)):
    existing = db.query(ManpowerRate).filter(ManpowerRate.designation == payload.designation).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Rate for '{payload.designation}' already exists")

    rate = ManpowerRate(
        designation=payload.designation,
        rate_other_activities=payload.rate_other_activities,
        rate_design_developmental_activities=payload.rate_design_developmental_activities,
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate


@router.put("/{rate_id}")
def update_manpower_rate(rate_id: int, payload: ManpowerRateUpdate, db: Session = Depends(get_db)):
    rate = db.query(ManpowerRate).filter(ManpowerRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Manpower rate not found")

    if payload.designation is not None:
        duplicate = (
            db.query(ManpowerRate)
            .filter(ManpowerRate.designation == payload.designation, ManpowerRate.id != rate_id)
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=400, detail=f"Rate for '{payload.designation}' already exists")
        rate.designation = payload.designation

    if payload.rate_other_activities is not None:
        rate.rate_other_activities = payload.rate_other_activities

    if payload.rate_design_developmental_activities is not None:
        rate.rate_design_developmental_activities = payload.rate_design_developmental_activities

    db.commit()
    db.refresh(rate)
    return rate


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_manpower_rate(rate_id: int, db: Session = Depends(get_db)):
    rate = db.query(ManpowerRate).filter(ManpowerRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Manpower rate not found")
    db.delete(rate)
    db.commit()