from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from db import get_db
from models.user_model import User
from pydantic_schema.user_schema import UserCreate, UserLogin, UserResponse
from pydantic import BaseModel, EmailStr
from models.model import OTP
from datetime import datetime, timedelta

from security.security import create_access_token, verify_password
from security.auth import get_current_user


router = APIRouter(prefix="/users", tags=["Users"])

import random , string , smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailRequest(BaseModel):
    email: EmailStr

class OTPVerification(BaseModel):
    email: EmailStr
    otp: str

def send_otp_email(email: str, otp: str):
    # Email configuration
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587
    SENDER_EMAIL = "tpdatamanagementsystem@gmail.com"  # Replace with your email
    APP_PASSWORD = "yekp atje agsg mibh"  # Replace with your app password

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, APP_PASSWORD)
        
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = email
        msg["Subject"] = "Your OTP for Order Management System CMTI"
        
        body = f"""
        Dear User,

        Your OTP for authentication is: {otp}

        This OTP will expire in 5 minutes.
        Please do not share this OTP with anyone.

        Best regards,
        Order Management System CMTI
        """
        
        msg.attach(MIMEText(body, "plain"))
        server.send_message(msg)
        server.quit()
        logger.info(f"OTP sent successfully to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email: {str(e)}")
        return False

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

@router.post("/request-otp")
async def request_otp(request: EmailRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        # Validate email format (already done by EmailStr)
        # Check if user exists with this email
        user = db.query(User).filter(
            and_(
                User.email == request.email,
            )
        ).first()

        if not user:
            raise HTTPException(status_code=404, detail="User not found with this email")

        
        # Generate OTP
        otp = generate_otp()
        expires_at = datetime.now() + timedelta(minutes=5)

        # Save OTP in database
        new_otp = OTP(
            email=request.email,
            otp_code=otp,
            expires_at=expires_at
        )
        db.add(new_otp)
        db.commit()

        # Send OTP via email
        if not send_otp_email(request.email, otp):
            raise HTTPException(status_code=500, detail="Failed to send OTP email")

        return {"message": "OTP sent successfully to your email"}

    except Exception as e:
        db.rollback()
        logger.error(f"Error in request_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-otp")
async def verify_otp(verification: OTPVerification, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        # Find the latest unused OTP for this email
        otp_record = (
            db.query(OTP)
            .filter(
                and_(
                    OTP.email == verification.email,
                    OTP.is_used == False,
                    OTP.expires_at > datetime.now()
                )
            )
            .order_by(OTP.created_at.desc())
            .first()
        )

        if not otp_record:
            raise HTTPException(status_code=400, detail="No valid OTP found or OTP expired")

        if otp_record.otp_code != verification.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")

        # Mark OTP as used
        otp_record.is_used = True
        db.commit()

        # Get user details
        user = db.query(User).filter(User.email == verification.email).first()

        return {
            "message": "Authentication successful",
            "user": {
                "email": user.email,
            }
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error in verify_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# CREATE
@router.post("/", response_model=UserResponse)
def create_user(request: UserCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = User(
        name=request.name,
        email=request.email,
        role=request.role,
        center=request.center,
        group=request.group,
        password=request.password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# LOGIN
@router.post("/login")
def login(request: UserLogin, db: Session = Depends(get_db)):
    if not request.email:
        raise HTTPException(status_code=400, detail="Enter a valid email")
    if not request.password:
        raise HTTPException(status_code=400, detail="Enter a valid password")

    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_valid = False
    if user.password and (user.password.startswith("$2b$") or user.password.startswith("$2a$")):
        is_valid = verify_password(request.password, user.password)
    else:
        is_valid = (user.password == request.password)

    if not is_valid:
        raise HTTPException(status_code=401, detail="Incorrect password")

    user_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "group": user.group,
        "center": user.center,
    }
    access_token = create_access_token(data=user_payload)

    # Return JWT token + user details
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "center": user.center,
            "group": user.group,
        },
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "center": user.center,
        "group": user.group,
        "message": "Login successful"
    }


# GET ALL
@router.get("/", response_model=list[UserResponse])
def get_all_users(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return db.query(User).all()


# GET BY ID
@router.get("/{id}", response_model=UserResponse)
def get_user(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# DELETE
@router.delete("/{id}")
def delete_user(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


from pydantic import BaseModel, EmailStr
from typing import Optional

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    center: Optional[str] = None
    group: Optional[str] = None
    password: Optional[str] = None

    class Config:
        from_attributes = True


@router.put("/{id}", response_model=UserResponse)
def update_user(id: int, request: UserUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Find the user
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if email is being changed and already exists
    if request.email and request.email != user.email:
        existing = db.query(User).filter(User.email == request.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")

    # Update fields only if they are provided (partial update)
    update_data = request.model_dump(exclude_unset=True)  # Only fields sent in request

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return user


from pydantic import BaseModel, EmailStr

# Pydantic model specifically for password reset/update
class PasswordUpdateRequest(BaseModel):
    email: EmailStr
    new_password: str


@router.post("/update-password", response_model=dict)
async def update_password_only(request: PasswordUpdateRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Update user password using email
    - Requires email and new password
    - Returns 404 if email doesn't exist
    """
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No user found with this email address"
        )

    # Optional: you could add minimum password length/validation here
    if len(request.new_password.strip()) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long"
        )

    # Update password
    user.password = request.new_password  # ← in real app: hash it!

    db.commit()
    # No need to refresh since we only changed password

    return {
        "message": "Password updated successfully",
        "email": user.email
    }

