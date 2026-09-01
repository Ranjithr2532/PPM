from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from db import get_db
from models.model import Staff, Centre, Group
from pydantic_schema.staff_schema import (
    StaffCreate, StaffUpdate, StaffResponse
)

router = APIRouter(prefix="/staff", tags=["Staff"])


def format_staff_response(staff: Staff) -> StaffResponse:
    data = {
        "pf_id": staff.pf_id,
        "name": staff.name,
        "centre_id": staff.centre_id,
        "group_id": staff.group_id,
        "designation": staff.designation,
        "type": staff.type,
        "role": staff.role,
        "centre_name": staff.centre.name if staff.centre else None,
        "group_name": staff.group.name if staff.group else None
    }
    return StaffResponse(**data)


# CREATE STAFF
@router.post("/", response_model=StaffResponse)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db)):
    if payload.centre_id is not None:
        centre = db.query(Centre).filter(Centre.id == payload.centre_id).first()
        if not centre:
            raise HTTPException(status_code=400, detail="Invalid centre_id: Centre does not exist")

    if payload.group_id is not None:
        group = db.query(Group).filter(Group.id == payload.group_id).first()
        if not group:
            raise HTTPException(status_code=400, detail="Invalid group_id: Group does not exist")

    new_staff = Staff(**payload.dict())
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return format_staff_response(new_staff)


# GET STAFF LIST (ONLY BASED ON ID)
@router.get("/", response_model=List[StaffResponse])
def get_staff_list(
    id: Optional[int] = Query(None, description="Staff ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Staff)
    if id is not None:
        query = query.filter(Staff.pf_id == id)

    items = query.order_by(Staff.pf_id.asc()).all()
    return [format_staff_response(s) for s in items]


# GET STAFF BY CENTRE ID
@router.get("/center/{centre_id}", response_model=List[StaffResponse])
@router.get("/centre/{centre_id}", response_model=List[StaffResponse])
def get_staff_by_centre(centre_id: int, db: Session = Depends(get_db)):
    centre = db.query(Centre).filter(Centre.id == centre_id).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Centre not found")

    staff_members = (
        db.query(Staff)
        .filter(Staff.centre_id == centre_id)
        .order_by(Staff.pf_id.asc())
        .all()
    )
    return [format_staff_response(s) for s in staff_members]


# GET STAFF BY GROUP ID
@router.get("/group/{group_id}", response_model=List[StaffResponse])
def get_staff_by_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    staff_members = (
        db.query(Staff)
        .filter(Staff.group_id == group_id)
        .order_by(Staff.pf_id.asc())
        .all()
    )
    return [format_staff_response(s) for s in staff_members]


# GET STAFF BY PF_ID
@router.get("/{pf_id}", response_model=StaffResponse)
def get_staff_by_id(pf_id: int, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.pf_id == pf_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return format_staff_response(staff)


# UPDATE STAFF
@router.put("/{pf_id}", response_model=StaffResponse)
def update_staff(pf_id: int, payload: StaffUpdate, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.pf_id == pf_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    update_data = payload.dict(exclude_unset=True)

    if "centre_id" in update_data and update_data["centre_id"] is not None:
        centre = db.query(Centre).filter(Centre.id == update_data["centre_id"]).first()
        if not centre:
            raise HTTPException(status_code=400, detail="Invalid centre_id")

    if "group_id" in update_data and update_data["group_id"] is not None:
        group = db.query(Group).filter(Group.id == update_data["group_id"]).first()
        if not group:
            raise HTTPException(status_code=400, detail="Invalid group_id")

    for key, value in update_data.items():
        setattr(staff, key, value)

    db.commit()
    db.refresh(staff)
    return format_staff_response(staff)


# DELETE STAFF
@router.delete("/{pf_id}")
def delete_staff(pf_id: int, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.pf_id == pf_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    db.delete(staff)
    db.commit()
    return {"message": "Staff member deleted successfully", "pf_id": pf_id}
