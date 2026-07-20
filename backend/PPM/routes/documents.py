from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from db import get_db
from models.model import Document, Proposal, Stage
from pydantic_schema.response import DocumentResponse
from services.minio_client import (
    delete_file_from_minio,
    extract_object_name_from_url,
    upload_file_to_minio,
)
from services.notification import create_notification


router = APIRouter(prefix="/documents", tags=["Documents"])


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


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    project_id: Optional[int] = Form(None),
    stage_id: Optional[int] = Form(None),
    uploaded_by: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    file: UploadFile = File(...),
    attachment: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
) -> DocumentResponse:

    # Validate project & stage
    _ensure_related_entities(db, project_id, stage_id)

    # Upload file to MinIO
    _, url = await upload_file_to_minio(file)
    
    # Upload each additional attachment to MinIO
    attachment_urls = []
    for att in attachment:
        if att.filename:  # skip empty file inputs
            _, att_url = await upload_file_to_minio(att)
            attachment_urls.append(att_url)

    # Save document in DB
    document = Document(
        name=name,
        description=description,
        project_id=project_id,
        stage_id=stage_id,
        uploaded_by=uploaded_by,
        url=url,
        attachment=attachment_urls if attachment_urls else None, 
        version=version,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    create_notification(
        db=db,
        user_name=uploaded_by,
        message=f"Document uploaded: {document.name}",
        proposal_id=project_id,
        document_id=document.id
    )

    # -------------------------------------------------------------
    # UPDATE PROPOSAL.CLOSER_REPORT = "Yes" ONLY IF stage == "Closure Report"
    # -------------------------------------------------------------
    if stage_id:
        stage = db.query(Stage).filter(Stage.id == stage_id).first()
        if stage and stage.name.strip().lower() == "closure report":
            proposal = db.query(Proposal).filter(Proposal.id == project_id).first()
            if proposal:
                proposal.closer_report = "Yes"
                db.commit()

    # -------------------------------------------------------------
    # RETURN DOCUMENT WITHOUT ANY closure_report FIELD LOGIC
    # -------------------------------------------------------------
    return DocumentResponse(
        id=document.id,
        name=document.name,
        description=document.description,
        url=document.url,
        attachment=document.attachment,
        project_id=document.project_id,
        stage_id=document.stage_id,
        uploaded_by=document.uploaded_by,
        version=document.version,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )

@router.get("/", response_model=List[DocumentResponse])
def list_documents(db: Session = Depends(get_db)) -> List[DocumentResponse]:

    documents = db.query(Document).all()
    result = []

    for doc in documents:
        stage_docs = db.query(Document).filter(Document.stage_id == doc.stage_id).first()
        closure_report = "Uploaded" if stage_docs else "Not Uploaded"

        result.append(
            DocumentResponse(
                id=doc.id,
                name=doc.name,
                description=doc.description,
                url=doc.url,
                attachment=doc.attachment, 
                project_id=doc.project_id,
                stage_id=doc.stage_id,
                uploaded_by=doc.uploaded_by,
                version=doc.version,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
                closure_report=closure_report,
            )
        )

    return result


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)) -> DocumentResponse:

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    stage_docs = db.query(Document).filter(Document.stage_id == doc.stage_id).first()
    closure_report = "Uploaded" if stage_docs else "Not Uploaded"

    return DocumentResponse(
        id=doc.id,
        name=doc.name,
        description=doc.description,
        url=doc.url,
        attachment=doc.attachment, 
        project_id=doc.project_id,
        stage_id=doc.stage_id,
        uploaded_by=doc.uploaded_by,
        version=doc.version,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        closure_report=closure_report,
    )


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    project_id: Optional[int] = Form(None),
    stage_id: Optional[int] = Form(None),
    uploaded_by: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
) -> DocumentResponse:

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    _ensure_related_entities(db, project_id, stage_id)

    if name: doc.name = name
    if description: doc.description = description
    if project_id: doc.project_id = project_id
    if stage_id: doc.stage_id = stage_id
    if uploaded_by: doc.uploaded_by = uploaded_by
    if version: doc.version = version

    if file:
        old_name = extract_object_name_from_url(doc.url)
        if old_name:
            delete_file_from_minio(old_name)
        _, url = await upload_file_to_minio(file)
        doc.url = url

    db.commit()
    db.refresh(doc)

    # Create notification only if uploaded_by is provided
    if uploaded_by:
        create_notification(
            db=db,
            user_name=uploaded_by,
            message=f"Document updated: {doc.name}",
            proposal_id=doc.project_id,
            document_id=doc.id
        )

    stage_docs = db.query(Document).filter(Document.stage_id == doc.stage_id).first()
    closure_report = "Uploaded" if stage_docs else "Not Uploaded"

    return DocumentResponse(
        id=doc.id,
        name=doc.name,
        description=doc.description,
        url=doc.url,
        project_id=doc.project_id,
        stage_id=doc.stage_id,
        uploaded_by=doc.uploaded_by,
        version=doc.version,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        closure_report=closure_report,
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db)) -> None:

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    obj = extract_object_name_from_url(doc.url)
    if obj:
        delete_file_from_minio(obj)

    db.delete(doc)
    db.commit()
