from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from models.model import Progress, Proposal, Stage
from pydantic_schema.request import ProgressCreate, ProgressUpdate
from pydantic_schema.response import ProgressResponse

router = APIRouter(prefix="/progress", tags=["Progress"])


def _ensure_related_entities(
    db: Session, project_id: Optional[int], stage_id: Optional[int]
) -> None:
    if project_id is not None:
        exists = db.query(Proposal.id).filter(Proposal.id == project_id).first()
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with id {project_id} not found",
            )
    if stage_id is not None:
        exists = db.query(Stage.id).filter(Stage.id == stage_id).first()
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stage with id {stage_id} not found",
            )


@router.post("/", response_model=ProgressResponse, status_code=status.HTTP_201_CREATED)
def create_progress(
    payload: ProgressCreate, db: Session = Depends(get_db)
) -> ProgressResponse:
    _ensure_related_entities(db, payload.project_id, payload.stage_id)
    progress = Progress(**payload.dict(exclude_unset=True))
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


@router.get("/", response_model=List[ProgressResponse])
def list_progress(db: Session = Depends(get_db)) -> List[ProgressResponse]:
    return db.query(Progress).all()


@router.get("/{progress_id}", response_model=ProgressResponse)
def get_progress(
    progress_id: int, db: Session = Depends(get_db)
) -> ProgressResponse:
    progress = db.query(Progress).filter(Progress.id == progress_id).first()
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Progress not found",
        )
    return progress


@router.put("/{progress_id}", response_model=ProgressResponse)
def update_progress(
    progress_id: int,
    payload: ProgressUpdate,
    db: Session = Depends(get_db),
) -> ProgressResponse:
    progress = db.query(Progress).filter(Progress.id == progress_id).first()
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Progress not found",
        )

    _ensure_related_entities(db, payload.project_id, payload.stage_id)

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(progress, key, value)

    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


@router.delete("/{progress_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_progress(progress_id: int, db: Session = Depends(get_db)) -> None:
    progress = db.query(Progress).filter(Progress.id == progress_id).first()
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Progress not found",
        )

    db.delete(progress)
    db.commit()

