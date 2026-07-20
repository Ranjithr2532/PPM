from pydantic import BaseModel
from typing import Optional, List


# ---------------------------------------
# CENTRE SCHEMAS
# ---------------------------------------
class CentreBase(BaseModel):
    name: str
    head: Optional[str] = None
    code: str


class CentreCreate(CentreBase):
    pass


class CentreUpdate(BaseModel):
    name: Optional[str] = None
    head: Optional[str] = None
    code: Optional[str] = None


class CentreResponse(CentreBase):
    id: int

    class Config:
        from_attributes = True


# ---------------------------------------
# GROUP SCHEMAS
# ---------------------------------------
class GroupBase(BaseModel):
    name: str
    head: Optional[str] = None
    code: str
    centre_id: int


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    head: Optional[str] = None
    code: Optional[str] = None
    centre_id: Optional[int] = None


class GroupResponse(GroupBase):
    id: int

    class Config:
        from_attributes = True
