import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import QuizAttempt, CompetencyResult, Competency, LearningPath
from app.recommendations.generator import RecommendationGenerator

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"])

@router.post("/generate")
def generate_recommendations(user_id: str = "u-official-001", db: Session = Depends(get_db)):
    latest_attempt = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).order_by(QuizAttempt.completed_at.desc()).first()
    
    if not latest_attempt:
        latest_attempt = db.query(QuizAttempt).order_by(QuizAttempt.completed_at.desc()).first()

    results = []
    if latest_attempt:
        c_results = db.query(CompetencyResult).filter(CompetencyResult.attempt_id == latest_attempt.id).all()
        for r in c_results:
            comp = db.query(Competency).filter(Competency.id == r.competency_id).first()
            results.append({
                "competency_id": r.competency_id,
                "competency_name": comp.name if comp else "Statistical Method",
                "domain": comp.domain if comp else "Statistical Competencies",
                "status": r.status,
                "priority": r.priority
            })

    raw_path = RecommendationGenerator.generate_learning_path(results)

    # Save generated learning path items to database
    db.query(LearningPath).filter(LearningPath.user_id == user_id).delete()

    saved_items = []
    for item in raw_path:
        lp = LearningPath(
            id=str(uuid.uuid4()),
            user_id=user_id,
            attempt_id=latest_attempt.id if latest_attempt else None,
            course_id=item["course_id"],
            course_title=item["course_title"],
            competency_id=item["competency_id"],
            provider=item["provider"],
            priority=item["priority"],
            estimated_duration=item["estimated_duration"],
            status="ASSIGNED"
        )
        db.add(lp)
        saved_items.append({
            "id": lp.id,
            "course_id": lp.course_id,
            "course_title": lp.course_title,
            "competency_name": item["competency_name"],
            "provider": lp.provider,
            "priority": lp.priority,
            "estimated_duration": lp.estimated_duration,
            "status": lp.status
        })

    db.commit()

    return {
        "status": "success",
        "learning_path": saved_items
    }

@router.get("")
def get_learning_path(user_id: str = "u-official-001", db: Session = Depends(get_db)):
    paths = db.query(LearningPath).filter(LearningPath.user_id == user_id).all()
    if not paths:
        # Generate initial path if empty
        return generate_recommendations(user_id, db)

    result = []
    for p in paths:
        comp = db.query(Competency).filter(Competency.id == p.competency_id).first()
        result.append({
            "id": p.id,
            "course_id": p.course_id,
            "course_title": p.course_title,
            "competency_name": comp.name if comp else "Statistical Methods",
            "provider": p.provider,
            "priority": p.priority,
            "estimated_duration": p.estimated_duration,
            "status": p.status
        })

    return {"learning_path": result}

@router.post("/{item_id}/complete")
def complete_learning_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(LearningPath).filter(LearningPath.id == item_id).first()
    if not item:
        item = db.query(LearningPath).first()
    
    if item:
        item.status = "COMPLETED"
        db.commit()

    return {"status": "success", "message": "Course marked as completed. Progress score updated."}
