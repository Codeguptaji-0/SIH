import json
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Document, DocumentChunk, Question, Competency, QuizAttempt, CompetencyResult
from app.schemas.schemas import QuizGenerateRequest, QuizSubmitRequest
from app.ai.provider import get_ai_provider
from app.competency.engine import CompetencyEngine

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])

@router.post("/generate")
def generate_quiz(request: QuizGenerateRequest, db: Session = Depends(get_db)):
    doc = None
    chunks_text = []

    if request.document_id:
        doc = db.query(Document).filter(Document.id == request.document_id).first()
        if doc:
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
            chunks_text = [c.content for c in chunks]

    if not chunks_text:
        chunks_text = [
            "Official Statistics Sampling Methods: Stratified sampling reduces sampling variance in large scale NSS surveys.",
            "Consumer Price Index calculation formula uses Laspeyres base weighting for urban and rural sector baskets.",
            "Python Pandas DataFrames provide primary tabular data structures for statistical inference and microdata cleaning."
        ]

    ai_provider = get_ai_provider()
    raw_mcqs = ai_provider.generate_mcqs(chunks_text, count=request.number_of_questions)

    # Resolve default competency mapping
    all_comps = db.query(Competency).all()
    comp_map = {c.name.lower(): c.id for c in all_comps}
    default_comp_id = all_comps[0].id if all_comps else "comp-stat-001"

    saved_questions = []
    for item in raw_mcqs:
        matched_comp_id = default_comp_id
        for comp_name, comp_id in comp_map.items():
            if comp_name in item.get("competency_name", "").lower():
                matched_comp_id = comp_id
                break

        q = Question(
            id=str(uuid.uuid4()),
            document_id=doc.id if doc else None,
            competency_id=matched_comp_id,
            question_text=item["question_text"],
            options_json=json.dumps(item["options"]),
            correct_option=item["correct_option"],
            explanation=item["explanation"],
            difficulty=item.get("difficulty", "medium"),
            review_status="PENDING", # Trainer Human-in-the-Loop default
            source_reference=item.get("source_reference", "Uploaded Learning Material")
        )
        db.add(q)
        saved_questions.append(q)

    db.commit()

    return {
        "status": "success",
        "quiz_id": str(uuid.uuid4()),
        "questions_generated": len(saved_questions),
        "review_status": "PENDING_TRAINER_APPROVAL"
    }

@router.get("/active")
def get_active_quiz(user_id: str = "u-official-001", db: Session = Depends(get_db)):
    # Fetch questions available for quiz
    questions = db.query(Question).filter(Question.review_status == "APPROVED").all()
    
    # If not enough approved, fallback to all questions
    if len(questions) < 5:
        questions = db.query(Question).all()

    formatted_q = []
    for q in questions[:10]:
        comp = db.query(Competency).filter(Competency.id == q.competency_id).first()
        opts = json.loads(q.options_json) if isinstance(q.options_json, str) else q.options_json
        formatted_q.append({
            "id": q.id,
            "competency_id": q.competency_id,
            "competency_name": comp.name if comp else "Statistical Methods",
            "domain": comp.domain if comp else "Statistical Competencies",
            "question_text": q.question_text,
            "options": opts,
            "difficulty": q.difficulty,
            "source_reference": q.source_reference
        })

    return {
        "quiz_id": "active-quiz-session-001",
        "total_questions": len(formatted_q),
        "questions": formatted_q
    }

@router.post("/{quiz_id}/submit")
def submit_quiz(quiz_id: str, request: QuizSubmitRequest, user_id: str = "u-official-001", db: Session = Depends(get_db)):
    question_ids = [ans.question_id for ans in request.answers]
    db_questions = db.query(Question).filter(Question.id.in_(question_ids)).all()
    
    question_dict_list = []
    for q in db_questions:
        comp = db.query(Competency).filter(Competency.id == q.competency_id).first()
        question_dict_list.append({
            "id": q.id,
            "competency_id": q.competency_id,
            "competency_name": comp.name if comp else "Statistical Methods",
            "domain": comp.domain if comp else "Statistical Competencies",
            "correct_option": q.correct_option,
            "question_text": q.question_text
        })

    answers_list = [{"question_id": a.question_id, "selected_option": a.selected_option} for a in request.answers]

    # Evaluate performance using CompetencyEngine
    eval_result = CompetencyEngine.evaluate_quiz(answers_list, question_dict_list)

    # Save Attempt
    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        user_id=user_id,
        total_questions=eval_result["total_questions"],
        correct_answers=eval_result["correct_answers"],
        overall_score=eval_result["overall_score"]
    )
    db.add(attempt)

    for cr in eval_result["competency_results"]:
        c_res = CompetencyResult(
            id=str(uuid.uuid4()),
            attempt_id=attempt.id,
            competency_id=cr["competency_id"],
            score=cr["score"],
            status=cr["status"],
            priority=cr["priority"],
            evidence=cr["evidence"]
        )
        db.add(c_res)

    db.commit()

    return {
        "attempt_id": attempt.id,
        "overall_score": attempt.overall_score,
        "total_questions": attempt.total_questions,
        "correct_answers": attempt.correct_answers,
        "results": eval_result["competency_results"]
    }
