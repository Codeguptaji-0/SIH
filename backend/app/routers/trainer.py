import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Question, Competency
from pydantic import BaseModel

router = APIRouter(prefix="/api/trainer", tags=["Trainer Review"])

class QuestionReviewUpdate(BaseModel):
    action: str # APPROVE, REJECT, EDIT
    question_text: Optional[str] = None
    explanation: Optional[str] = None

@router.get("/questions")
def get_trainer_questions(review_status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Question)
    if review_status:
        query = query.filter(Question.review_status == review_status.upper())
    
    questions = query.all()
    result = []
    for q in questions:
        comp = db.query(Competency).filter(Competency.id == q.competency_id).first()
        opts = json.loads(q.options_json) if isinstance(q.options_json, str) else q.options_json
        result.append({
            "id": q.id,
            "competency_id": q.competency_id,
            "competency_name": comp.name if comp else "Statistical Methods",
            "question_text": q.question_text,
            "options": opts,
            "correct_option": q.correct_option,
            "explanation": q.explanation,
            "difficulty": q.difficulty,
            "review_status": q.review_status,
            "source_reference": q.source_reference
        })
    return result

@router.post("/questions/{question_id}/review")
def review_question(question_id: str, payload: QuestionReviewUpdate, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    action = payload.action.upper()
    if action == "APPROVE":
        q.review_status = "APPROVED"
    elif action == "REJECT":
        q.review_status = "REJECTED"
    elif action == "EDIT":
        if payload.question_text:
            q.question_text = payload.question_text
        if payload.explanation:
            q.explanation = payload.explanation
        q.review_status = "APPROVED"

    db.commit()
    return {"status": "success", "action": action, "question_id": q.id}
