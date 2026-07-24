from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Request
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, EmailStr

from db import get_db
from models.user_model import User
from security.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
    decode_and_validate_token,
    get_password_hash,
)
from security.config import REFRESH_TOKEN_EXPIRE_DAYS, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    OAuth2 JWT Login Endpoint.
    Supports both Form Data (Swagger UI) and JSON requests seamlessly.
    """
    email = None
    password = None

    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form_data = await request.form()
        email = form_data.get("username") or form_data.get("email")
        password = form_data.get("password")
    else:
        try:
            body = await request.json()
            email = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            pass

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check password (supports hashed check with fallback for plaintext legacy passwords)
    is_valid = False
    if user.password and (user.password.startswith("$2b$") or user.password.startswith("$2a$")):
        is_valid = verify_password(password, user.password)
    else:
        is_valid = (user.password == password)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Payload includes non-sensitive identifier and authorization claims only
    user_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "group": user.group,
        "center": user.center,
    }

    access_token = create_access_token(data=user_payload)
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Set Refresh Token in secure, HttpOnly cookie to protect against XSS
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    user_info = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "center": user.center,
        "group": user.group,
    }

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_info,
    )


@router.post("/refresh")
def refresh_token_endpoint(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    """
    Generates a new short-lived Access Token using a valid Refresh Token.
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    try:
        payload = decode_and_validate_token(refresh_token, is_refresh=True)
        user_id = payload.get("sub")
        
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User associated with token not found",
            )

        user_payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "group": user.group,
            "center": user.center,
        }

        new_access_token = create_access_token(data=user_payload)
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid refresh token: {str(e)}",
        )
