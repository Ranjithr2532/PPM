import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from sqlalchemy import func
from db import get_db
from models.model import TeamMember, Proposal
from models.user_model import User
from security.auth import get_current_user
from pydantic_schema.team_member_schema import (
    TeamMemberCreate,
    TeamMemberUpdate,
    TeamMemberResponse,
)

router = APIRouter(prefix="/team-members", tags=["Team Members"])
team_members_router = router


def check_proposal_coordinator_permission(proposal: Proposal, current_user: dict, db: Session):
    """
    Ensures that only admins or the designated project coordinator of the proposal
    can modify or view its team member assignments.
    """
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role == "admin":
        return

    # Fetch user ID from JWT token payload
    user_id_str = current_user.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload"
        )
        
    db_user = db.query(User).filter(User.id == int(user_id_str)).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user record not found"
        )

    # Check match with proposal.project_co_ordinator
    coord_name = proposal.project_co_ordinator
    if not coord_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized. Only the coordinator of this proposal or an admin can manage team members."
        )

    # Normalize name spaces and convert to lowercase for accurate match
    coord_clean = re.sub(r'\s+', ' ', coord_name.strip()).lower()
    user_clean = re.sub(r'\s+', ' ', db_user.name.strip()).lower()

    if coord_clean != user_clean:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized. Only the coordinator of this proposal or an admin can manage team members."
        )


@router.post("/", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def create_team_member(
    payload: TeamMemberCreate, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    # Verify proposal exists
    proposal = db.query(Proposal).filter(Proposal.id == payload.proposal_id).first()
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proposal with id {payload.proposal_id} not found"
        )

    # Check if the current user is authorized (coordinator of the proposal or admin)
    check_proposal_coordinator_permission(proposal, current_user, db)

    # Check for duplicate
    duplicate = (
        db.query(TeamMember)
        .filter(
            TeamMember.proposal_id == payload.proposal_id,
            TeamMember.team_member_id == payload.team_member_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team member is already assigned to this proposal"
        )

    db_team_member = TeamMember(
        proposal_id=payload.proposal_id,
        team_member_id=payload.team_member_id,
    )
    db.add(db_team_member)
    db.commit()
    db.refresh(db_team_member)
    return db_team_member


@router.get("/", response_model=List[TeamMemberResponse])
def list_team_members(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    # Listing all mappings in the database is an admin action
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list all team members globally."
        )
    return db.query(TeamMember).all()


@router.get("/my-projects", response_model=List[TeamMemberResponse])
def get_my_team_projects(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Returns all team member mapping records where the team_member_id matches the current user's name.
    """
    user_id_str = current_user.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload"
        )
    db_user = db.query(User).filter(User.id == int(user_id_str)).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user record not found"
        )

    # Query mappings matching user's name case-insensitively
    return db.query(TeamMember).filter(func.lower(TeamMember.team_member_id) == db_user.name.lower()).all()


@router.get("/{id}", response_model=TeamMemberResponse)
def get_team_member(
    id: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    db_team_member = db.query(TeamMember).filter(TeamMember.id == id).first()
    if not db_team_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team member mapping with id {id} not found"
        )
    
    # Check if the current user is authorized (coordinator of the proposal or admin)
    check_proposal_coordinator_permission(db_team_member.proposal, current_user, db)
    return db_team_member


@router.get("/proposal/{proposal_id}", response_model=List[TeamMemberResponse])
def get_team_members_by_proposal(
    proposal_id: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    # Verify proposal exists
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proposal with id {proposal_id} not found"
        )

    return db.query(TeamMember).filter(TeamMember.proposal_id == proposal_id).all()


@router.put("/{id}", response_model=TeamMemberResponse)
def update_team_member(
    id: int, 
    payload: TeamMemberUpdate, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    db_team_member = db.query(TeamMember).filter(TeamMember.id == id).first()
    if not db_team_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team member mapping with id {id} not found"
        )

    # Verify authorization on the original proposal link
    check_proposal_coordinator_permission(db_team_member.proposal, current_user, db)

    if payload.proposal_id is not None:
        # Verify new proposal exists
        proposal = db.query(Proposal).filter(Proposal.id == payload.proposal_id).first()
        if not proposal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal with id {payload.proposal_id} not found"
            )
        # Verify authorization on the target proposal link as well
        check_proposal_coordinator_permission(proposal, current_user, db)
        db_team_member.proposal_id = payload.proposal_id

    if payload.team_member_id is not None:
        db_team_member.team_member_id = payload.team_member_id

    # Check duplicate constraint if changed
    if payload.proposal_id is not None or payload.team_member_id is not None:
        duplicate = (
            db.query(TeamMember)
            .filter(
                TeamMember.proposal_id == db_team_member.proposal_id,
                TeamMember.team_member_id == db_team_member.team_member_id,
                TeamMember.id != id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team member is already assigned to this proposal"
            )

    db.commit()
    db.refresh(db_team_member)
    return db_team_member


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team_member(
    id: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    db_team_member = db.query(TeamMember).filter(TeamMember.id == id).first()
    if not db_team_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team member mapping with id {id} not found"
        )

    # Verify authorization on the proposal link
    check_proposal_coordinator_permission(db_team_member.proposal, current_user, db)
    db.delete(db_team_member)
    db.commit()
    return None
