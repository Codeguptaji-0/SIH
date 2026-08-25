from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, Profile, Competency
from app.schemas.schemas import ProfileUpdate

router = APIRouter(prefix="/api/profile", tags=["Profile"])

@router.get("/me")
def get_profile(user_id: str = "u-official-001", db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        profile = db.query(Profile).first()
    
    competencies = db.query(Competency).all()
    comp_list = [{"id": c.id, "domain": c.domain, "name": c.name, "description": c.description} for c in competencies]

    return {
        "user_id": profile.user_id if profile else user_id,
        "full_name": profile.full_name if profile else "Ananya Sharma",
        "designation": profile.designation if profile else "Statistical Officer",
        "department": profile.department if profile else "MoSPI DIID",
        "experience_years": profile.experience_years if profile else 6,
        "competencies": comp_list
    }

@router.put("/me")
def update_profile(data: ProfileUpdate, user_id: str = "u-official-001", db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    if data.full_name:
        profile.full_name = data.full_name
    if data.designation:
        profile.designation = data.designation
    if data.department:
        profile.department = data.department

    db.commit()
    return {"status": "success", "message": "Profile updated"}
