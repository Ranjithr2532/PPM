import os
import io
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile, Form
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from db import get_db
from models.model import ISOSubmission, ISODocument
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


def build_iso_docx_object(rec: ISOSubmission, db: Session):
    h_data = rec.header_data or {}
    f_data = rec.form_data or {}
    doc_type = (rec.doc_type or "FEASIBILITY").upper()

    doc_no = rec.document_no or h_data.get("docNo") or ""
    centre_dept = h_data.get("centreDept") or ""
    date_str = h_data.get("dateStr") or (rec.created_at.strftime("%d-%m-%Y") if rec.created_at else "")
    group_name = h_data.get("groupName") or ""

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

        doc_code = h_data.get("code") or group_name or ""
        doc = create_feasibility_document(
            party_details=f_data.get("party_details", ""),
            enquiry_ref=f_data.get("enquiry_ref_no") or f_data.get("enquiry_ref", ""),
            description=f_data.get("description_of_the_enquiry") or f_data.get("description", ""),
            review_points=review_points_objs,
            conclusion=f_data.get("conclusion", ""),
            centre_dept=centre_dept,
            group_name=group_name,
            doc_no=doc_no,
            doc_date=date_str,
            prepared_by=prepared_by,
            approved_by=approved_by,
            doc_code=doc_code
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
            conclusion=f_data.get("conclusion", ""),
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

        doc_code = h_data.get("code") or group_name or ""
        doc = create_mom_document(
            meeting_date_time=f_data.get("meeting_date_time", ""),
            meeting_location=f_data.get("meeting_location", ""),
            prev_mom_no_date=f_data.get("prev_mom_no_date", ""),
            prev_action_points=f_data.get("prev_action_points", ""),
            prev_status=f_data.get("prev_status", ""),
            agenda=f_data.get("agenda", ""),
            summary_points=points_objs,
            conclusion=f_data.get("conclusion", ""),
            centre_dept=centre_dept,
            group_name=group_name,
            doc_no=doc_no,
            doc_date=date_str,
            prepared_by=prepared_by,
            approved_by=approved_by,
            doc_code=doc_code
        )
        filename = f"ISO_MOM_{doc_no.replace('/', '_')}.docx"

    elif doc_type in ["PROJECT_PROPOSAL", "PROJECTPROPSASL"]:
        from iso.projectpropsasl import create_project_proposal_document, BudgetItemRequest, EquipmentItemRequest
        raw_rec = f_data.get("recurring_budget", [])
        rec_objs = [BudgetItemRequest(**i) if isinstance(i, dict) else i for i in raw_rec] if isinstance(raw_rec, list) else None
        raw_non_rec = f_data.get("non_recurring_budget", [])
        non_rec_objs = [BudgetItemRequest(**i) if isinstance(i, dict) else i for i in raw_non_rec] if isinstance(raw_non_rec, list) else None
        raw_eq = f_data.get("equipment_details", [])
        eq_objs = [EquipmentItemRequest(**i) if isinstance(i, dict) else i for i in raw_eq] if isinstance(raw_eq, list) else None

        doc = create_project_proposal_document(
            title_of_project=f_data.get("title_of_project", ""),
            project_no=f_data.get("project_no", ""),
            project_category=f_data.get("project_category", ""),
            sponsoring_agency=f_data.get("sponsoring_agency", ""),
            sanction_order=f_data.get("sanction_order", ""),
            total_cost=f_data.get("total_cost", ""),
            project_leader=f_data.get("project_leader", ""),
            co_leaders=f_data.get("co_leaders", ""),
            core_st_members=f_data.get("core_st_members"),
            dev_partners_name=f_data.get("dev_partners_name", ""),
            dev_partners_roles=f_data.get("dev_partners_roles", ""),
            commencement_date=f_data.get("commencement_date", ""),
            completion_date=f_data.get("completion_date", ""),
            proposed_objectives=f_data.get("proposed_objectives"),
            current_status=f_data.get("current_status", ""),
            research_tasks=f_data.get("research_tasks"),
            task_active_months=f_data.get("task_active_months") or f_data.get("taskActiveMonths"),
            salient_achievements=f_data.get("salient_achievements", ""),
            expected_trl=f_data.get("expected_trl", ""),
            ipr_details=f_data.get("ipr_details", ""),
            human_resources=f_data.get("human_resources"),
            revenue_generated=f_data.get("revenue_generated", ""),
            recurring_budget=rec_objs,
            non_recurring_budget=non_rec_objs,
            equipment_details=eq_objs,
            infrastructure_details=f_data.get("infrastructure_details", ""),
            prepared_by=prepared_by,
            approved_by=approved_by,
            group_name=group_name,
            centre_dept=centre_dept,
            doc_no=doc_no,
            doc_date=date_str
        )
        filename = f"ISO_ProjectProposal_{doc_no.replace('/', '_')}.docx"

    elif doc_type in ["PROJECT_PLAN", "PROJECTPLAN", "053"]:
        from iso.projectplan import create_project_plan_document
        doc = create_project_plan_document(
            project_title=f_data.get("project_title") or f_data.get("title_of_project") or "",
            schedule_title=f_data.get("schedule_title", ""),
            project_no=f_data.get("project_no", ""),
            customer_name=f_data.get("customer_name", ""),
            commencement_date=f_data.get("commencement_date", ""),
            completion_date=f_data.get("completion_date", ""),
            total_months=int(f_data.get("total_months") or 0),
            tasks=f_data.get("tasks"),
            task_active_weeks=f_data.get("task_active_weeks") or f_data.get("taskActiveWeeks"),
            prepared_by=prepared_by,
            approved_by=approved_by,
            group_name=group_name,
            centre_dept=centre_dept,
            doc_no=doc_no,
            doc_date=date_str
        )
        filename = f"ISO_ProjectPlan_{doc_no.replace('/', '_')}.docx"

    elif doc_type in ["SQAP", "SOFTWARE_QUALITY_ASSURANCE_PLAN", "055"]:
        from iso.sqap import create_sqap_document
        doc = create_sqap_document(
            project_title=f_data.get("project_title") or f_data.get("title_of_project") or "",
            customer_name=f_data.get("customer_name", ""),
            sanction_letter_no=f_data.get("sanction_letter_no") or f_data.get("project_sanction_letter_no") or f_data.get("project_no") or "",
            project_no=f_data.get("project_no", ""),
            software_version=f_data.get("software_version", "v1.0"),
            released_by_org=f_data.get("released_by_org") or f_data.get("released_org") or "CMTI",
            user_agency_org=f_data.get("user_agency_org") or f_data.get("agency_org") or "",
            prepared_by_name=f_data.get("prepared_by_name") or f_data.get("prepared_by") or prepared_by or "",
            prepared_by_sig=f_data.get("prepared_by_sig") or "",
            checked_by_name=f_data.get("checked_by_name") or f_data.get("checked_by") or "",
            checked_by_sig=f_data.get("checked_by_sig") or "",
            approved_by_name=f_data.get("approved_by_name") or f_data.get("approved_by") or approved_by or "",
            approved_by_sig=f_data.get("approved_by_sig") or "",
            user_agency_rows=f_data.get("user_agency_rows"),
            prepared_by=prepared_by,
            approved_by=approved_by,
            group_name=group_name,
            centre_dept=centre_dept,
            doc_no=doc_no,
            doc_date=date_str
        )
        filename = f"ISO_SQAP_{doc_no.replace('/', '_')}.docx"

    elif doc_type in ["BOM", "BILL_OF_MATERIALS", "063"]:
        from iso.bom import create_bom_document
        doc = create_bom_document(
            project_title=f_data.get("project_title") or f_data.get("title_of_project") or "",
            project_no=f_data.get("project_no", ""),
            customer_name=f_data.get("customer_name", ""),
            assembly_name=f_data.get("assembly_name", ""),
            bom_rev=f_data.get("bom_rev", ""),
            items=f_data.get("items"),
            sections=f_data.get("sections"),
            total_estimated_cost=str(f_data.get("total_estimated_cost") or ""),
            prepared_by=prepared_by,
            approved_by=approved_by,
            group_name=group_name,
            centre_dept=centre_dept,
            doc_no=doc_no,
            doc_date=date_str
        )
        filename = f"ISO_BOM_{doc_no.replace('/', '_')}.docx"

    elif doc_type in ["DRAWING_REGISTER", "DRAWING_ISSUE_REGISTER", "064"]:
        from iso.drawingregister import create_drawing_register_document
        doc = create_drawing_register_document(
            project_title=f_data.get("project_title") or f_data.get("title_of_project") or "",
            project_no=f_data.get("project_no", ""),
            customer_name=f_data.get("customer_name", ""),
            sub_system=f_data.get("sub_system", ""),
            register_rev=f_data.get("register_rev", ""),
            items=f_data.get("items"),
            sections=f_data.get("sections"),
            prepared_by=prepared_by,
            approved_by=approved_by,
            group_name=group_name,
            centre_dept=centre_dept,
            doc_no=doc_no,
            doc_date=date_str
        )
        filename = f"ISO_Drawing_Issue_Register_{doc_no.replace('/', '_')}.docx"

    elif doc_type in ["INSPECTION_REPORT", "085"]:
        from iso.Inspection_report import create_inspection_report_document
        doc = create_inspection_report_document(
            report_no=f_data.get("report_no", ""),
            date=f_data.get("date", ""),
            project_no=f_data.get("project_no", ""),
            type=f_data.get("type", ""),
            drawing_no=f_data.get("drawing_no", ""),
            drawing_name=f_data.get("drawing_name", ""),
            quantity=f_data.get("quantity", ""),
            rows=f_data.get("rows"),
            prepared_by=prepared_by,
            approved_by=approved_by,
            group_name=group_name,
            centre_dept=centre_dept,
            doc_no=doc_no,
            doc_date=date_str
        )
        filename = f"ISO_Inspection_Report_{doc_no.replace('/', '_')}.docx"

    else:
        from iso.generic_iso import create_generic_iso_document
        clean_name = doc_type.replace('_', ' ').title()
        doc = create_generic_iso_document(
            doc_title=f_data.get("doc_title") or clean_name,
            doc_code=f_data.get("doc_code") or h_data.get("code") or "",
            doc_no=doc_no,
            doc_date=date_str,
            centre_dept=centre_dept,
            group_name=group_name,
            project_title=f_data.get("project_title") or f_data.get("title_of_project") or "",
            project_no=f_data.get("project_no", ""),
            customer_name=f_data.get("customer_name", ""),
            description=f_data.get("description", ""),
            custom_headers=f_data.get("custom_headers") or f_data.get("headers") or (f_data.get("items", [{}])[0].keys() if f_data.get("items") and isinstance(f_data.get("items"), list) and isinstance(f_data.get("items")[0], dict) else None),
            custom_rows=f_data.get("custom_rows") or f_data.get("rows") or ([[v for v in item.values()] for item in f_data.get("items", [])] if f_data.get("items") and isinstance(f_data.get("items"), list) and isinstance(f_data.get("items")[0], dict) else None),
            sections=f_data.get("sections"),
            checklist_points=f_data.get("checklist_points") or f_data.get("review_points"),
            conclusion=f_data.get("conclusion", ""),
            prepared_by=prepared_by,
            approved_by=approved_by
        )
        safe_name = clean_name.replace(' ', '_')
        filename = f"ISO_{safe_name}_{doc_no.replace('/', '_') if doc_no else 'Doc'}.docx"

    return doc, filename


def save_generated_iso_file(rec: ISOSubmission, db: Session):
    try:
        f_data = rec.form_data or {}
        if f_data.get("is_uploaded"):
            return

        doc, filename = build_iso_docx_object(rec, db)
        if not doc or not filename:
            return

        from services.minio_client import _get_client, _ensure_bucket, _build_public_url, MINIO_BUCKET
        from uuid import uuid4

        # Save docx to memory
        mem_stream = io.BytesIO()
        doc.save(mem_stream)
        mem_stream.seek(0)
        data_bytes = mem_stream.getvalue()

        safe_doc_type = (rec.doc_type or "ISO").replace('/', '_')
        safe_doc_no = (rec.document_no or "000").replace('/', '_')
        object_name = f"documents/{uuid4().hex}_{safe_doc_type}_{safe_doc_no}_{filename}"

        client = _get_client()
        _ensure_bucket(client)
        client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=io.BytesIO(data_bytes),
            length=len(data_bytes),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        minio_url = _build_public_url(object_name)

        # Save file_path inside ISOSubmission form_data
        updated_f_data = {**(rec.form_data or {}), "file_path": minio_url, "saved_filename": filename, "object_name": object_name}
        rec.form_data = updated_f_data

        # Update or Insert into iso_documents table
        existing_doc = db.query(ISODocument).filter(ISODocument.submission_id == rec.id).first()
        if existing_doc:
            existing_doc.file_name = filename
            existing_doc.file_path = minio_url
            existing_doc.file_type = "docx"
            existing_doc.file_size = len(data_bytes)
        else:
            iso_doc_rec = ISODocument(
                doc_type=rec.doc_type,
                document_no=rec.document_no,
                proposal_id=rec.proposal_id,
                submission_id=rec.id,
                file_name=filename,
                file_path=minio_url,
                file_type="docx",
                file_size=len(data_bytes),
                is_uploaded=False,
                uploaded_by=rec.created_by
            )
            db.add(iso_doc_rec)

        # Save to main documents table if proposal_id exists
        if rec.proposal_id:
            from models.model import Document as MainDocument
            main_doc = db.query(MainDocument).filter(
                MainDocument.project_id == rec.proposal_id,
                MainDocument.name == f"{rec.doc_type}_{rec.document_no}"
            ).first()
            if not main_doc:
                main_doc = MainDocument(
                    name=f"{rec.doc_type}_{rec.document_no}",
                    description=f"ISO Document #{rec.document_no} ({rec.doc_type})",
                    project_id=rec.proposal_id,
                    uploaded_by=str(rec.created_by) if rec.created_by else "System",
                    url=minio_url
                )
                db.add(main_doc)
            else:
                main_doc.url = minio_url

        db.commit()
        db.refresh(rec)
    except Exception as e:
        print(f"Error saving generated ISO file to MinIO: {e}")


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

    # Save physical .docx file in MinIO and URL in database tables
    save_generated_iso_file(new_sub, db)

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

    update_dict = payload.dict(exclude_unset=True)
    if "doc_type" in update_dict and update_dict["doc_type"]:
        update_dict["doc_type"] = update_dict["doc_type"].upper()
    if "status" in update_dict and update_dict["status"]:
        update_dict["status"] = update_dict["status"].upper()

    for k, v in update_dict.items():
        setattr(rec, k, v)

    db.commit()
    db.refresh(rec)

    # Save physical .docx file in MinIO and URL in database tables
    save_generated_iso_file(rec, db)

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


@router.post("/upload-file", response_model=ISOSubmissionResponse, status_code=status.HTTP_201_CREATED)
async def upload_iso_document_file(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    document_no: str = Form(...),
    proposal_id: Optional[int] = Form(None),
    created_by: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    from services.minio_client import upload_file_to_minio

    # Upload file directly to MinIO (same as routes/documents.py)
    object_name, minio_url = await upload_file_to_minio(file)

    query = db.query(ISOSubmission).filter(ISOSubmission.doc_type == doc_type.upper())
    if proposal_id:
        query = query.filter(ISOSubmission.proposal_id == proposal_id)
    rec = query.first()

    form_payload = {
        "file_path": minio_url,
        "uploaded_filename": file.filename,
        "object_name": object_name,
        "is_uploaded": True
    }

    if rec:
        rec.form_data = {**(rec.form_data or {}), **form_payload}
        rec.status = "SUBMITTED"
        if created_by:
            rec.updated_by = created_by
    else:
        rec = ISOSubmission(
            doc_type=doc_type.upper(),
            document_no=document_no,
            proposal_id=proposal_id,
            form_data=form_payload,
            status="SUBMITTED",
            created_by=created_by
        )
        db.add(rec)

    db.commit()
    db.refresh(rec)

    # Save to iso_documents table as well
    iso_doc_record = ISODocument(
        doc_type=doc_type.upper(),
        document_no=document_no,
        proposal_id=proposal_id,
        submission_id=rec.id,
        file_name=file.filename,
        file_path=minio_url,
        file_type=file.filename.split('.')[-1].lower() if '.' in file.filename else None,
        file_size=0,
        is_uploaded=True,
        uploaded_by=created_by
    )
    db.add(iso_doc_record)

    # Save to main documents table if proposal_id exists
    if proposal_id:
        from models.model import Document as MainDocument
        main_doc = db.query(MainDocument).filter(
            MainDocument.project_id == proposal_id,
            MainDocument.name == f"{doc_type}_{document_no}"
        ).first()
        if not main_doc:
            main_doc = MainDocument(
                name=f"{doc_type}_{document_no}",
                description=f"ISO Document #{document_no} ({doc_type})",
                project_id=proposal_id,
                uploaded_by=str(created_by) if created_by else "System",
                url=minio_url
            )
            db.add(main_doc)
        else:
            main_doc.url = minio_url

    db.commit()
    return rec


@router.get("/{sub_id}/export-word")
def export_submission_word(sub_id: int, db: Session = Depends(get_db)):
    rec = db.query(ISOSubmission).filter(ISOSubmission.id == sub_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Submission record not found")

    f_data = rec.form_data or {}

    # If uploaded file exists in MinIO or local, redirect/stream it
    if f_data.get("is_uploaded") and f_data.get("file_path"):
        file_p = f_data["file_path"]
        if file_p.startswith("http"):
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=file_p)
        rel_p = file_p.lstrip("/").replace("/", os.sep)
        abs_p = os.path.join(os.getcwd(), rel_p)
        if os.path.exists(abs_p):
            up_name = f_data.get("uploaded_filename") or os.path.basename(abs_p)
            return FileResponse(abs_p, filename=up_name)

    doc, filename = build_iso_docx_object(rec, db)
    if not doc or not filename:
        raise HTTPException(status_code=400, detail=f"Unsupported document type {rec.doc_type}")

    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.delete("/{sub_id}")
def delete_iso_submission(sub_id: int, db: Session = Depends(get_db)):
    rec = db.query(ISOSubmission).filter(ISOSubmission.id == sub_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Submission record not found")
    db.delete(rec)
    db.commit()
    return {"message": "Submission deleted successfully", "id": sub_id}
