from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, Profile
from app.schemas.schemas import LoginRequest, UserResponse

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
    
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=profile.full_name if profile else "Official User",
        designation=profile.designation if profile else "Statistical Officer",
        department=profile.department if profile else "MoSPI DIID"
    )

@router.get("/me", response_model=UserResponse)
def get_current_user(email: str = "official@skillsetu.demo", db: Session = Depends(get_db)):
    return login(LoginRequest(email=email), db)
