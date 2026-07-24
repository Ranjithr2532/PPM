import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from passlib.context import CryptContext

try:
    from .config import (
        SECRET_KEY,
        REFRESH_SECRET_KEY,
        ALGORITHM,
        ACCESS_TOKEN_EXPIRE_MINUTES,
        REFRESH_TOKEN_EXPIRE_DAYS,
        JWT_ISSUER,
        JWT_AUDIENCE,
    )
except ImportError:
    from config import (
        SECRET_KEY,
        REFRESH_SECRET_KEY,
        ALGORITHM,
        ACCESS_TOKEN_EXPIRE_MINUTES,
        REFRESH_TOKEN_EXPIRE_DAYS,
        JWT_ISSUER,
        JWT_AUDIENCE,
    )

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plain text password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a short-lived JWT Access Token with claims (exp, iss, aud, iat, jti).
    Never include sensitive data like passwords or PII in the payload.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a long-lived JWT Refresh Token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    })

    return jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)


def decode_and_validate_token(token: str, is_refresh: bool = False) -> Dict[str, Any]:
    """
    Decodes and validates a JWT token ensuring signature, expiry, issuer, and audience are valid.
    """
    secret = REFRESH_SECRET_KEY if is_refresh else SECRET_KEY
    expected_type = "refresh" if is_refresh else "access"
    
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
        )
        
        if payload.get("type") != expected_type:
            raise ValueError(f"Invalid token type. Expected '{expected_type}'.")
            
        return payload
    except JWTError as e:
        print(f"JWT Exception: {type(e).__name__} - {str(e)}")
        raise ValueError(f"Token validation failed: {str(e)}")
