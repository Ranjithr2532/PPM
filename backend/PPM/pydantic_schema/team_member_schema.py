from pydantic import BaseModel
from typing import Optional

class TeamMemberBase(BaseModel):
    proposal_id: int
    team_member_id: str

class TeamMemberCreate(TeamMemberBase):
    pass

class TeamMemberUpdate(BaseModel):
    proposal_id: Optional[int] = None
    team_member_id: Optional[str] = None

class TeamMemberResponse(TeamMemberBase):
    id: int

    class Config:
        from_attributes = True
