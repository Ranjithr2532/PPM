from datetime import date, datetime
import re
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional

from db import get_db
from models.model import Proposal

router = APIRouter(prefix="/count", tags=["Counts"])


def extract_year(date_val) -> Optional[str]:
    """Robustly extracts 4-digit year from date, datetime, or string date values."""
    if not date_val:
        return None
    if isinstance(date_val, (date, datetime)):
        return str(date_val.year)
    s = str(date_val).strip()
    if not s or s.lower() in ("none", "null", "unknown", "nan", "-"):
        return None
    
    # Check if string starts with 4-digit year (e.g. 2024-05-12 or 2024/05/12)
    m = re.match(r"^(\d{4})[-/]", s)
    if m:
        return m.group(1)
    
    # Check if string ends with 4-digit year (e.g. 12-05-2024 or 12/05/2024 or 12.05.2024)
    m = re.search(r"[-/.](\d{4})$", s)
    if m:
        return m.group(1)
    
    # Check for any 4-digit year like 19xx or 20xx
    m = re.search(r"\b(19\d{2}|20\d{2})\b", s)
    if m:
        return m.group(1)
    
    # Try parsing with strptime
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d.%m.%Y", "%Y"):
        try:
            return str(datetime.strptime(s[:10], fmt).year)
        except Exception:
            pass
    return None


@router.get("/")
def get_proposal_counts(
    user_name: Optional[str] = Query(None),
    user_role: Optional[str] = Query(None),
    user_group: Optional[str] = Query(None),
    centre: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns summary counts for proposals and projects:
    - total_proposals: All acknowledged proposals
    - pending_proposals: Proposals pending conversion / not converted
    - converted_projects: Proposals converted to projects ('yes')
    - ongoing_projects: Projects currently ongoing
    - technically_completed: Projects where technical completion year is recorded
    - financially_completed: Projects where both technical and financial completion year are recorded
    - all: Total record count
    """
    # Build base filter
    filters = [Proposal.is_acknowledged == True]

    if user_role and user_role.lower() == 'gh' and user_group:
        filters.append(func.lower(Proposal.group) == user_group.lower())
    elif user_role and user_role.lower() == 'scientist' and user_name:
        filters.append(
            or_(
                func.lower(Proposal.project_co_ordinator) == user_name.lower(),
                func.lower(Proposal.quotation_given_by_name) == user_name.lower()
            )
        )
    if centre:
        filters.append(func.lower(Proposal.center) == centre.lower())

    total_proposals = db.query(func.count(Proposal.id)).filter(*filters).scalar() or 0

    converted_projects = db.query(func.count(Proposal.id)).filter(
        *filters,
        func.lower(func.trim(Proposal.proposals_converted)) == 'yes'
    ).scalar() or 0

    pending_proposals = total_proposals - converted_projects

    ongoing_projects = db.query(func.count(Proposal.id)).filter(
        *filters,
        func.lower(func.trim(Proposal.status)) == 'ongoing'
    ).scalar() or 0

    technically_completed = db.query(func.count(Proposal.id)).filter(
        *filters,
        Proposal.technical_completed_year.isnot(None)
    ).scalar() or 0

    financially_completed = db.query(func.count(Proposal.id)).filter(
        *filters,
        Proposal.technical_completed_year.isnot(None),
        Proposal.financial_completed_year.isnot(None)
    ).scalar() or 0

    return {
        "total_proposals": total_proposals,
        "pending_proposals": pending_proposals,
        "converted_projects": converted_projects,
        "ongoing_projects": ongoing_projects,
        "technically_completed": technically_completed,
        "financially_completed": financially_completed,
        "all": total_proposals
    }


@router.get("/yearly")
def get_yearly_proposal_counts(
    user_name: Optional[str] = Query(None),
    user_role: Optional[str] = Query(None),
    user_group: Optional[str] = Query(None),
    centre: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns yearly count of proposals:
    Example Response:
    {
      "yearly_counts": [
        {"year": "2023", "count": 45},
        {"year": "2024", "count": 78},
        {"year": "2025", "count": 92}
      ],
      "total": 215
    }
    """
    filters = [Proposal.is_acknowledged == True]

    if user_role and user_role.lower() == 'gh' and user_group:
        filters.append(func.lower(Proposal.group) == user_group.lower())
    elif user_role and user_role.lower() == 'scientist' and user_name:
        filters.append(
            or_(
                func.lower(Proposal.project_co_ordinator) == user_name.lower(),
                func.lower(Proposal.quotation_given_by_name) == user_name.lower()
            )
        )
    if centre:
        filters.append(func.lower(Proposal.center) == centre.lower())

    rows = db.query(Proposal.id, Proposal.enquiry_date, Proposal.quote_date).filter(*filters).all()

    counts_by_year = {}
    total_records = 0

    for p_id, enq_date, q_date in rows:
        yr = extract_year(enq_date) or extract_year(q_date)
        if yr:
            counts_by_year[yr] = counts_by_year.get(yr, 0) + 1
            total_records += 1

    yearly_counts = [{"year": str(yr), "count": c} for yr, c in sorted(counts_by_year.items())]

    return {
        "yearly_counts": yearly_counts,
        "total": total_records
    }


@router.get("/unknown")
def get_unknown_year_proposals(
    user_name: Optional[str] = Query(None),
    user_role: Optional[str] = Query(None),
    user_group: Optional[str] = Query(None),
    centre: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns list of proposals where year could not be determined ('Unknown'),
    including proposal ID, activity, customer details, and dates.
    """
    filters = [Proposal.is_acknowledged == True]

    if user_role and user_role.lower() == 'gh' and user_group:
        filters.append(func.lower(Proposal.group) == user_group.lower())
    elif user_role and user_role.lower() == 'scientist' and user_name:
        filters.append(
            or_(
                func.lower(Proposal.project_co_ordinator) == user_name.lower(),
                func.lower(Proposal.quotation_given_by_name) == user_name.lower()
            )
        )
    if centre:
        filters.append(func.lower(Proposal.center) == centre.lower())

    proposals = db.query(Proposal).filter(*filters).all()

    unknown_list = []
    for prop in proposals:
        yr = extract_year(prop.enquiry_date) or extract_year(prop.quote_date)
        if not yr:
            unknown_list.append({
                "id": prop.id,
                "activity": prop.activity or prop.quote_description or "",
                "customer_name": prop.customer_name or "",
                "quote_reference": prop.quote_reference or "",
                "quote_description": prop.quote_description or "",
                "enquiry_date": str(prop.enquiry_date) if prop.enquiry_date else "",
                "quote_date": str(prop.quote_date) if prop.quote_date else "",
                "center": prop.center or "",
                "project_co_ordinator": prop.project_co_ordinator or "",
                "created_at": prop.created_at.strftime("%Y-%m-%d %H:%M:%S") if getattr(prop, "created_at", None) else ""
            })

    return {
        "unknown_proposals": unknown_list,
        "total": len(unknown_list)
    }



