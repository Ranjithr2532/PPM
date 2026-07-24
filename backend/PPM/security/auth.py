from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, Dict, Any

try:
    from .security import decode_and_validate_token
except ImportError:
    from security import decode_and_validate_token

# Define OAuth2 Bearer scheme for Swagger UI & token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_token_from_header_or_cookie(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme)
) -> str:
    """
    Extract JWT token from Authorization header or fallback to HTTP-only cookie.
    """
    token = bearer_token
    if not token:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            
    if not token:
        cookie_token = request.cookies.get("access_token")
        if cookie_token:
            token = cookie_token[7:].strip() if cookie_token.startswith("Bearer ") else cookie_token.strip()

    if token:
        token = token.strip('"').strip("'").strip()
        return token

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Missing authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(token: str = Depends(get_token_from_header_or_cookie)) -> Dict[str, Any]:
    """
    FastAPI dependency that validates the Access Token (signature, exp, iss, aud)
    and returns the authenticated user payload.
    """
    try:
        payload = decode_and_validate_token(token, is_refresh=False)
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            print("JWT Validation Error: missing subject ('sub')")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing subject ('sub')",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except ValueError as e:
        print(f"JWT Validation Failure: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_roles(allowed_roles: list[str]):
    """
    Dependency factory to check if current user has required roles.
    Example: Depends(require_roles(["admin", "scientist"]))
    """
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_roles = current_user.get("roles", [])
        if isinstance(user_roles, str):
            user_roles = [user_roles]
            
        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted: insufficient privileges"
            )
        return current_user

    return role_checker
