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

