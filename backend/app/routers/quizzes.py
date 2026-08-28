import json
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import (
    Document, DocumentChunk, Question, Competency, QuizAttempt, CompetencyResult,
    AdaptiveSession, AuditLog,
)
from app.schemas.schemas import (
    QuizGenerateRequest, QuizSubmitRequest, AdaptiveStartRequest, AdaptiveAnswerRequest,
)
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



# ---------------------------------------------------------------------------
# Adaptive assessment
#
# CompetencyEngine.next_difficulty() already existed and was correct, but nothing
# called it, so "adaptive difficulty" was a claim with no runtime behind it. The
# three endpoints below make the ladder real.
#
# Two deliberate choices. First, the state is held server-side in
# adaptive_sessions: the client submits one answer at a time and is told what to
# show next, it never tells the server what level it is on. Second, the ladder is
# rule-based and records why it moved, so an attempt can be replayed and defended
# rather than being an opaque model output.
# ---------------------------------------------------------------------------

MAX_ADAPTIVE_QUESTIONS = 20


def _approved_pool(db: Session):
    """Only trainer-approved questions are ever eligible, same gate as /active."""
    return db.query(Question).filter(Question.review_status == "APPROVED")


def _serve_payload(db: Session, q: Question) -> dict:
    """
    The question as sent to the officer.

    correct_option and explanation are deliberately absent: they are revealed only
    in the response to the answer for that question, never before it.
    """
    comp = db.query(Competency).filter(Competency.id == q.competency_id).first()
    opts = json.loads(q.options_json) if isinstance(q.options_json, str) else q.options_json
    return {
        "id": q.id,
        "competency_id": q.competency_id,
        "competency_name": comp.name if comp else None,
        "domain": comp.domain if comp else None,
        "question_text": q.question_text,
        "options": opts,
        "difficulty": q.difficulty,
        "source_reference": q.source_reference,
    }


def _pick_question(db: Session, level: str, exclude_ids: List[str]):
    """
    Next unseen approved question, preferring `level`.

    If the approved pool has nothing left at the requested level, widen to the
    other levels rather than ending the run early. The caller reports that
    substitution honestly instead of pretending the ladder moved there.

    Returns (question_or_None, was_substituted).
    """
    order = [level] + [lv for lv in CompetencyEngine.LEVELS if lv != level]
    for candidate_level in order:
        query = _approved_pool(db).filter(Question.difficulty == candidate_level)
        if exclude_ids:
            query = query.filter(~Question.id.in_(exclude_ids))
        q = query.order_by(func.random()).first()
        if q:
            return q, (candidate_level != level)
    return None, False


def _finalise_adaptive(db: Session, user, session_row: AdaptiveSession, trail: List[dict]) -> dict:
    """
    Score a finished run with the same difficulty-weighted engine the fixed-length
    quiz uses, so an adaptive attempt and a normal attempt are directly comparable
    and both land in quiz_attempts / competency_results.
    """
    answered_ids = [entry["question_id"] for entry in trail]
    db_questions = (
        db.query(Question).filter(Question.id.in_(answered_ids)).all() if answered_ids else []
    )

    question_dicts = []
    for dq in db_questions:
        comp = db.query(Competency).filter(Competency.id == dq.competency_id).first()
        question_dicts.append({
            "id": dq.id,
            "competency_id": dq.competency_id,
            "competency_name": comp.name if comp else "Statistical Methods",
            "domain": comp.domain if comp else "Statistical Competencies",
            "correct_option": dq.correct_option,
            "question_text": dq.question_text,
            "difficulty": dq.difficulty,
            "explanation": dq.explanation,
        })

    answers = [
        {"question_id": e["question_id"], "selected_option": e["selected_option"]} for e in trail
    ]
    eval_result = CompetencyEngine.evaluate_quiz(answers, question_dicts)

    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        user_id=user.id,
        total_questions=eval_result["total_questions"],
        correct_answers=eval_result["correct_answers"],
        overall_score=eval_result["overall_score"],
    )
    db.add(attempt)

    for cr in eval_result["competency_results"]:
        db.add(CompetencyResult(
            id=str(uuid.uuid4()),
            attempt_id=attempt.id,
            competency_id=cr["competency_id"],
            score=cr["score"],
            status=cr["status"],
            priority=cr["priority"],
            evidence=cr["evidence"],
        ))

    session_row.status = "COMPLETED"
    session_row.attempt_id = attempt.id
    session_row.completed_at = datetime.utcnow()

    # The audit_logs table existed with almost no writers. A completed assessment
    # that drives someone's training plan is exactly the event that belongs in it.
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        action="ADAPTIVE_ASSESSMENT_COMPLETED",
        details=json.dumps({
            "session_id": session_row.id,
            "attempt_id": attempt.id,
            "questions_answered": len(trail),
            "final_level": session_row.current_level,
            "overall_score": eval_result["overall_score"],
            "raw_score": eval_result["raw_score"],
            "ladder": [
                {
                    "n": e["question_number"],
                    "difficulty": e["difficulty"],
                    "correct": e["is_correct"],
                    "level_after": e["level_after"],
                    "reason": e["adaptation_reason"],
                }
                for e in trail
            ],
        }),
    ))

    eval_result["attempt_id"] = attempt.id
    eval_result["final_level"] = session_row.current_level
    eval_result["ladder"] = trail
    return eval_result


@router.post("/adaptive/start")
def start_adaptive_assessment(
    request: AdaptiveStartRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "ADMIN"))
):
    starting_level = (request.starting_level or CompetencyEngine.DEFAULT_DIFFICULTY).lower()
    if starting_level not in CompetencyEngine.LEVELS:
        raise HTTPException(
            status_code=400,
            detail="starting_level must be one of: %s" % ", ".join(CompetencyEngine.LEVELS),
        )

    max_questions = max(1, min(int(request.max_questions or 10), MAX_ADAPTIVE_QUESTIONS))
    pool_size = _approved_pool(db).count()

    first_q, substituted = (None, False) if pool_size == 0 else _pick_question(db, starting_level, [])
    if first_q is None:
        # No session row is created, because a session with nothing to serve is not a
        # session. The client gets the same honest empty state as /active.
        return {
            "session_id": None,
            "question": None,
            "approved_pool_size": pool_size,
            "message": (
                "No trainer-approved questions are available yet. A trainer must approve "
                "generated questions before an adaptive assessment can start."
            ),
        }

    # One live session per officer. The previous run is marked ABANDONED rather than
    # deleted, so its partial trail survives for audit.
    db.query(AdaptiveSession).filter(
        AdaptiveSession.user_id == user.id,
        AdaptiveSession.status == "ACTIVE",
    ).update({"status": "ABANDONED", "updated_at": datetime.utcnow()}, synchronize_session=False)

    session_row = AdaptiveSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        current_level=first_q.difficulty if substituted else starting_level,
        consecutive_correct=0,
        consecutive_wrong=0,
        answered_count=0,
        correct_count=0,
        max_questions=max_questions,
        served_json=json.dumps([first_q.id]),
        trail_json=json.dumps([]),
        status="ACTIVE",
        started_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(session_row)
    db.commit()

    return {
        "session_id": session_row.id,
        "status": "ACTIVE",
        "current_level": session_row.current_level,
        "question_number": 1,
        "max_questions": max_questions,
        "approved_pool_size": pool_size,
        "ladder": {
            "adaptation_reason": "Starting at '%s'." % session_row.current_level,
            "step_up_after": CompetencyEngine.STEP_UP_AFTER,
            "step_down_after": CompetencyEngine.STEP_DOWN_AFTER,
            "level_substituted": substituted,
        },
        "question": _serve_payload(db, first_q),
        "message": (
            "No approved question was available at '%s', so one at '%s' was served instead."
            % (starting_level, first_q.difficulty)
        ) if substituted else None,
    }


@router.post("/adaptive/{session_id}/answer")
def answer_adaptive_question(
    session_id: str,
    request: AdaptiveAnswerRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "ADMIN"))
):
    # Ownership, not merely existence. Looking a row up by id alone is the bug that
    # was fixed in recommendations.py; it is not reintroduced here.
    session_row = db.query(AdaptiveSession).filter(
        AdaptiveSession.id == session_id,
        AdaptiveSession.user_id == user.id,
    ).first()
    if not session_row:
        raise HTTPException(status_code=404, detail="Adaptive session not found for this user.")
    if session_row.status != "ACTIVE":
        raise HTTPException(
            status_code=409,
            detail="This adaptive session is %s and cannot accept answers." % session_row.status.lower(),
        )

    served = json.loads(session_row.served_json or "[]")
    trail = json.loads(session_row.trail_json or "[]")

    # The server decides which question is outstanding. A client cannot answer a
    # question it was never served, nor re-answer one to improve its score.
    if len(trail) >= len(served):
        raise HTTPException(
            status_code=409, detail="There is no question awaiting an answer in this session."
        )
    pending_id = served[-1]
    if request.question_id != pending_id:
        raise HTTPException(
            status_code=400,
            detail="This session is waiting for an answer to question %s." % pending_id,
        )

    q = db.query(Question).filter(Question.id == pending_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="The served question no longer exists.")
    if q.review_status != "APPROVED":
        raise HTTPException(
            status_code=409,
            detail="The served question is no longer trainer-approved and cannot be scored.",
        )

    options = json.loads(q.options_json) if isinstance(q.options_json, str) else q.options_json
    if not isinstance(request.selected_option, int) or not (0 <= request.selected_option < len(options)):
        raise HTTPException(
            status_code=400,
            detail="selected_option must be an option index between 0 and %d." % (len(options) - 1),
        )

    is_correct = (request.selected_option == q.correct_option)
    level_before = session_row.current_level

    if is_correct:
        session_row.consecutive_correct += 1
        session_row.consecutive_wrong = 0
        session_row.correct_count += 1
    else:
        session_row.consecutive_wrong += 1
        session_row.consecutive_correct = 0
    session_row.answered_count += 1

    next_level, reason = CompetencyEngine.next_difficulty(
        level_before, session_row.consecutive_correct, session_row.consecutive_wrong
    )

    # Once a rung has been earned the streaks restart. Without this reset the second
    # consecutive correct answer would keep re-triggering a step up on every later
    # question in the run, and the ladder would only ever climb.
    if (session_row.consecutive_correct >= CompetencyEngine.STEP_UP_AFTER
            or session_row.consecutive_wrong >= CompetencyEngine.STEP_DOWN_AFTER):
        session_row.consecutive_correct = 0
        session_row.consecutive_wrong = 0

    session_row.current_level = next_level

    trail.append({
        "question_number": len(trail) + 1,
        "question_id": q.id,
        "competency_id": q.competency_id,
        "difficulty": q.difficulty,
        "weight": CompetencyEngine.weight_for(q.difficulty),
        "selected_option": request.selected_option,
        "correct_option": q.correct_option,
        "is_correct": is_correct,
        "level_before": level_before,
        "level_after": next_level,
        "adaptation_reason": reason,
    })

    finished = session_row.answered_count >= session_row.max_questions
    next_payload = None
    substituted = False
    exhausted = False

    if not finished:
        next_q, substituted = _pick_question(db, next_level, served)
        if next_q is None:
            finished = True
            exhausted = True
        else:
            served.append(next_q.id)
            next_payload = _serve_payload(db, next_q)
            if substituted:
                session_row.current_level = next_q.difficulty

    session_row.served_json = json.dumps(served)
    session_row.trail_json = json.dumps(trail)
    session_row.updated_at = datetime.utcnow()

    response = {
        "session_id": session_row.id,
        "answered": {
            "question_id": q.id,
            "is_correct": is_correct,
            "correct_option": q.correct_option,
            # The explanation was stored on every question but never returned, so a
            # wrong answer taught the officer nothing. It is released here, after the
            # answer is locked in.
            "explanation": q.explanation,
            "difficulty": q.difficulty,
            "weight": CompetencyEngine.weight_for(q.difficulty),
        },
        "ladder": {
            "level_before": level_before,
            "level_after": session_row.current_level,
            "adaptation_reason": reason,
            "consecutive_correct": session_row.consecutive_correct,
            "consecutive_wrong": session_row.consecutive_wrong,
            "step_up_after": CompetencyEngine.STEP_UP_AFTER,
            "step_down_after": CompetencyEngine.STEP_DOWN_AFTER,
            "level_substituted": substituted,
        },
        "progress": {
            "answered": session_row.answered_count,
            "correct": session_row.correct_count,
            "max_questions": session_row.max_questions,
        },
        "question": next_payload,
        "completed": finished,
        "message": None,
    }

    if not finished:
        if substituted:
            response["message"] = (
                "No unseen approved question was available at '%s', so one at '%s' was "
                "served instead." % (next_level, session_row.current_level)
            )
        db.commit()
        return response

    response["result"] = _finalise_adaptive(db, user, session_row, trail)
    response["completed"] = True
    if exhausted:
        response["message"] = (
            "The approved question pool ran out after %d question(s), so the assessment "
            "ended early." % session_row.answered_count
        )
    db.commit()
    return response


@router.get("/adaptive/{session_id}")
def get_adaptive_session(
    session_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "ADMIN"))
):
    """Replayable audit view of one run: every rung with the reason it moved."""
    session_row = db.query(AdaptiveSession).filter(
        AdaptiveSession.id == session_id,
        AdaptiveSession.user_id == user.id,
    ).first()
    if not session_row:
        raise HTTPException(status_code=404, detail="Adaptive session not found for this user.")

    trail = json.loads(session_row.trail_json or "[]")
    return {
        "session_id": session_row.id,
        "status": session_row.status,
        "current_level": session_row.current_level,
        "answered": session_row.answered_count,
        "correct": session_row.correct_count,
        "max_questions": session_row.max_questions,
        "attempt_id": session_row.attempt_id,
        "started_at": session_row.started_at,
        "completed_at": session_row.completed_at,
        "rule": (
            "%d consecutive correct steps the level up, %d consecutive incorrect steps "
            "it down, across %s."
            % (CompetencyEngine.STEP_UP_AFTER, CompetencyEngine.STEP_DOWN_AFTER,
               " -> ".join(CompetencyEngine.LEVELS))
        ),
        "ladder": trail,
    }
