import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, Profile, Competency
from app.schemas.schemas import ProfileUpdate
from app.auth.dependencies import require_role

router = APIRouter(prefix="/api/profile", tags=["Profile"])

@router.get("/me")
def get_profile(
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "TRAINER", "ADMIN"))
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found for authenticated user")
    
    competencies = db.query(Competency).all()
    comp_list = [{"id": c.id, "domain": c.domain, "name": c.name, "description": c.description} for c in competencies]

    trainings = []
    if profile.previous_trainings:
        try:
            trainings = json.loads(profile.previous_trainings)
        except Exception:
            trainings = [profile.previous_trainings]

    return {
        "user_id": profile.user_id,
        "full_name": profile.full_name,
        "designation": profile.designation,
        "department": profile.department,
        "job_role": profile.job_role or "Senior Data Analyst & Field Survey Coordinator",
        "current_assignment": profile.current_assignment or "National Sample Survey 80th Round (Socio-Economic Survey)",
        "educational_qualification": profile.educational_qualification or "M.Sc. Statistics (Delhi University)",
        "previous_trainings": trainings if trainings else ["NSSO Field Enumeration Workshop", "Introduction to R for Official Statistics"],
        "experience_years": profile.experience_years or 6,
        "competencies": comp_list
    }

@router.put("/me")
def update_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "TRAINER", "ADMIN"))
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found for authenticated user")
    
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


