from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from models.model import Stage
from pydantic_schema.request import StageCreate, StageUpdate
from pydantic_schema.response import StageResponse

router = APIRouter(prefix="/stages", tags=["Stages"])


# ---------------------------------------
# CREATE — INSERT AT SPECIFIED POSITION
# ---------------------------------------
@router.post("/", response_model=StageResponse, status_code=status.HTTP_201_CREATED)
def create_stage(payload: StageCreate, db: Session = Depends(get_db)) -> StageResponse:

    # Shift other stages down by 1
    db.query(Stage).filter(Stage.position >= payload.position).update(
        {Stage.position: Stage.position + 1},
        synchronize_session=False,
    )

    stage = Stage(**payload.dict())
    db.add(stage)
    db.commit()
    db.refresh(stage)

    return stage


# ---------------------------------------
# LIST — ALWAYS SORT BY POSITION
# ---------------------------------------
@router.get("/", response_model=List[StageResponse])
def list_stages(db: Session = Depends(get_db)) -> List[StageResponse]:
    return db.query(Stage).order_by(Stage.position).all()


# ---------------------------------------
# GET BY ID
# ---------------------------------------
@router.get("/{stage_id}", response_model=StageResponse)
def get_stage(stage_id: int, db: Session = Depends(get_db)) -> StageResponse:
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    return stage


# ---------------------------------------
# UPDATE — HANDLE REORDERING AND ALL FIELDS
# ---------------------------------------
@router.put("/{stage_id}", response_model=StageResponse)
def update_stage(stage_id: int, payload: StageUpdate, db: Session = Depends(get_db)) -> StageResponse:
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    update_data = payload.dict(exclude_unset=True)

    # If position changed, reorder everything
    if "position" in update_data:
        new_pos = update_data["position"]
        old_pos = stage.position

        if new_pos != old_pos:
            if new_pos < old_pos:
                # Move others down
                db.query(Stage).filter(
                    Stage.id != stage_id,
                    Stage.position >= new_pos,
                    Stage.position < old_pos,
                ).update({Stage.position: Stage.position + 1}, synchronize_session=False)

            elif new_pos > old_pos:
                # Move others up
                db.query(Stage).filter(
                    Stage.id != stage_id,
                    Stage.position > old_pos,
                    Stage.position <= new_pos,
                ).update({Stage.position: Stage.position - 1}, synchronize_session=False)

    # Handle access field specially if it's a list
    if "access" in update_data:
        access_value = update_data["access"]
        # If access is a list, join it with commas or store as JSON
        if isinstance(access_value, list):
            # Option 1: Store as comma-separated string
            stage.access = ",".join(access_value)
            # Option 2: Store as JSON string (uncomment if preferred)
            # import json
            # stage.access = json.dumps(access_value)
        else:
            stage.access = access_value
        update_data.pop("access")  # Remove it so setattr doesn't override

    # Update all other fields dynamically
    for field, value in update_data.items():
        setattr(stage, field, value)

    db.commit()
    db.refresh(stage)

    return stage


# ---------------------------------------
# DELETE — SHIFT POSITIONS UP
# ---------------------------------------
@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage(stage_id: int, db: Session = Depends(get_db)):

    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    deleted_position = stage.position

    db.delete(stage)

    # Shift all below upward
    db.query(Stage).filter(Stage.position > deleted_position).update(
        {Stage.position: Stage.position - 1},
        synchronize_session=False,
    )

    db.commit()