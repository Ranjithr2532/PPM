from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from models.model import ISODocumentList
from pydantic_schema.iso_document_list_schema import (
    ISODocumentListCreate,
    ISODocumentListUpdate,
    ISODocumentListResponse,
)

router = APIRouter(prefix="/iso-document-list", tags=["ISO Document List Management"])


@router.get("/", response_model=List[ISODocumentListResponse])
def list_iso_documents(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    # Auto-seed standard ISO document templates if missing doc 037 or 009
    existing_037 = db.query(ISODocumentList).filter(ISODocumentList.document_no == "037").first()
    if not existing_037:
        mom_doc = ISODocumentList(
            name="Minutes of Meeting",
            initial="MM",
            code="CMTI-QMS-SMPM-037/Rev00",
            document_no="037",
            is_active=True,
        )
        db.add(mom_doc)
        db.commit()

    existing_009 = db.query(ISODocumentList).filter(ISODocumentList.document_no == "009").first()
    if not existing_009:
        pp_doc = ISODocumentList(
            name="PROJECT PROPOSAL",
            initial="PP",
            code="CMTI-QMS-SMPM-009/Rev00",
            document_no="009",
            is_active=True,
        )
        db.add(pp_doc)
        db.commit()

    query = db.query(ISODocumentList)
    if is_active is not None:
        query = query.filter(ISODocumentList.is_active == is_active)
    return query.order_by(ISODocumentList.id.asc()).all()



@router.get("/{doc_id}", response_model=ISODocumentListResponse)
def get_iso_document(doc_id: int, db: Session = Depends(get_db)):
    rec = db.query(ISODocumentList).filter(ISODocumentList.id == doc_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ISO Document record with ID {doc_id} not found",
        )
    return rec


@router.post("/", response_model=ISODocumentListResponse, status_code=status.HTTP_201_CREATED)
def create_iso_document(payload: ISODocumentListCreate, db: Session = Depends(get_db)):
    new_doc = ISODocumentList(
        name=payload.name,
        initial=payload.initial,
        code=payload.code,
        document_no=payload.document_no,
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc


@router.put("/{doc_id}", response_model=ISODocumentListResponse)
def update_iso_document(
    doc_id: int, payload: ISODocumentListUpdate, db: Session = Depends(get_db)
):
    rec = db.query(ISODocumentList).filter(ISODocumentList.id == doc_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ISO Document record with ID {doc_id} not found",
        )

    update_dict = payload.dict(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(rec, k, v)

    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_iso_document(doc_id: int, db: Session = Depends(get_db)):
    rec = db.query(ISODocumentList).filter(ISODocumentList.id == doc_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ISO Document record with ID {doc_id} not found",
        )

    db.delete(rec)
    db.commit()
    return None
