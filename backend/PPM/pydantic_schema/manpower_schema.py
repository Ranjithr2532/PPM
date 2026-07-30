from typing import Optional
from pydantic import BaseModel


class ManpowerRateCreate(BaseModel):
    designation: str
    rate_other_activities: float
    rate_design_developmental_activities: float


class ManpowerRateUpdate(BaseModel):
    designation: Optional[str] = None
    rate_other_activities: Optional[float] = None
    rate_design_developmental_activities: Optional[float] = None
