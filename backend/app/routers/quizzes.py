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

from app.auth.dependencies import require_role

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])

@router.post("/generate")
def generate_quiz(
    request: QuizGenerateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "ADMIN"))
):
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
def get_active_quiz(
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "ADMIN"))
):
    # Only trainer-approved questions may ever be served.
    #
    # This previously fell back to db.query(Question).all() when fewer than five
    # questions were approved, which defeated the entire human-in-the-loop review
    # gate: any PENDING or even REJECTED question would be served to an officer as
    # soon as the approved pool was small. An empty quiz is the honest answer.
    questions = db.query(Question).filter(Question.review_status == "APPROVED").all()

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
        "questions": formatted_q,
        # Let the client render an honest empty state instead of guessing why the
        # list is short. approved_pool_size is the real number of approved questions.
        "approved_pool_size": len(questions),
        "message": (
            None if formatted_q else
            "No trainer-approved questions are available yet. A trainer must approve "
            "generated questions before an assessment can be taken."
        ),
    }

@router.post("/{quiz_id}/submit")
def submit_quiz(
    quiz_id: str,
    request: QuizSubmitRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "ADMIN"))
):
    question_ids = [ans.question_id for ans in request.answers]
    if not question_ids:
        raise HTTPException(status_code=400, detail="No answers submitted.")

    db_questions = db.query(Question).filter(Question.id.in_(question_ids)).all()

    # Every submitted question must exist and must be approved. Previously an unknown
    # question_id was silently skipped by the scoring engine while still counting
    # toward the denominator, so a client could shift its own score by inventing ids.
    found_ids = {q.id for q in db_questions}
    unknown = [qid for qid in question_ids if qid not in found_ids]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail="Unknown question id(s) in submission: %s" % ", ".join(unknown[:5]),
        )

    not_approved = [q.id for q in db_questions if q.review_status != "APPROVED"]
    if not_approved:
        raise HTTPException(
            status_code=400,
            detail="Submission contains question(s) that are not trainer-approved.",
        )
    
    question_dict_list = []
    for q in db_questions:
        comp = db.query(Competency).filter(Competency.id == q.competency_id).first()
        question_dict_list.append({
            "id": q.id,
            "competency_id": q.competency_id,
            "competency_name": comp.name if comp else "Statistical Methods",
            "domain": comp.domain if comp else "Statistical Competencies",
            "correct_option": q.correct_option,
            "question_text": q.question_text,
            # Needed for difficulty-weighted scoring in CompetencyEngine.
            "difficulty": q.difficulty,
            "explanation": q.explanation,
        })

    answers_list = [{"question_id": a.question_id, "selected_option": a.selected_option} for a in request.answers]

    # Evaluate performance using CompetencyEngine
    eval_result = CompetencyEngine.evaluate_quiz(answers_list, question_dict_list)

    # Save Attempt
    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        user_id=user.id,
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

