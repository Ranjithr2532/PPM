from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional

from db import get_db
from models.model import Proposal

router = APIRouter(prefix="/count", tags=["Counts"])


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
        Proposal.technical_completed_year.isnot(None),
        func.trim(Proposal.technical_completed_year) != ''
    ).scalar() or 0

    financially_completed = db.query(func.count(Proposal.id)).filter(
        *filters,
        Proposal.technical_completed_year.isnot(None),
        func.trim(Proposal.technical_completed_year) != '',
        Proposal.financial_completed_year.isnot(None),
        func.trim(Proposal.financial_completed_year) != ''
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

    # Fast SQL grouping by year using coalesce across enquiry_date, quote_date, created_at
    from sqlalchemy import case

    year_expr = case(
        (func.coalesce(Proposal.enquiry_date, '') != '', func.substring(Proposal.enquiry_date, r'(20\d{2}|19\d{2})')),
        (func.coalesce(Proposal.quote_date, '') != '', func.substring(Proposal.quote_date, r'(20\d{2}|19\d{2})')),
        else_=func.to_char(Proposal.created_at, 'YYYY')
    )

    results = (
        db.query(year_expr.label("year"), func.count(Proposal.id).label("count"))
        .filter(*filters)
        .group_by(year_expr)
        .all()
    )

    yearly_counts = []
    total_records = 0
    for r in results:
        yr = r.year or "Unknown"
        c = r.count or 0
        yearly_counts.append({"year": str(yr), "count": c})
        total_records += c

    sorted_result = sorted(yearly_counts, key=lambda y: (y["year"] if y["year"] != "Unknown" else "9999"))

    return {
        "yearly_counts": sorted_result,
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

    from sqlalchemy import case

    year_expr = case(
        (func.coalesce(Proposal.enquiry_date, '') != '', func.substring(Proposal.enquiry_date, r'(20\d{2}|19\d{2})')),
        (func.coalesce(Proposal.quote_date, '') != '', func.substring(Proposal.quote_date, r'(20\d{2}|19\d{2})')),
        else_=func.to_char(Proposal.created_at, 'YYYY')
    )

    results = (
        db.query(Proposal, year_expr.label("year"))
        .filter(*filters)
        .all()
    )

    unknown_list = []
    for prop, yr in results:
        if not yr or str(yr).strip() == "" or yr == "Unknown":
            unknown_list.append({
                "id": prop.id,
                "activity": prop.activity or prop.quote_description or "",
                "customer_name": prop.customer_name or "",
                "quote_reference": prop.quote_reference or "",
                "quote_description": prop.quote_description or "",
                "enquiry_date": prop.enquiry_date or "",
                "quote_date": prop.quote_date or "",
                "center": prop.center or "",
                "project_co_ordinator": prop.project_co_ordinator or "",
                "created_at": prop.created_at.strftime("%Y-%m-%d %H:%M:%S") if prop.created_at else ""
            })

    return {
        "unknown_proposals": unknown_list,
        "total": len(unknown_list)
    }



