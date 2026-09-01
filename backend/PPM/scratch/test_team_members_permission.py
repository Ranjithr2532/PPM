import os
import sys

# Add backend/PPM directory to Python path
sys.path.append(r"c:\Users\SMPM2\Downloads\ranjith-newppm\backend\PPM")

from fastapi.testclient import TestClient
from main import app
from db import SessionLocal
from models.model import Proposal, TeamMember
from models.user_model import User
from security.security import create_access_token

client = TestClient(app)

def test_team_members_view_permission():
    db = SessionLocal()
    
    # 1. Setup mock users in DB
    coordinator = User(
        name="Coord Alice",
        email="coord_alice@example.com",
        role="scientist",
        designation="Principal Scientist",
        password="testpassword"
    )
    team_member = User(
        name="Team Bob",
        email="team_bob@example.com",
        role="scientist",
        designation="Senior Scientist",
        password="testpassword"
    )
    unauthorized_user = User(
        name="Stranger Charlie",
        email="stranger@example.com",
        role="scientist",
        designation="Scientist",
        password="testpassword"
    )
    db.add(coordinator)
    db.add(team_member)
    db.add(unauthorized_user)
    db.commit()
    db.refresh(coordinator)
    db.refresh(team_member)
    db.refresh(unauthorized_user)

    # 2. Create proposal
    proposal = Proposal(
        customer_name="Permission Test Proposal",
        proposal_status="Draft",
        draft=True,
        project_co_ordinator="Coord Alice",
        project_number="GAP999"
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    proposal_id = proposal.id

    # 3. Add team member mapping
    mapping = TeamMember(
        proposal_id=proposal_id,
        team_member_id="Team Bob"
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)

    try:
        # Create tokens
        coord_token = create_access_token({"sub": str(coordinator.id), "role": coordinator.role})
        member_token = create_access_token({"sub": str(team_member.id), "role": team_member.role})
        stranger_token = create_access_token({"sub": str(unauthorized_user.id), "role": unauthorized_user.role})

        # Case A: Coordinator fetches (expected: 200)
        res_coord = client.get(
            f"/team-members/proposal/{proposal_id}",
            headers={"Authorization": f"Bearer {coord_token}"}
        )
        print(f"Coordinator fetch response: {res_coord.status_code}")
        assert res_coord.status_code == 200

        # Case B: Team Member fetches (expected: 200)
        res_member = client.get(
            f"/team-members/proposal/{proposal_id}",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        print(f"Team Member fetch response: {res_member.status_code}")
        assert res_member.status_code == 200

        # Case C: Stranger fetches (expected: 403)
        res_stranger = client.get(
            f"/team-members/proposal/{proposal_id}",
            headers={"Authorization": f"Bearer {stranger_token}"}
        )
        print(f"Stranger fetch response: {res_stranger.status_code}")
        assert res_stranger.status_code == 403

        print("SUCCESS: Team members permission verification test passed successfully!")

    finally:
        # Cleanup
        db.query(TeamMember).filter(TeamMember.proposal_id == proposal_id).delete()
        db.query(Proposal).filter(Proposal.id == proposal_id).delete()
        db.query(User).filter(User.id == coordinator.id).delete()
        db.query(User).filter(User.id == team_member.id).delete()
        db.query(User).filter(User.id == unauthorized_user.id).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    test_team_members_view_permission()
