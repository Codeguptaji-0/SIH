import json
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, Profile
from app.schemas.schemas import LoginRequest, UserResponse
from app.auth.dependencies import (
    create_access_token,
    decode_access_token,
    get_current_user_from_token,
    revoke_token,
    verify_password,
)

# Note: This JWT layer demonstrates production-ready token-based auth. In a real government deployment,
# this would be replaced by integration with the government's SSO provider (e.g., via SAML/OAuth2 against the National SSO framework).

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Returned for both an unknown email and a bad password, so the endpoint does not
# reveal which accounts exist.
INVALID_CREDENTIALS_DETAIL = "Invalid email or password"


def _build_user_response(user: User, db: Session, token: str = None) -> UserResponse:
    """Assemble the API response for a user, including their profile fields."""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    trainings = []
    if profile and profile.previous_trainings:
        try:
            trainings = json.loads(profile.previous_trainings)
        except Exception:
            trainings = [profile.previous_trainings]

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=profile.full_name if profile else "Official User",
        designation=profile.designation if profile else "Statistical Officer",
        department=profile.department if profile else "MoSPI DIID",
        job_role=profile.job_role if profile else "Senior Data Analyst",
        current_assignment=profile.current_assignment if profile else "NSS 80th Round Survey",
        educational_qualification=profile.educational_qualification if profile else "M.Sc. Statistics",
        previous_trainings=trainings,
        access_token=token,
        token_type="bearer"
    )


@router.post("/login", response_model=UserResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate by email and password and issue a signed JWT.

    The user is resolved by exact email match only. Earlier revisions fell back to
    matching any account whose role name appeared as a substring of the submitted
    email, and finally to the first row in the users table, which meant an address
    like "i-am-an-admin@example.com" was issued an ADMIN token with no password at
    all. Both fallbacks are removed.
    """
    email = request.email.lower().strip()

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Issue signed JWT access token containing user identity and assigned role
    token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role
    })

    return _build_user_response(user, db, token)

@router.post("/refresh")
def refresh_token(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    payload = decode_access_token(authorization)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token for refresh")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role
    })
    return {"access_token": new_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_current_user(
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Return the caller's own profile, derived solely from the signed token.

    This previously accepted an `email` query parameter defaulting to a demo
    account, and its function body ended without a return statement, so the
    endpoint raised a response-validation error on every call.
    """
    return _build_user_response(current_user, db)

@router.post("/logout")
def logout(authorization: str = Header(None)):
    if authorization:
        revoke_token(authorization)
    return {"status": "success", "message": "Successfully logged out and token revoked"}
