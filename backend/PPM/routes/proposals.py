from typing import Any, Dict, List, Optional
 
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func , desc , or_ , and_
from sqlalchemy import inspect as sa_inspect


from db import get_db
from models.model import Document, Payment, Progress, Proposal, Stage, MasterProposal, Notification
from pydantic_schema.request import (
    ProposalCreate,
    ProposalUpdate,
    CoordinatorUpdate,
    ProposalCoordinatorCreate , 
    AcknowledgeUpdate
)
from typing import List as ListType
from fastapi.encoders import jsonable_encoder
from pydantic_schema.response import ProposalResponse
from typing import List as ListType
from services.notification import create_notification
from datetime import date
import re

def sanitize_amount(val):
    """
    Sanitize amount values from Excel import.
    Handles Excel date corruption (e.g., 802750 stored as '4097-11-05').
    """
    if val is None or str(val).strip() in ['', '-', '--', 'nan', 'None']:
        return None
    s = str(val).strip().replace(',', '')
    # Fix Excel date corruption (e.g. 802750 stored as 4097-11-05)
    if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
        try:
            d = date.fromisoformat(s)
            return (d - date(1899, 12, 29)).days
        except:
            return None
    try:
        return float(s)
    except:
        return None


router = APIRouter(prefix="/proposals", tags=["Proposals"])


@router.get("/live-export")
def live_export_proposals(
    db: Session = Depends(get_db),
):
    proposals = (
        db.query(Proposal)
        .filter(Proposal.is_acknowledged == True)
        .order_by(desc(Proposal.id))
        .all()
    )

    proposal_columns = [c.name for c in Proposal.__table__.columns]

    def _proposal_label(column_name: str) -> str:
        return column_name.replace('_', ' ').title()

    def _to_str(value: Any) -> str:
        if value is None:
            return ""
        return str(value)

    result: List[Dict[str, Any]] = []
    for proposal in proposals:
        payments = (
            db.query(Payment)
            .filter(Payment.project_id == proposal.id)
            .order_by(Payment.id)
            .all()
        )

        row: Dict[str, Any] = {}
        for col in proposal_columns:
            row[_proposal_label(col)] = _to_str(getattr(proposal, col, None))

        for i, pay in enumerate(payments, 1):
            row[f"Inv {i} Inv#"] = _to_str(pay.invoice_no)
            row[f"Inv {i} Inv Date"] = _to_str(pay.invoice_date)
            row[f"Inv {i} Gross"] = _to_str(pay.gross_amount)
            row[f"Inv {i} GST Amt"] = _to_str(pay.get_amount)
            row[f"Inv {i} Amt Claimed"] = _to_str(pay.amount_claimed)
            row[f"Inv {i} Amt Recd"] = _to_str(pay.amount_recieved)
            row[f"Inv {i} Recd Date"] = _to_str(pay.recieved_date)
            row[f"Inv {i} TDS"] = _to_str(pay.tds)
            row[f"Inv {i} GST TDS"] = _to_str(pay.get_tds)
            row[f"Inv {i} LD"] = _to_str(pay.ld)
            row[f"Inv {i} Balance"] = _to_str(pay.bal)
            row[f"Inv {i} Status"] = _to_str(pay.follow_up_status)

        result.append(row)

    return JSONResponse(content=jsonable_encoder(result))


# ------------------------------
# CREATE PROPOSAL
# ------------------------------
@router.post("/", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
def create_proposal(payload: ProposalCreate, db: Session = Depends(get_db)) -> ProposalResponse:

    try:
        data = payload.dict(exclude_unset=True, by_alias=False)
    except AttributeError:
        data = payload.model_dump(exclude_unset=True, by_alias=False)

    data["is_acknowledged"] = True

    # Check if project_number already exists
    if data.get("project_number"):
        existing_proposal = db.query(Proposal).filter(Proposal.project_number == data["project_number"]).first()
        if existing_proposal:
            raise HTTPException(
                status_code=400,
                detail=f"Project Number '{data['project_number']}' already exists. Please use a unique project number."
            )
    
     # Check if quote_reference already exists
    if data.get("quote_reference"):
        existing_quote_ref = db.query(Proposal).filter(Proposal.quote_reference == data["quote_reference"]).first()
        if existing_quote_ref:
            raise HTTPException(
                status_code=400,
                detail=f"Quote Reference '{data['quote_reference']}' already exists. Please use a unique quote reference."
            )

    if getattr(payload, "revised_negotiated", None) is not None:
        data["revised_negotiated"] = payload.revised_negotiated
    if getattr(payload, "revised_negotiated_quote_date", None) is not None:
        data["revised_negotiated_quote_date"] = payload.revised_negotiated_quote_date
    if getattr(payload, "revised_negotiated_quote_amount", None) is not None:
        data["revised_negotiated_quote_amount"] = payload.revised_negotiated_quote_amount

    proposal = Proposal(**data)
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    master_proposal_data = {
        "quote_date": proposal.quote_date,
        "customer_name": proposal.customer_name,
        "description": proposal.quote_description,
        "quote_amt": proposal.quote_amount,
        "reference": proposal.email_reference,
        "quotation_ref": proposal.quote_reference,
        "indentor": proposal.quotation_given_by_name,
        "department": proposal.quotation_given_by_department,
        "contact_details": proposal.email
    }
    
    master_proposal = MasterProposal(**master_proposal_data)
    db.add(master_proposal)
    db.commit()

    # Send notifications
    try:
        # Send notification to the coordinator (quotation_given_by_name)
        coordinator_name = proposal.quotation_given_by_name or proposal.project_co_ordinator
        if coordinator_name:
            create_notification(
                db=db,
                user_name=coordinator_name,
                message=f"Proposal #{proposal.id} has been created: {proposal.customer_name} - {proposal.quote_description}",
                proposal_id=proposal.id,
                trigerred_by="admin"
            )
    except Exception as e:
        print(f"Error sending coordinator notification: {e}")
    
    try:
        # Send notification to admin as confirmation
        create_notification(
            db=db,
            user_name="admin",
            message=f"Proposal #{proposal.id} created successfully for {proposal.customer_name}",
            proposal_id=proposal.id,
            trigerred_by="admin"
        )
    except Exception as e:
        print(f"Error sending admin notification: {e}")

    return proposal


# ------------------------------
# LIST ALL PROPOSALS
# ------------------------------
@router.get("/")
def list_proposals(
    db: Session = Depends(get_db),
    date_field: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[ProposalResponse]:
    query = db.query(Proposal).filter(Proposal.is_acknowledged == True).options(joinedload(Proposal.payments))
    
    # Apply date range filter if provided
    if date_field and start_date and end_date:
        # Map frontend field names to database column names
        column_map = {
            'enquiry_date': Proposal.enquiry_date,
            'quote_date': Proposal.quote_date,
            'revised_negotiated_quote_date': Proposal.revised_negotiated_quote_date,
            'order_date': Proposal.order_date,
            'delivery_date': Proposal.delivery_date,
            'extended_delivery_date': Proposal.extended_delivery_date,
            'date_of_actual_commencement': Proposal.date_of_actual_commencement,
            'dispatch_date': Proposal.dispatch_date,
            'technical_completed_year': Proposal.technical_completed_year,
            'financial_completed_year': Proposal.financial_completed_year,
            'details_of_external_internal_review_meeting': Proposal.details_of_external_internal_review_meeting,
            'created_at': Proposal.created_at,
            'updated_at': Proposal.updated_at,
        }
        
        if date_field in column_map:
            column = column_map[date_field]
            query = query.filter(
                column >= start_date,
                column <= end_date
            )
    
    proposals = query.order_by(desc(Proposal.id)).all()
    
    # Build result with payments for each proposal
    result = []
    for proposal in proposals:
        # Serialize proposal data
        proposal_data = {
            key: value
            for key, value in proposal.__dict__.items()
            if not key.startswith("_")
        }
        
        # Serialize payments data from the pre-loaded relationship
        payments_data = []
        for payment in proposal.payments:
            payment_dict = {
                key: value
                for key, value in payment.__dict__.items()
                if not key.startswith("_")
            }
            payments_data.append(payment_dict)
        
        # Combine proposal with its payments
        proposal_data["payments"] = payments_data
        result.append(proposal_data)
    
    return result

@router.get("/false", response_model=List[ProposalResponse])
def list_proposals(db: Session = Depends(get_db)) -> List[ProposalResponse]:
    return db.query(Proposal).filter(Proposal.is_acknowledged == None).order_by(desc(Proposal.id)).all()


@router.get("/unacknowledged")
def list_unacknowledged_proposals(
    db: Session = Depends(get_db),
    date_field: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[ProposalResponse]:

    query = db.query(Proposal).filter(
        or_(Proposal.is_acknowledged.is_(None), Proposal.is_acknowledged.is_(False))
    )

    if date_field and start_date and end_date:
        column_map = {
            'enquiry_date': Proposal.enquiry_date,
            'quote_date': Proposal.quote_date,
            'revised_negotiated_quote_date': Proposal.revised_negotiated_quote_date,
            'order_date': Proposal.order_date,
            'delivery_date': Proposal.delivery_date,
            'extended_delivery_date': Proposal.extended_delivery_date,
            'date_of_actual_commencement': Proposal.date_of_actual_commencement,
            'dispatch_date': Proposal.dispatch_date,
            'technical_completed_year': Proposal.technical_completed_year,
            'financial_completed_year': Proposal.financial_completed_year,
            'details_of_external_internal_review_meeting': Proposal.details_of_external_internal_review_meeting,
            'created_at': Proposal.created_at,
            'updated_at': Proposal.updated_at,
        }
        if date_field in column_map:
            column = column_map[date_field]
            query = query.filter(column >= start_date, column <= end_date)

    proposals = query.order_by(desc(Proposal.id)).all()
    result = []
    for proposal in proposals:
        proposal_data = {k: v for k, v in proposal.__dict__.items() if not k.startswith("_")}
        payments = db.query(Payment).filter(Payment.project_id == proposal.id).all()
        payments_data = [{k: v for k, v in p.__dict__.items() if not k.startswith("_")} for p in payments]
        proposal_data["payments"] = payments_data
        result.append(proposal_data)
    return result


@router.get("/payments")
def get_proposals_with_payments(db: Session = Depends(get_db)):
    """
    Get all proposals with their associated payments.
    
    Returns:
        List of proposals with their payment details
    """
    proposals = db.query(Proposal).all()
    
    result = []
    for proposal in proposals:
        # Get all payments for this proposal
        payments = db.query(Payment).filter(
            Payment.project_id == proposal.id
        ).all()
        
        # Serialize proposal data
        proposal_data = {
            key: value
            for key, value in proposal.__dict__.items()
            if not key.startswith("_")
        }
        
        # Serialize payments data
        payments_data = []
        for payment in payments:
            payment_dict = {
                key: value
                for key, value in payment.__dict__.items()
                if not key.startswith("_")
            }
            
            # Add stage name if stage_id exists
            if payment.stage_id:
                stage = db.query(Stage).filter(Stage.id == payment.stage_id).first()
                payment_dict["stage_name"] = stage.name if stage else None
            else:
                payment_dict["stage_name"] = None
                
            payments_data.append(payment_dict)
        
        # Combine proposal with its payments
        proposal_data["payments"] = payments_data
        result.append(proposal_data)
    
    return result


# ------------------------------
# GET PROPOSALS BY NAME (with role-based extension for gh/ch)
# ------------------------------
# @router.get("/by-name/{name}", response_model=List[ProposalResponse])
# def get_proposals_by_name(
#     name: str,
#     user_role: Optional[str] = None,
#     db: Session = Depends(get_db)
# ):
#     from models.user_model import User
    
#     name_clean = " ".join(name.split())
#     name_lower = name_clean.lower()
    
#     # Always look up the user from database for group/center info
#     user = db.query(User).filter(func.lower(User.name) == name_lower).first()

@router.get("/by-name/{name}", response_model=List[ProposalResponse])
def get_proposals_by_name(
    name: str,
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    from models.user_model import User
    
    name_clean = " ".join(name.split())
    name_lower = name_clean.lower()
    
    # Prefer the exact user_id when available — name matching can collide
    # across users who share a name, silently picking the wrong person's
    # group/center and leaking their data.
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    else:
        user = db.query(User).filter(func.lower(User.name) == name_lower).first()
    
    # If user_role query param is provided, use it; otherwise use from database
    if user_role:
        effective_role = user_role.lower()
    else:
        effective_role = user.role.lower() if user and user.role else None

    # Normalize role names from frontend to backend
    role_mapping = {
        'group head': 'gh',
        'centre head': 'ch',
        'scientist': 'scientist',
        'director': 'director',
        'admin': 'admin',
        'guest': 'admin',
        'role': 'admin',
    }
    effective_role = role_mapping.get(effective_role, effective_role)

    # GH should only see proposals from SAME CENTER + SAME GROUP:
    #   1. Proposal's center matches GH's center
    #   2. AND (proposal's group matches GH's group OR assigned to group member)


    if effective_role == 'gh':
        user_group_lower = (user.group or '').strip().lower() if user else ''
        user_center_lower = (user.center or '').strip().lower() if user else ''
        
        # Find all users in the same group
        group_users = db.query(User).filter(
            func.lower(User.group) == user_group_lower,
        ).all()
        group_user_names = [u.name.lower() for u in group_users if u.name]
        
        # Build conditions:
        # 1. Proposal's group matches GH's group exactly
        group_match = func.lower(Proposal.group) == user_group_lower
        
        # 2. Proposal has no group set, but is assigned to a group member
        no_group = or_(Proposal.group == None, Proposal.group == '')
        assigned_to_member = or_(
            func.lower(Proposal.quotation_given_by_name).in_(group_user_names) if group_user_names else False,
            func.lower(Proposal.project_co_ordinator).in_(group_user_names) if group_user_names else False,
        )

   
        
        proposals = (
            db.query(Proposal)
            .filter(
                or_(
                    group_match,
                    and_(no_group, assigned_to_member),
                ),
                Proposal.is_acknowledged == True,
            )
            .distinct(Proposal.id)
            .all()
        )

        if not proposals:
            return []

        # Serialize proposals with payments data
        result = []
        for proposal in proposals:
            proposal_data = {
                key: value
                for key, value in proposal.__dict__.items()
                if not key.startswith("_")
            }

            if not proposal_data.get('group') and proposal.group:
                proposal_data['group'] = proposal.group

            payments = db.query(Payment).filter(Payment.project_id == proposal.id).all()

            payments_data = []
            for payment in payments:
                payment_dict = {
                    key: value
                    for key, value in payment.__dict__.items()
                    if not key.startswith("_")
                }

                if payment.stage_id:
                    stage = db.query(Stage).filter(Stage.id == payment.stage_id).first()
                    payment_dict["stage_name"] = stage.name if stage else None
                else:
                    payment_dict["stage_name"] = None

                payments_data.append(payment_dict)

            proposal_data["payments"] = payments_data
            result.append(proposal_data)

        return result
    
    if effective_role == 'scientist':
        # Scientist users should see proposals assigned to them or created by them
        words = name_clean.split()
        conditions = []
        if words:
            # Match each word in the scientist name to handle whitespace/formatting variations
            word_conditions = [
                and_(
                    *[
                        or_(
                            func.lower(Proposal.project_co_ordinator).contains(w.lower()),
                            func.lower(Proposal.quotation_given_by_name).contains(w.lower()),
                        )
                        for w in words
                    ]
                )
            ]
            conditions.extend(word_conditions)

        proposals_query = (
            db.query(Proposal)
            .filter(
                or_(*conditions) if conditions else True,
                or_(
                    Proposal.is_acknowledged == True,
                    Proposal.is_acknowledged.is_(None),
                    Proposal.is_acknowledged == False,
                )
            )
            .distinct(Proposal.id)
            .all()
        )
    elif effective_role in ['director', 'admin']:
        # Director and admin-equivalent users can see all proposals.
        proposals_query = (
            db.query(Proposal)
            .filter(Proposal.is_acknowledged == True)
            .distinct(Proposal.id)
            .all()
        )
    else:
        # Collect all names to search for (starts with the requested name)
        names_to_search = [name_lower]
        
        # If user has 'gh' or 'ch' role, fetch all users with same role
        if effective_role in ['gh', 'ch']:
            role_users = db.query(User).filter(
                func.lower(User.role) == effective_role,
                func.lower(User.name) != name_lower  # Exclude the original user
            ).all()
            for role_user in role_users:
                names_to_search.append(role_user.name.lower())
        
        # Fetch proposals for all collected names
        proposals_query = (
            db.query(Proposal)
            .filter(
                or_(
                    func.lower(Proposal.quotation_given_by_name).in_(names_to_search),
                    func.lower(Proposal.project_co_ordinator).in_(names_to_search),
                ),
                Proposal.is_acknowledged == True,
            )
            .distinct(Proposal.id)
            .all()
        )
    
    # Remove duplicates (should already be unique due to distinct, but safety check)
    seen_ids = set()
    proposals = []
    for p in proposals_query:
        if p.id not in seen_ids:
            seen_ids.add(p.id)
            proposals.append(p)

    if not proposals:
        return []

    # Serialize proposals with payments data
    result = []
    for proposal in proposals:
        # Serialize proposal data
        proposal_data = {
            key: value
            for key, value in proposal.__dict__.items()
            if not key.startswith("_")
        }
        
        # Ensure group field is populated
        if not proposal_data.get('group') and proposal.group:
            proposal_data['group'] = proposal.group
        
        # Get all payments for this proposal
        payments = db.query(Payment).filter(
            Payment.project_id == proposal.id
        ).all()
        
        # Serialize payments data
        payments_data = []
        for payment in payments:
            payment_dict = {
                key: value
                for key, value in payment.__dict__.items()
                if not key.startswith("_")
            }
            
            # Add stage name if stage_id exists
            if payment.stage_id:
                stage = db.query(Stage).filter(Stage.id == payment.stage_id).first()
                payment_dict["stage_name"] = stage.name if stage else None
            else:
                payment_dict["stage_name"] = None
                
            payments_data.append(payment_dict)
        
        # Combine proposal with its payments
        proposal_data["payments"] = payments_data
        result.append(proposal_data)
    
    return result

# ------------------------------
# GET PROPOSALS BY GROUP (for GH role)
# ------------------------------
@router.get("/by-group/{group}", response_model=List[ProposalResponse])
def get_proposals_by_group(
    group: str,
    user_role: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from models.user_model import User

    group_clean = group.strip().lower()

    # Find all users in this group
    group_users = db.query(User).filter(
        func.lower(User.group) == group_clean
    ).all()
    group_user_names = [u.name.lower() for u in group_users if u.name]

    # Build conditions:
    # 1. Proposal's group matches GH's group exactly
    group_match = func.lower(Proposal.group) == group_clean

    # 2. Proposal has no group set, but is assigned to a group member
    no_group = or_(Proposal.group == None, Proposal.group == '')
    assigned_to_member = or_(
        func.lower(Proposal.quotation_given_by_name).in_(group_user_names) if group_user_names else False,
        func.lower(Proposal.project_co_ordinator).in_(group_user_names) if group_user_names else False,
    )

    proposals = (
        db.query(Proposal)
        .filter(
            or_(
                group_match,
                and_(no_group, assigned_to_member),
            ),
            Proposal.is_acknowledged == True,
        )
        .distinct(Proposal.id)
        .all()
    )

    if not proposals:
        return []

    result = []
    for proposal in proposals:
        proposal_data = {
            key: value
            for key, value in proposal.__dict__.items()
            if not key.startswith("_")
        }

        if not proposal_data.get('group') and proposal.group:
            proposal_data['group'] = proposal.group

        payments = db.query(Payment).filter(
            Payment.project_id == proposal.id
        ).all()

        payments_data = []
        for payment in payments:
            payment_dict = {
                key: value
                for key, value in payment.__dict__.items()
                if not key.startswith("_")
            }

            if payment.stage_id:
                stage = db.query(Stage).filter(Stage.id == payment.stage_id).first()
                payment_dict["stage_name"] = stage.name if stage else None
            else:
                payment_dict["stage_name"] = None

            payments_data.append(payment_dict)

        proposal_data["payments"] = payments_data
        result.append(proposal_data)

    return result


# ------------------------------
# ANALYTICS: ROLE-BASED PROPOSAL STATISTICS
# ------------------------------
@router.get("/stats/global")
def get_global_proposal_stats(db: Session = Depends(get_db)):
    """
    Get global proposal statistics for Admin role.
    Returns counts for: totalProposals, totalProjects, technicallyCompleted, financiallyCompleted, ongoingProjects
    """
    # Total proposals (acknowledged only)
    total_proposals = db.query(func.count(Proposal.id)).filter(
        Proposal.is_acknowledged == True
    ).scalar()
    
    # Total projects (have project_number)
    total_projects = db.query(func.count(Proposal.id)).filter(
        Proposal.is_acknowledged == True,
        Proposal.project_number.isnot(None),
        Proposal.project_number != ''
    ).scalar()
    
    # Technically completed
    technically_completed = db.query(func.count(Proposal.id)).filter(
        Proposal.is_acknowledged == True,
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != ''
    ).scalar()
    
    # Financially completed
    financially_completed = db.query(func.count(Proposal.id)).filter(
        Proposal.is_acknowledged == True,
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != '',
        Proposal.financial_completed_year.isnot(None),
        Proposal.financial_completed_year != ''
    ).scalar()
    
    # Ongoing projects
    ongoing_projects = db.query(func.count(Proposal.id)).filter(
        Proposal.is_acknowledged == True,
        Proposal.status == 'Ongoing'
    ).scalar()
    
    return {
        "totalProposals": total_proposals,
        "totalProjects": total_projects,
        "technicallyCompleted": technically_completed,
        "financiallyCompleted": financially_completed,
        "ongoingProjects": ongoing_projects
    }


# ------------------------------
# ROLE-BASED: TOTAL PROPOSALS COUNTS
# ------------------------------
@router.get("/count/by-group/{group}")
def count_proposals_by_group(group: str, db: Session = Depends(get_db)):
    group_lower = group.strip().lower()
    total = (
        db.query(func.count(Proposal.id))
        .filter(
            Proposal.is_acknowledged == True,
            func.lower(Proposal.group) == group_lower,
        )
        .scalar()
    )
    return {"count": total or 0}


@router.get("/count/by-centre/{centre}")
def count_proposals_by_centre(centre: str, db: Session = Depends(get_db)):
    centre_lower = centre.strip().lower()
    total = (
        db.query(func.count(Proposal.id))
        .filter(
            Proposal.is_acknowledged == True,
            func.lower(Proposal.center) == centre_lower,
        )
        .scalar()
    )
    return {"count": total or 0}


@router.get("/stats/by-center/{center}")
def get_proposal_stats_by_center(center: str, db: Session = Depends(get_db)):
    """
    Get proposal statistics filtered by center for CH role.
    Returns counts for: totalProposals, totalProjects, technicallyCompleted, financiallyCompleted, ongoingProjects
    """
    from models.user_model import User
    
    center_lower = center.strip().lower()
    
    # Find all users in this center
    center_users = db.query(User).filter(
        func.lower(User.center) == center_lower
    ).all()
    center_user_names = [u.name.lower() for u in center_users if u.name]
    
    # Build base query: Proposal's center matches OR assigned to center member
    center_match = func.lower(Proposal.center) == center_lower
    assigned_to_member = or_(
        func.lower(Proposal.quotation_given_by_name).in_(center_user_names) if center_user_names else False,
        func.lower(Proposal.project_co_ordinator).in_(center_user_names) if center_user_names else False,
    )
    
    base_filter = and_(
        or_(center_match, assigned_to_member),
        Proposal.is_acknowledged == True
    )
    
    # Total proposals (acknowledged)
    total_proposals = db.query(func.count(Proposal.id)).filter(base_filter).scalar()
    
    # Total projects (have project_number)
    total_projects = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.project_number.isnot(None),
        Proposal.project_number != ''
    ).scalar()
    
    # Technically completed
    technically_completed = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != ''
    ).scalar()
    
    # Financially completed
    financially_completed = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != '',
        Proposal.financial_completed_year.isnot(None),
        Proposal.financial_completed_year != ''
    ).scalar()
    
    # Ongoing projects
    ongoing_projects = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.status == 'Ongoing'
    ).scalar()
    
    return {
        "totalProposals": total_proposals,
        "totalProjects": total_projects,
        "technicallyCompleted": technically_completed,
        "financiallyCompleted": financially_completed,
        "ongoingProjects": ongoing_projects
    }


@router.get("/stats/by-group/{group}")
def get_proposal_stats_by_group(group: str, db: Session = Depends(get_db)):
    """
    Get proposal statistics filtered by group for GH role.
    Returns counts for: totalProposals, totalProjects, technicallyCompleted, financiallyCompleted, ongoingProjects
    """
    from models.user_model import User
    
    group_lower = group.strip().lower()
    
    # Find all users in this group
    group_users = db.query(User).filter(
        func.lower(User.group) == group_lower
    ).all()
    group_user_names = [u.name.lower() for u in group_users if u.name]
    
    # Build base conditions:
    # 1. Proposal's group matches GH's group exactly
    group_match = func.lower(Proposal.group) == group_lower
    
    # 2. Proposal has no group set, but is assigned to a member
    no_group = or_(Proposal.group == None, Proposal.group == '')
    assigned_to_member = or_(
        func.lower(Proposal.quotation_given_by_name).in_(group_user_names) if group_user_names else False,
        func.lower(Proposal.project_co_ordinator).in_(group_user_names) if group_user_names else False,
    )
    
    base_filter = and_(
        or_(group_match, and_(no_group, assigned_to_member)),
        Proposal.is_acknowledged == True
    )
    
    # Total proposals (acknowledged)
    total_proposals = db.query(func.count(Proposal.id)).filter(base_filter).scalar()
    
    # Total projects (have project_number)
    total_projects = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.project_number.isnot(None),
        Proposal.project_number != ''
    ).scalar()
    
    # Technically completed
    technically_completed = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != ''
    ).scalar()
    
    # Financially completed
    financially_completed = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != '',
        Proposal.financial_completed_year.isnot(None),
        Proposal.financial_completed_year != ''
    ).scalar()
    
    # Ongoing projects
    ongoing_projects = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.status == 'Ongoing'
    ).scalar()
    
    return {
        "totalProposals": total_proposals,
        "totalProjects": total_projects,
        "technicallyCompleted": technically_completed,
        "financiallyCompleted": financially_completed,
        "ongoingProjects": ongoing_projects
    }


@router.get("/stats/by-scientist/{name}")
def get_proposal_stats_by_scientist(name: str, db: Session = Depends(get_db)):
    """
    Get proposal statistics for Scientist role.
    Counts proposals where project_co_ordinator contains the scientist's name.
    Returns counts for: totalProposals, totalProjects, technicallyCompleted, financiallyCompleted, ongoingProjects
    """
    from models.user_model import User
    import re
    
    # Clean up the name: remove extra spaces and normalize
    name_clean = re.sub(r'\s+', ' ', name.strip()).lower()
    
    # Check if user exists and is a scientist
    user = db.query(User).filter(func.lower(User.name) == name_clean).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{name}' not found")
    
    if user.role and user.role.lower() != 'scientist':
        raise HTTPException(status_code=403, detail=f"User '{name}' is not a scientist")
    
    # Base filter: project_co_ordinator contains scientist name AND acknowledged
    base_filter = and_(
        func.lower(Proposal.project_co_ordinator).contains(name_clean),
        Proposal.is_acknowledged == True
    )
    
    # Total proposals (acknowledged, assigned to scientist via project_co_ordinator)
    total_proposals = db.query(func.count(Proposal.id)).filter(base_filter).scalar()
    
    # Total projects (have project_number)
    total_projects = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.project_number.isnot(None),
        Proposal.project_number != ''
    ).scalar()
    
    # Technically completed
    technically_completed = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != ''
    ).scalar()
    
    # Financially completed
    financially_completed = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != '',
        Proposal.financial_completed_year.isnot(None),
        Proposal.financial_completed_year != ''
    ).scalar()
    
    # Ongoing projects
    ongoing_projects = db.query(func.count(Proposal.id)).filter(
        base_filter,
        Proposal.status == 'Ongoing'
    ).scalar()
    
    return {
        "totalProposals": total_proposals,
        "totalProjects": total_projects,
        "technicallyCompleted": technically_completed,
        "financiallyCompleted": financially_completed,
        "ongoingProjects": ongoing_projects
    }


@router.get("/proposal-vs-project")
def proposal_vs_project(db: Session = Depends(get_db)):
    """
    Get count of proposals converted to projects vs those that remained as proposals.
    
    Converted to Project = proposals where project_number is NOT null AND NOT empty string
    Remained as Proposal = proposals where project_number IS null OR empty string
    """
    total = db.query(Proposal).count()
    converted = db.query(Proposal).filter(
        Proposal.project_number.isnot(None),
        Proposal.project_number != ''
    ).count()
    remained = total - converted
    return {
        "converted_to_project": converted,
        "remained_as_proposal": remained,
        "total": total
    }


# ------------------------------
# ANALYTICS: TECHNICALLY COMPLETED PROJECTS BY DEPARTMENT
# ------------------------------
@router.get("/technically-completed-by-dept")
def technically_completed_by_dept(db: Session = Depends(get_db)):
    """
    Get count of technically completed projects grouped by department/center.
    
    Filters proposals where technical_completed_year IS NOT NULL AND NOT empty.
    Groups by center (department) and returns count per department.
    """
    results = db.query(
        Proposal.center,
        func.count(Proposal.id).label('count')
    ).filter(
        Proposal.technical_completed_year.isnot(None),
        Proposal.technical_completed_year != ''
    ).group_by(
        Proposal.center
    ).all()

    return [
        {
            "department": r.center or "Unknown",
            "count": r.count
        }
        for r in results
    ]


# ------------------------------
# ANALYTICS: ONGOING PROJECTS BY DEPARTMENT
# ------------------------------
@router.get("/ongoing-by-dept")
def ongoing_by_dept(db: Session = Depends(get_db)):
    """
    Get count of ongoing projects grouped by department/center.
    
    Filters proposals where status = 'Ongoing'.
    Groups by center (department) and returns count per department.
    """
    results = db.query(
        Proposal.center,
        func.count(Proposal.id).label('count')
    ).filter(
        Proposal.status == 'Ongoing'
    ).group_by(
        Proposal.center
    ).all()

    return [
        {
            "department": r.center or "Unknown",
            "count": r.count
        }
        for r in results
    ]



# ------------------------------
# GET SINGLE PROPOSAL
# ------------------------------
@router.get("/{proposal_id}", response_model=ProposalResponse)
def get_proposal(proposal_id: int, db: Session = Depends(get_db)) -> ProposalResponse:
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


# ------------------------------
# UPDATE PROPOSAL
# ------------------------------
@router.put("/{proposal_id}", response_model=ProposalResponse)
def update_proposal(
    proposal_id: int, payload: ProposalUpdate, db: Session = Depends(get_db)
) -> ProposalResponse:

    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    try:
        update_data = payload.dict(exclude_unset=True, by_alias=False)
    except AttributeError:
        update_data = payload.model_dump(exclude_unset=True, by_alias=False)

    if getattr(payload, "revised_negotiated", None) is not None:
        update_data["revised_negotiated"] = payload.revised_negotiated
    if getattr(payload, "revised_negotiated_quote_date", None) is not None:
        update_data["revised_negotiated_quote_date"] = payload.revised_negotiated_quote_date
    if getattr(payload, "revised_negotiated_quote_amount", None) is not None:
        update_data["revised_negotiated_quote_amount"] = payload.revised_negotiated_quote_amount

    for key, value in update_data.items():
        setattr(proposal, key, value)

    db.commit()
    db.refresh(proposal)

    create_notification(
    db=db,
    user_name="admin",
    message=f"Proposal ID {proposal.id} updated",
    proposal_id=proposal.id,
    trigerred_by = "admin"
    )
    # Build response with payments as dicts (ProposalResponse expects List[dict])
    mapper = sa_inspect(Proposal).mapper
    proposal_data = {
        attr.key: getattr(proposal, attr.key)
        for attr in mapper.column_attrs
    }
    payments = db.query(Payment).filter(Payment.project_id == proposal.id).all()
    proposal_data["payments"] = [
        {k: v for k, v in p.__dict__.items() if not k.startswith("_")}
        for p in payments
    ]
    return proposal_data


# ------------------------------
# DELETE PROPOSAL
# ------------------------------
@router.delete("/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proposal(proposal_id: int, db: Session = Depends(get_db)) -> None:

    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    db.delete(proposal)
    db.commit()


# ------------------------------
# NEW: COORDINATOR UPDATE ENDPOINT
# ------------------------------
@router.post("/coordinator-update")
def coordinator_update(payload: CoordinatorUpdate, db: Session = Depends(get_db)):

    proposal = db.query(Proposal).filter(Proposal.id == payload.project_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Project / Proposal not found")

    # Validate technical completed year → closure report must exist
    if payload.technical_completed_year:

        closure_doc = (
            db.query(Document)
            .filter(
                Document.project_id == payload.project_id,
                func.lower(Document.name) == "closure report"
            )
            .first()
        )

        has_flag = proposal.closer_report and proposal.closer_report.lower() == "yes"

        if not closure_doc and not has_flag:
            raise HTTPException(
                status_code=400,
                detail="Closure Report not uploaded. Upload closure report before entering technical completed year."
            )

    # Apply updates
    proposal.co_ordinator_remarks = payload.co_ordinator_remarks
    proposal.extended_delivery_date = payload.extended_delivery_date
    proposal.if_not_reason = payload.if_not_reason

    # ⭐ NEW FIELD HERE
    proposal.updated_by = payload.updated_by

    # Update proposal status when provided by coordinator/GH edit modal.
    # This endpoint previously ignored `proposal_status`, so GH edits didn't persist.
    if payload.proposal_status is not None:
        proposal.proposal_status = payload.proposal_status

    if payload.technical_completed_year:
        proposal.technical_completed_year = payload.technical_completed_year

    db.commit()
    db.refresh(proposal)

    create_notification(
    db=db,
    user_name=payload.updated_by,
    message=f"Coordinator updated proposal ID {proposal.id}",
    proposal_id=proposal.id,
    trigerred_by= "Coordinator"
)

    create_notification(
    db=db,
    user_name="admin",
    message=f"Proposal ID {proposal.id} updated by {payload.updated_by}",
    proposal_id=proposal.id,
    trigerred_by="Coordinator"
)

    return {
        "message": "Coordinator details updated successfully",
        "data": proposal
    }


# ------------------------------
# INTERNAL SERIALIZER
# ------------------------------
def _serialize_with_stage_name(
    items: List[Any], stage_map: Dict[int, Optional[str]]
) -> List[Dict[str, Any]]:

    serialized = []
    for item in items:
        data = {
            key: value
            for key, value in item.__dict__.items()
            if not key.startswith("_") and key != "stage_id"
        }
        data["stage_name"] = stage_map.get(item.stage_id)
        serialized.append(data)

    return serialized


# ------------------------------
# PROJECT STAGES
# ------------------------------
@router.get("/project_stages/{proposal_id}")
def project_stages(proposal_id: int, db: Session = Depends(get_db)):

    proposal_exists = db.query(Proposal.id).filter(Proposal.id == proposal_id).first()
    if not proposal_exists:
        raise HTTPException(status_code=404, detail="Proposal id not exists")

    documents = db.query(Document).filter(Document.project_id == proposal_id).all()
    payments = db.query(Payment).filter(Payment.project_id == proposal_id).all()
    progress_entries = db.query(Progress).filter(Progress.project_id == proposal_id).all()

    stage_ids = {
        item.stage_id
        for collection in (documents, payments, progress_entries)
        for item in collection if item.stage_id is not None
    }

    stage_map = (
        {
            stage.id: stage.name
            for stage in db.query(Stage).filter(Stage.id.in_(stage_ids)).all()
        } if stage_ids else {}
    )

    return {
        "documents": _serialize_with_stage_name(documents, stage_map),
        "payments": _serialize_with_stage_name(payments, stage_map),
        "progress": _serialize_with_stage_name(progress_entries, stage_map),
    }


# ------------------------------
# STAGE WISE DETAILS
# ------------------------------
@router.get("/stage_wise/{proposal_id}")
def stage_wise_details(proposal_id: int, db: Session = Depends(get_db)):

    proposal_exists = db.query(Proposal.id).filter(Proposal.id == proposal_id).first()
    if not proposal_exists:
        raise HTTPException(status_code=404, detail="Proposal id not exists")

    stages = db.query(Stage).order_by(Stage.id).all()
    if not stages:
        return []

    documents = db.query(Document).filter(Document.project_id == proposal_id).all()
    payments = db.query(Payment).filter(Payment.project_id == proposal_id).all()
    progress_entries = db.query(Progress).filter(Progress.project_id == proposal_id).all()

    def group_by_stage(items: List[Any]) -> Dict[Optional[int], List[Any]]:
        grouped = {}
        for item in items:
            grouped.setdefault(item.stage_id, []).append(item)
        return grouped

    documents_by_stage = group_by_stage(documents)
    payments_by_stage = group_by_stage(payments)
    progress_by_stage = group_by_stage(progress_entries)

    stage_map = {stage.id: stage.name for stage in stages}

    response = []
    for stage in stages:
        stage_id = stage.id
        response.append(
            {
                "stage_id": stage_id,
                "stage_name": stage.name,
                "documents": _serialize_with_stage_name(documents_by_stage.get(stage_id, []), stage_map),
                "payments": _serialize_with_stage_name(payments_by_stage.get(stage_id, []), stage_map),
                "progress": _serialize_with_stage_name(progress_by_stage.get(stage_id, []), stage_map),
            }
        )

    return response


# ------------------------------
# BULK CREATE PROPOSALS (Excel Import with Sanitization)
# ------------------------------
@router.post("/bulk", response_model=List[ProposalResponse], status_code=status.HTTP_201_CREATED)
def bulk_create_proposals(
    proposals: ListType[Dict[str, Any]], 
    db: Session = Depends(get_db)
) -> List[ProposalResponse]:
    """
    Create multiple proposals from Excel import with amount sanitization.
    Handles Excel date corruption in amount fields.
    
    Args:
        proposals: List of proposal data dictionaries from Excel
        db: Database session
        
    Returns:
        List of created proposals with their IDs
    """
    created_proposals = []
    
    for row in proposals:
        # Support both Excel headers with slashes and API-style snake_case keys
        # Normalize keys for revised/negotiated fields
        revised_flag = row.get("revised_negotiated", row.get("revised/negotiated"))
        revised_date = row.get(
            "revised_negotiated_quote_date",
            row.get("revised/negotiated_quote_date"),
        )
        revised_amount_raw = row.get(
            "revised_negotiated_quote_amount",
            row.get("revised/negotiated_quote_amount"),
        )

        # Sanitize amount fields before creating proposal
        quote_amount = sanitize_amount(row.get("quote_amount"))
        revised_quote_amount = sanitize_amount(revised_amount_raw)
        order_value = sanitize_amount(row.get("order_value"))
        
        # Build proposal data from row, excluding fields we normalize separately
        data = {
            k: v
            for k, v in row.items()
            if k
            not in [
                "quote_amount",
                "order_value",
                "revised_negotiated",
                "revised/negotiated",
                "revised_negotiated_quote_date",
                "revised/negotiated_quote_date",
                "revised_negotiated_quote_amount",
                "revised/negotiated_quote_amount",
            ]
        }
        
        # Add sanitized amounts (convert to string for DB storage)
        if quote_amount is not None:
            data["quote_amount"] = str(quote_amount)
        if revised_quote_amount is not None:
            data["revised_negotiated_quote_amount"] = str(revised_quote_amount)
        if order_value is not None:
            data["order_value"] = str(order_value)
        
        # Add new fields if present
        if row.get("project_allotment_date") is not None:
            data["project_allotment_date"] = str(row.get("project_allotment_date")).strip()
        if row.get("review_meeting_date") is not None:
            data["review_meeting_date"] = str(row.get("review_meeting_date")).strip()
        if row.get("small_value_project") is not None:
            data["small_value_project"] = str(row.get("small_value_project")).strip()
        
        # Handle revised_negotiated fields if present
        if revised_flag is not None:
            data["revised_negotiated"] = revised_flag
        if revised_date is not None:
            data["revised_negotiated_quote_date"] = revised_date
        
        # Handle status field from Excel (case-insensitive)
        status_value = row.get("status") or row.get("Status")
        if status_value is not None:
            data["status"] = str(status_value).strip() if status_value else None
            
        # Set acknowledged flag for bulk imports
        data["is_acknowledged"] = True
        
        # Check if project_number already exists
        if data.get("project_number"):
            existing_proposal = db.query(Proposal).filter(Proposal.project_number == data["project_number"]).first()
            if existing_proposal:
                continue  # Skip this row if project number already exists
        
        proposal = Proposal(**data)
        db.add(proposal)
        created_proposals.append(proposal)
    
    db.commit()
    
    # Refresh all created proposals to get their database-generated fields
    for proposal in created_proposals:
        db.refresh(proposal)
    
    return created_proposals


# ------------------------------
# GET PROPOSALS BY CENTRE
# ------------------------------
@router.get("/by-centre/{centre}", response_model=List[ProposalResponse])
def get_proposals_by_centre(centre: str, db: Session = Depends(get_db)):
    """
    Get all proposals for a specific centre.
    
    Args:
        centre: The centre name to filter by
        db: Database session
        
    Returns:
        List of proposals for the specified centre
    """
    centre_lower = centre.strip().lower()
    from models.user_model import User
    
    # Find all users in this center
    center_users = db.query(User).filter(
        func.lower(User.center) == centre_lower
    ).all()
    center_user_names = [u.name.lower() for u in center_users if u.name]

    # Conditions: Proposal's center matches OR Proposal is assigned to a center member
    center_match = func.lower(Proposal.center) == centre_lower
    assigned_to_member = or_(
        func.lower(Proposal.quotation_given_by_name).in_(center_user_names) if center_user_names else False,
        func.lower(Proposal.project_co_ordinator).in_(center_user_names) if center_user_names else False,
    )

    proposals = (
        db.query(Proposal)
        .filter(
            or_(
                center_match,
                assigned_to_member,
            ),
            Proposal.is_acknowledged == True,
        )
        .distinct(Proposal.id)
        .all()
    )

    if not proposals:
        raise HTTPException(
            status_code=404,
            detail=f"No proposals found for centre = '{centre}'"
        )

    # Serialize proposals with payments data
    result = []
    for proposal in proposals:
        # Serialize proposal data
        proposal_data = {
            key: value
            for key, value in proposal.__dict__.items()
            if not key.startswith("_")
        }
        
        # Get all payments for this proposal
        payments = db.query(Payment).filter(
            Payment.project_id == proposal.id
        ).all()
        
        # Serialize payments data
        payments_data = []
        for payment in payments:
            payment_dict = {
                key: value
                for key, value in payment.__dict__.items()
                if not key.startswith("_")
            }
            
            # Add stage name if stage_id exists
            if payment.stage_id:
                stage = db.query(Stage).filter(Stage.id == payment.stage_id).first()
                payment_dict["stage_name"] = stage.name if stage else None
            else:
                payment_dict["stage_name"] = None
                
            payments_data.append(payment_dict)
        
        # Combine proposal with its payments
        proposal_data["payments"] = payments_data
        result.append(proposal_data)
    
    return result



@router.get("/payments/{proposal_id}")
def get_proposal_with_payments(proposal_id: int, db: Session = Depends(get_db)):
    """
    Get a single proposal with its associated payments.
    
    Args:
        proposal_id: The proposal ID
        db: Database session
        
    Returns:
        Proposal with payment details
    """
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # Get all payments for this proposal
    payments = db.query(Payment).filter(
        Payment.project_id == proposal_id
    ).all()
    
    # Serialize proposal data
    proposal_data = {
        key: value
        for key, value in proposal.__dict__.items()
        if not key.startswith("_")
    }
    
    # Serialize payments data
    payments_data = []
    for payment in payments:
        payment_dict = {
            key: value
            for key, value in payment.__dict__.items()
            if not key.startswith("_")
        }
        
        # Add stage name if stage_id exists
        if payment.stage_id:
            stage = db.query(Stage).filter(Stage.id == payment.stage_id).first()
            payment_dict["stage_name"] = stage.name if stage else None
        else:
            payment_dict["stage_name"] = None
            
        payments_data.append(payment_dict)
    
    # Combine proposal with its payments
    proposal_data["payments"] = payments_data
    
    return proposal_data


@router.post("/add-proposal-coordinator", status_code=status.HTTP_201_CREATED)
def add_proposal_coordinator(
    payload: ProposalCoordinatorCreate,
    db: Session = Depends(get_db)
):
    try:
        data = payload.dict(exclude_unset=True)
    except AttributeError:
        data = payload.model_dump(exclude_unset=True)

    # Create Proposal
    proposal = Proposal(**data)
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    # ------------------------------------------
    # Optional: Send Notification
    # ------------------------------------------
    create_notification(
        db=db,
        user_name=proposal.quotation_given_by_name,
        message=f"Coordinator created proposal for {proposal.customer_name}",
        proposal_id=proposal.id,
        trigerred_by="Coordinator"
    )

    return {
        "message": "Proposal created successfully by coordinator",
        "proposal_id": proposal.id,
        "data": data
    }


@router.put("/acknowledge/{proposal_id}")
def update_acknowledgement(
    proposal_id: int,
    payload: AcknowledgeUpdate,
    db: Session = Depends(get_db)
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()

    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Update only acknowledgement
    proposal.is_acknowledged = payload.is_acknowledged
    db.commit()
    db.refresh(proposal)

    # Create notification
    status_text = "Accepted" if payload.is_acknowledged else "Rejected"
    create_notification(
        db=db,
        user_name="admin",
        message=f"Proposal {proposal.customer_name} - {proposal.quote_description} marked as {status_text}",
        proposal_id=proposal.id,
        trigerred_by="admin"
    )

    # If acknowledged, insert into master proposals
    if payload.is_acknowledged:
        master_proposal_data = {
            "quote_date": proposal.quote_date,
            "customer_name": proposal.customer_name,
            "description": proposal.quote_description,
            "quote_amt": proposal.quote_amount,
            "reference": proposal.email_reference,
            "quotation_ref": proposal.quote_reference,
            "indentor": proposal.quotation_given_by_name,
            "department": proposal.quotation_given_by_department,
            "contact_details": proposal.email
        }

        master_proposal = MasterProposal(**master_proposal_data)
        db.add(master_proposal)
        db.commit()

    return {
        "message": "Acknowledgement updated successfully",
        "proposal_id": proposal.id,
        "is_acknowledged": proposal.is_acknowledged
    }


# ------------------------------
# DELIVERY DATE NOTIFICATION CHECK
# Triggered on every page load — no background scheduler
# ------------------------------
@router.post("/check-delivery-notifications")
def trigger_delivery_notifications(db: Session = Depends(get_db)):
    """
    Check all proposals for upcoming/overdue deliveries and create notifications.
    Called from frontend on every page load to ensure fresh notifications.
    """
    from datetime import datetime, date
    from models.user_model import User

    today = date.today()

    # Get all admin users' names
    admin_users = db.query(User).filter(
        User.role == 'admin'
    ).all()
    admin_names = [u.name for u in admin_users if u and u.name]

    # Get all incomplete proposals (NULL or empty string means incomplete)
    from sqlalchemy import or_
    proposals = db.query(Proposal).filter(
        or_(
            Proposal.technical_completed_year.is_(None),
            Proposal.technical_completed_year == ''
        ),
        or_(
            Proposal.financial_completed_year.is_(None),
            Proposal.financial_completed_year == ''
        )
    ).all()

    for proposal in proposals:
        delivery_str = None
        if proposal.extended_delivery_date and str(proposal.extended_delivery_date).strip():
            delivery_str = str(proposal.extended_delivery_date).strip()
        elif proposal.delivery_date and str(proposal.delivery_date).strip():
            delivery_str = str(proposal.delivery_date).strip()

        if not delivery_str:
            continue

        delivery_date = None
        for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y', '%d.%m.%Y'):
            try:
                delivery_date = datetime.strptime(delivery_str, fmt).date()
                break
            except:
                continue

        if not delivery_date:
            continue

        days_remaining = (delivery_date - today).days

        if days_remaining > 30:
            continue

        project_ref = proposal.project_number or f"ID {proposal.id}"
        if days_remaining > 0:
            message = f"Project {project_ref} - Delivery in {days_remaining} days ({delivery_date.strftime('%d-%m-%Y')})"
        elif days_remaining == 0:
            message = f"Project {project_ref} - Delivery is TODAY ({delivery_date.strftime('%d-%m-%Y')})"
        else:
            message = f"Project {project_ref} - Overdue by {abs(days_remaining)} days (was due {delivery_date.strftime('%d-%m-%Y')})"

        # Recipients: roles and coordinator name
        recipients = ['admin']  # always notify admin role

        # Add gh role if proposal has a group
        if proposal.group:
            recipients.append('gh')

        # Add project coordinator name (stored as name in proposals table)
        if proposal.project_co_ordinator and str(proposal.project_co_ordinator).strip():
            coord = str(proposal.project_co_ordinator).strip()
            if coord not in recipients:
                recipients.append(coord)

        # Delete old system-triggered notifications and create fresh ones
        # This ensures message updates daily with correct remaining days
        for recipient in recipients:
            db.query(Notification).filter(
                Notification.related_proposal_id == proposal.id,
                Notification.user_name == recipient,
                Notification.trigerred_by == 'system'
            ).delete()

            notif = Notification(
                user_name=recipient,  # stores 'admin', 'gh', or coordinator name
                message=message,
                is_read=0,
                related_proposal_id=proposal.id,
                trigerred_by='system'
            )
            db.add(notif)

    # -------------------------------------------------
    # INVOICE OVERDUE NOTIFICATIONS (15+ days)
    # Only for admin role
    # -------------------------------------------------
    payments = db.query(Payment).filter(
        Payment.invoice_date.isnot(None),
        Payment.invoice_date != ''
    ).all()

    for payment in payments:
        invoice_date_str = payment.invoice_date.strip()
        if not invoice_date_str:
            continue

        # Parse invoice date
        invoice_date = None
        for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y', '%d.%m.%Y'):
            try:
                invoice_date = datetime.strptime(invoice_date_str, fmt).date()
                break
            except:
                continue

        if not invoice_date:
            continue

        # Check if 15+ days overdue
        days_overdue = (today - invoice_date).days
        if days_overdue < 15:
            continue

        # Get project info
        proposal = db.query(Proposal).filter(Proposal.id == payment.project_id).first()
        project_ref = proposal.project_number if proposal and proposal.project_number else f"ID {payment.project_id}"
        invoice_ref = payment.invoice_no if payment.invoice_no else f"Invoice #{payment.id}"

        message = f"Invoice Alert: {invoice_ref} for Project {project_ref} is {days_overdue} days overdue (dated {invoice_date.strftime('%d-%m-%Y')})"

        # Delete old invoice notification for this payment (using proposal_id + triggered_by)
        db.query(Notification).filter(
            Notification.related_proposal_id == payment.project_id,
            Notification.user_name == 'admin',
            Notification.trigerred_by == 'system-invoice'
        ).delete()

        # Create notification for admin only (no related_document_id since payments aren't documents)
        notif = Notification(
            user_name='admin',
            message=message,
            is_read=0,
            related_proposal_id=payment.project_id,
            trigerred_by='system-invoice'
        )
        db.add(notif)

    db.commit()
    return {"status": "ok"}
@router.get("/unacknowledged/count")
def get_unacknowledged_proposals_count(db: Session = Depends(get_db)) -> Dict[str, int]:
    """
    Get count of proposals where is_acknowledged is NULL or False.
    
    Args:
        db: Database session
        
    Returns:
        Dictionary with count of unacknowledged proposals
    """
    count = db.query(func.count(Proposal.id)).filter(
        or_(
            Proposal.is_acknowledged.is_(None),
            
        )
    ).scalar()
    
    return {"unacknowledged_count": count or 0}

# ------------------------------
# GET NOT-CONVERTED PROPOSALS FOR A SPECIFIC SCIENTIST (LOGGED-IN USER)
# ------------------------------
@router.get("/not-converted/by-scientist/{name}")
def get_not_converted_proposals_for_scientist(name: str, db: Session = Depends(get_db)):
    """
    Get all proposals where proposals_converted = 'No', for a specific scientist.
    `name` is the logged-in scientist's name, passed automatically by the
    frontend from the session.

    Validates that the name corresponds to an actual user with role = 'scientist',
    and matches proposals where that scientist is the assigned project_co_ordinator.
    """
    from models.user_model import User
    import re

    name_clean = re.sub(r'\s+', ' ', name.strip()).lower()

    # Validate the user exists and is a scientist
    user = db.query(User).filter(func.lower(User.name) == name_clean).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{name}' not found")
    if user.role and user.role.lower() != 'scientist':
        raise HTTPException(status_code=403, detail=f"User '{name}' is not a scientist")

    proposals = (
        db.query(Proposal)
        .filter(
            func.lower(Proposal.proposals_converted) == "no",
            or_(                                                     # condition 2
            Proposal.if_not_reason.is_(None),
            func.trim(Proposal.if_not_reason) == "",
        ),
            func.lower(Proposal.project_co_ordinator).contains(name_clean),
        )
        .order_by(desc(Proposal.id))
        .all()
    )

    result = []
    for proposal in proposals:
        proposal_data = {
            key: value
            for key, value in proposal.__dict__.items()
            if not key.startswith("_")
        }
        payments = db.query(Payment).filter(Payment.project_id == proposal.id).all()
        proposal_data["payments"] = [
            {k: v for k, v in p.__dict__.items() if not k.startswith("_")}
            for p in payments
        ]
        result.append(proposal_data)

    return result