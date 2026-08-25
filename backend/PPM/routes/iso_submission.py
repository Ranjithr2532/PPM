import io
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db import get_db
from models.model import ISOSubmission
from models.user_model import User

from pydantic_schema.iso_submission_schema import (
    ISOSubmissionCreate,
    ISOSubmissionUpdate,
    ISOSubmissionStatusUpdate,
    ISOSubmissionResponse,
)

router = APIRouter(prefix="/iso-submissions", tags=["ISO Submissions & Approval Workflow"])


@router.get("/", response_model=List[ISOSubmissionResponse])
def list_iso_submissions(
    doc_type: Optional[str] = Query(None, description="Filter by document type (FEASIBILITY, CONTRACT_REVIEW, PROJECT_TEAM)"),
    status: Optional[str] = Query(None, description="Filter by status (DRAFT, SUBMITTED, APPROVED, REJECTED)"),
    created_by: Optional[int] = Query(None, description="Filter by creator user ID"),
    proposal_id: Optional[int] = Query(None, description="Filter by proposal ID"),
    db: Session = Depends(get_db),
):
    query = db.query(ISOSubmission)
    if doc_type:
        query = query.filter(ISOSubmission.doc_type == doc_type.upper())
    if status:
        query = query.filter(ISOSubmission.status == status.upper())
    if created_by is not None:
        query = query.filter(ISOSubmission.created_by == created_by)
    if proposal_id is not None:
        query = query.filter(ISOSubmission.proposal_id == proposal_id)

    return query.order_by(ISOSubmission.updated_at.desc()).all()


@router.get("/{sub_id}", response_model=ISOSubmissionResponse)
def get_iso_submission(sub_id: int, db: Session = Depends(get_db)):
    rec = db.query(ISOSubmission).filter(ISOSubmission.id == sub_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ISO Submission with ID {sub_id} not found",
        )
    return rec


@router.post("/", response_model=ISOSubmissionResponse, status_code=status.HTTP_201_CREATED)
def create_iso_submission(payload: ISOSubmissionCreate, db: Session = Depends(get_db)):
    new_status = (payload.status or "DRAFT").upper()
    new_sub = ISOSubmission(
        doc_type=(payload.doc_type or "FEASIBILITY").upper(),
        document_no=payload.document_no,
        proposal_id=payload.proposal_id,
        header_data=payload.header_data or {},
        form_data=payload.form_data or {},
        status=new_status,
        rejection_comment=payload.rejection_comment,
        created_by=payload.created_by,
        updated_by=payload.created_by,
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return new_sub


@router.put("/{sub_id}", response_model=ISOSubmissionResponse)
def update_iso_submission(
    sub_id: int, payload: ISOSubmissionUpdate, db: Session = Depends(get_db)
):
    rec = db.query(ISOSubmission).filter(ISOSubmission.id == sub_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ISO Submission with ID {sub_id} not found",
        )

    if rec.status == "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify an APPROVED ISO document. Approved documents are locked.",
        )

    update_dict = payload.dict(exclude_unset=True)
    if "doc_type" in update_dict and update_dict["doc_type"]:
        update_dict["doc_type"] = update_dict["doc_type"].upper()
    if "status" in update_dict and update_dict["status"]:
        update_dict["status"] = update_dict["status"].upper()

    for k, v in update_dict.items():
        setattr(rec, k, v)

    db.commit()
    db.refresh(rec)
    return rec



@router.patch("/{sub_id}/status", response_model=ISOSubmissionResponse)
def update_iso_submission_status(
    sub_id: int, payload: ISOSubmissionStatusUpdate, db: Session = Depends(get_db)
):
    rec = db.query(ISOSubmission).filter(ISOSubmission.id == sub_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ISO Submission with ID {sub_id} not found",
        )

    new_status = payload.status.upper()
    rec.status = new_status

    if new_status == "APPROVED":
        rec.approved_by = payload.approved_by
        rec.approved_at = datetime.utcnow()
        rec.rejection_comment = None
    elif new_status == "REJECTED":
        rec.rejection_comment = payload.rejection_comment
        rec.approved_by = None
        rec.approved_at = None
    else:
        rec.approved_by = None
        rec.approved_at = None

    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_iso_submission(sub_id: int, db: Session = Depends(get_db)):
    rec = db.query(ISOSubmission).filter(ISOSubmission.id == sub_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ISO Submission with ID {sub_id} not found",
        )

    db.delete(rec)
    db.commit()
    return None


@router.get("/{sub_id}/export-word")
def export_submission_word(sub_id: int, db: Session = Depends(get_db)):
    rec = db.query(ISOSubmission).filter(ISOSubmission.id == sub_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Submission record not found")

    h_data = rec.header_data or {}
    f_data = rec.form_data or {}
    doc_type = (rec.doc_type or "FEASIBILITY").upper()

    doc_no = rec.document_no or h_data.get("docNo") or "049/112"
    centre_dept = h_data.get("centreDept") or "SMPM"
    date_str = h_data.get("dateStr") or (rec.created_at.strftime("%d-%m-%Y") if rec.created_at else datetime.now().strftime("%d-%m-%Y"))
    group_name = h_data.get("groupName") or "SMPM"

    prepared_by = f_data.get("prepared_by") or h_data.get("preparedName") or h_data.get("prepared_by") or ""
    if not prepared_by and rec.created_by:
        creator = db.query(User).filter(User.id == rec.created_by).first()
        if creator:
            prepared_by = creator.full_name or creator.username or ""

    approved_by = f_data.get("approved_by") or h_data.get("approvedName") or h_data.get("approved_by") or ""
    if not approved_by and rec.approved_by:
        approver = db.query(User).filter(User.id == rec.approved_by).first()
        if approver:
            approved_by = approver.full_name or approver.username or ""


    if doc_type == "FEASIBILITY":
        from iso.fesiablity import create_feasibility_document, ReviewPointRequest
        
        raw_points = f_data.get("review_points", [])
        review_points_objs = []
        if isinstance(raw_points, list):
            for pt in raw_points:
                if isinstance(pt, dict):
                    review_points_objs.append(
                        ReviewPointRequest(
                            sl_no=pt.get("sl_no", 1),
                            point=pt.get("review_point") or pt.get("point", ""),
                            response=pt.get("yes_no_na") or pt.get("response", ""),
                            details=pt.get("details", "")
                        )
                    )

        doc = create_feasibility_document(
            party_details=f_data.get("party_details", ""),
            enquiry_ref=f_data.get("enquiry_ref_no") or f_data.get("enquiry_ref", ""),
            description=f_data.get("description_of_the_enquiry") or f_data.get("description", ""),
            review_points=review_points_objs,
            conclusion=f_data.get("conclusion") or "Feasible",
            centre_dept=centre_dept,
            group_name=group_name,
            doc_no=doc_no,
            doc_date=date_str,
            prepared_by=prepared_by,
            approved_by=approved_by
        )
        filename = f"ISO_Feasibility_{doc_no.replace('/', '_')}.docx"

    elif doc_type == "CONTRACT_REVIEW":
        from iso.contractreview import create_contract_review_document, ContractReviewPoint
        
        raw_points = f_data.get("review_points", [])
        review_points_objs = []
        if isinstance(raw_points, list):
            for pt in raw_points:
                if isinstance(pt, dict):
                    review_points_objs.append(
                        ContractReviewPoint(
                            sl_no=pt.get("sl_no", 1),
                            point=pt.get("review_point") or pt.get("point", ""),
                            response=pt.get("yes_no_na") or pt.get("response", ""),
                            details=pt.get("details", "")
                        )
                    )

        doc = create_contract_review_document(
            po_number=f_data.get("po_number", ""),
            po_date=f_data.get("po_date", ""),
            customer_name=f_data.get("customer_name", ""),
            work_order_no=f_data.get("work_order_no", ""),
            project_cost=f_data.get("project_cost", ""),
            pdc=f_data.get("pdc", ""),
            review_points=review_points_objs,
            conclusion=f_data.get("conclusion") or "Recommended",
            centre_dept=centre_dept,
            group_name=group_name,
            doc_no=doc_no,
            doc_date=date_str,
            prepared_by=prepared_by,
            approved_by=approved_by
        )
        filename = f"ISO_ContractReview_{doc_no.replace('/', '_')}.docx"

    elif doc_type == "PROJECT_TEAM":
        from iso.projectteam import create_project_team_document, TeamMember
        
        raw_members = f_data.get("team_members", [])
        members_objs = []
        if isinstance(raw_members, list):
            for m in raw_members:
                if isinstance(m, dict):
                    members_objs.append(
                        TeamMember(
                            sl_no=m.get("sl_no", 1),
                            name=m.get("name", ""),
                            role=m.get("role", ""),
                            responsibilities=m.get("responsibilities", "")
                        )
                    )

        doc = create_project_team_document(
            project_title=f_data.get("project_title", ""),
            project_no=f_data.get("project_no", ""),
            customer_name=f_data.get("customer_name", ""),
            project_leader=f_data.get("project_leader", ""),
            team_members=members_objs,
            centre_dept=centre_dept,
            group_name=group_name,
            doc_no=doc_no,
            doc_date=date_str,
            prepared_by=prepared_by,
            approved_by=approved_by
        )
        filename = f"ISO_ProjectTeam_{doc_no.replace('/', '_')}.docx"

    elif doc_type in ["MOM", "MINUTES_OF_MEETING"]:
        from iso.mom import create_mom_document, SummaryPointRequest

        raw_points = f_data.get("summary_points", [])
        points_objs = []
        if isinstance(raw_points, list):
            for p in raw_points:
                if isinstance(p, dict):
                    points_objs.append(
                        SummaryPointRequest(
                            sl_no=p.get("sl_no", 1),
                            points_discussed=p.get("points_discussed") or p.get("point", ""),
                            responsibility=p.get("responsibility", "")
                        )
                    )

        doc = create_mom_document(
            meeting_date_time=f_data.get("meeting_date_time", ""),
            meeting_location=f_data.get("meeting_location", ""),
            prev_mom_no_date=f_data.get("prev_mom_no_date", "-"),
            prev_action_points=f_data.get("prev_action_points", "-"),
            prev_status=f_data.get("prev_status", "-"),
            agenda=f_data.get("agenda") or "Project kick off meeting",
            summary_points=points_objs,
            conclusion=f_data.get("conclusion") or "Clearance was given for design of fixtures and electrical design.",
            centre_dept=centre_dept,
            group_name=group_name,
            doc_no=doc_no,
            doc_date=date_str,
            prepared_by=prepared_by,
            approved_by=approved_by
        )
        filename = f"ISO_MOM_{doc_no.replace('/', '_')}.docx"

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported document type {doc_type}")


    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
