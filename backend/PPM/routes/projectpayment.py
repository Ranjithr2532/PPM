from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models.model import ProjectPaymentStages
from pydantic_schema.projectpaymentschema import (
    ProjectPaymentStageCreate,
    ProjectPaymentStageUpdate,
    ProjectPaymentStageResponse
)

router = APIRouter(
    prefix="/payment-stages",
    tags=["Project Payment Stages"]
)


@router.post("/", response_model=ProjectPaymentStageResponse)
def create_payment_stage(data: ProjectPaymentStageCreate, db: Session = Depends(get_db)):
    new_stage = ProjectPaymentStages(**data.dict())
    db.add(new_stage)
    db.commit()
    db.refresh(new_stage)
    return new_stage


@router.get("/", response_model=List[ProjectPaymentStageResponse])
def get_all_payment_stages(db: Session = Depends(get_db)):
    stages = db.query(ProjectPaymentStages).order_by(ProjectPaymentStages.id.asc()).all()
    return stages



@router.get("/{stage_id}", response_model=ProjectPaymentStageResponse)
def get_payment_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = db.query(ProjectPaymentStages).filter(ProjectPaymentStages.id == stage_id).first()
    
    if not stage:
        raise HTTPException(status_code=404, detail="Payment stage not found")
    
    return stage



@router.put("/{stage_id}", response_model=ProjectPaymentStageResponse)
def update_payment_stage(stage_id: int, data: ProjectPaymentStageUpdate, db: Session = Depends(get_db)):
    stage = db.query(ProjectPaymentStages).filter(ProjectPaymentStages.id == stage_id).first()

    if not stage:
        raise HTTPException(status_code=404, detail="Payment stage not found")

    update_data = data.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(stage, key, value)

    db.commit()
    db.refresh(stage)
    return stage



@router.delete("/{stage_id}")
def delete_payment_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = db.query(ProjectPaymentStages).filter(ProjectPaymentStages.id == stage_id).first()

    if not stage:
        raise HTTPException(status_code=404, detail="Payment stage not found")

    db.delete(stage)
    db.commit()

    return {"message": "Payment stage deleted successfully"}