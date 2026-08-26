import base64
import json
from datetime import datetime, timedelta
from typing import Optional, List, Callable
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.config import settings

SECRET_KEY = getattr(settings, "SECRET_KEY", "skillsetu_sih26101_secret_key_demo_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

try:
    from jose import jwt, JWTError
    HAS_JOSE = True
except ImportError:
    HAS_JOSE = False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire.timestamp())})
    
    if HAS_JOSE:
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    else:
        # Structured base64 fallback for offline/demo environment without python-jose installed
        payload_str = json.dumps(to_encode)
        encoded_payload = base64.urlsafe_b64encode(payload_str.encode()).decode().rstrip("=")
        return f"demo_jwt.{encoded_payload}.signature"

def decode_access_token(token: str) -> Optional[dict]:
    if not token:
        return None
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
        
    if HAS_JOSE:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError:
            pass
            
    # Try decoding fallback format
    try:
        parts = token.split(".")
        if len(parts) >= 2:
            payload_part = parts[1]
            padding = "=" * (4 - len(payload_part) % 4)
            decoded_bytes = base64.urlsafe_b64decode(payload_part + padding)
            payload = json.loads(decoded_bytes.decode())
            return payload
    except Exception:
        pass
    return None

def get_current_user_from_token(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(authorization)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing user ID.",
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Fallback to role lookup if ID mismatch in demo seed
        role = payload.get("role")
        if role:
            user = db.query(User).filter(User.role == role).first()
            
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found.",
        )
        
    return user

def require_role(*allowed_roles: str):
    """
    RBAC dependency requiring current user to possess one of the allowed_roles.
    Returns HTTP 403 FORBIDDEN if user role is not permitted.
    """
    def role_checker(current_user: User = Depends(get_current_user_from_token)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Role '{current_user.role}' is not authorized. Required: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker
