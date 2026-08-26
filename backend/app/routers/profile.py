import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, Profile, Competency
from app.schemas.schemas import ProfileUpdate
from app.auth.dependencies import decode_access_token

router = APIRouter(prefix="/api/profile", tags=["Profile"])

@router.get("/me")
def get_profile(
    authorization: Optional[str] = Header(None),
    user_id: str = "u-official-001",
    db: Session = Depends(get_db)
):
    if authorization:
        payload = decode_access_token(authorization)
        if payload and payload.get("sub"):
            user_id = payload["sub"]

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        profile = db.query(Profile).first()
    
    competencies = db.query(Competency).all()
    comp_list = [{"id": c.id, "domain": c.domain, "name": c.name, "description": c.description} for c in competencies]

    trainings = []
    if profile and profile.previous_trainings:
        try:
            trainings = json.loads(profile.previous_trainings)
        except Exception:
            trainings = [profile.previous_trainings]

    return {
        "user_id": profile.user_id if profile else user_id,
        "full_name": profile.full_name if profile else "Ananya Sharma",
        "designation": profile.designation if profile else "Statistical Officer",
        "department": profile.department if profile else "MoSPI DIID",
        "job_role": profile.job_role if profile else "Senior Data Analyst & Field Survey Coordinator",
        "current_assignment": profile.current_assignment if profile else "National Sample Survey 80th Round (Socio-Economic Survey)",
        "educational_qualification": profile.educational_qualification if profile else "M.Sc. Statistics (Delhi University)",
        "previous_trainings": trainings if trainings else ["NSSO Field Enumeration Workshop", "Introduction to R for Official Statistics"],
        "experience_years": profile.experience_years if profile else 6,
        "competencies": comp_list
    }

@router.put("/me")
def update_profile(
    data: ProfileUpdate,
    authorization: Optional[str] = Header(None),
    user_id: str = "u-official-001",
    db: Session = Depends(get_db)
):
    if authorization:
        payload = decode_access_token(authorization)
        if payload and payload.get("sub"):
            user_id = payload["sub"]

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    if data.full_name:
        profile.full_name = data.full_name
    if data.designation:
        profile.designation = data.designation
    if data.department:
        profile.department = data.department
    if data.job_role:
        profile.job_role = data.job_role
    if data.current_assignment:
        profile.current_assignment = data.current_assignment
    if data.educational_qualification:
        profile.educational_qualification = data.educational_qualification
    if data.previous_trainings is not None:
        profile.previous_trainings = json.dumps(data.previous_trainings)

    db.commit()
    return {"status": "success", "message": "Profile updated successfully"}

