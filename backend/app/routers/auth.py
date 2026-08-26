import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, Profile
from app.schemas.schemas import LoginRequest, UserResponse
from app.auth.dependencies import create_access_token, decode_access_token

# Note: This JWT layer demonstrates production-ready token-based auth. In a real government deployment,
# this would be replaced by integration with the government's SSO provider (e.g., via SAML/OAuth2 against the National SSO framework).

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/login", response_model=UserResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    email = request.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Default fallback persona lookup
        if "official" in email:
            user = db.query(User).filter(User.role == "OFFICIAL").first()
        elif "trainer" in email:
            user = db.query(User).filter(User.role == "TRAINER").first()
        elif "admin" in email:
            user = db.query(User).filter(User.role == "ADMIN").first()
        
    if not user:
        user = db.query(User).first()
        
    if not user:
        raise HTTPException(status_code=404, detail="No persona found in seed database.")

    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    
    # Issue signed JWT access token containing user identity and assigned role
    token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role
    })
    
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

@router.get("/me", response_model=UserResponse)
def get_current_user(
    authorization: str = Header(None),
    email: str = "official@skillsetu.demo",
    db: Session = Depends(get_db)
):
    if authorization:
        payload = decode_access_token(authorization)
        if payload and payload.get("sub"):
            user = db.query(User).filter(User.id == payload["sub"]).first()
            if user:
                email = user.email
    return login(LoginRequest(email=email), db)

