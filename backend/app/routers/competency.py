from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import QuizAttempt, CompetencyResult, Competency

router = APIRouter(prefix="/api/competency", tags=["Competency"])

@router.get("/me")
def get_my_competency(user_id: str = "u-official-001", db: Session = Depends(get_db)):
    # Get latest attempt
    latest_attempt = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).order_by(QuizAttempt.completed_at.desc()).first()
    
    if not latest_attempt:
        latest_attempt = db.query(QuizAttempt).order_by(QuizAttempt.completed_at.desc()).first()

    if not latest_attempt:
        return {
            "overall_score": 0.0,
            "competencies": []
        }

    results = db.query(CompetencyResult).filter(CompetencyResult.attempt_id == latest_attempt.id).all()
    formatted = []

    for r in results:
        comp = db.query(Competency).filter(Competency.id == r.competency_id).first()
        formatted.append({
            "competency_id": r.competency_id,
            "competency_name": comp.name if comp else "Statistical Competency",
            "domain": comp.domain if comp else "Statistical Competencies",
            "score": r.score,
            "status": r.status,
            "priority": r.priority,
            "evidence": r.evidence
        })

    return {
        "attempt_id": latest_attempt.id,
        "overall_score": latest_attempt.overall_score,
        "completed_at": latest_attempt.completed_at,
        "competencies": formatted
    }
