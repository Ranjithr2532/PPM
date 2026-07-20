from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: Optional[str] = None
    center: Optional[str] = None
    group: Optional[str] = None
    password: str = Field(min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: Optional[str]
    center: Optional[str]
    group: Optional[str]
    password: Optional[str]

    class Config:
        from_attributes = True
