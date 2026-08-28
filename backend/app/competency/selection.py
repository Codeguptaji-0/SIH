"""
Which question to ask next, expressed as pure functions.

This lived inside app/routers/quizzes.py, where it could only be exercised by
starting a server. It is the rule that decides what a gap report is allowed to
claim, so it belongs somewhere it can be asserted directly - no FastAPI, no
SQLAlchemy, no HTTP. The router does the querying and calls in here to choose.

The problem it solves: selection used to be "any unseen approved question in this
difficulty band, at random". With 24 seeded competencies and a 10-question run
that spread one question across ten competencies, so every per-competency score
could only be 0% or 100%, and a "critical gap, 65 points below the role target"
verdict rested on one answer. Depth is the constraint, not breadth.
"""

from typing import Dict, List, Optional, Tuple

# Answers per competency a run should aim for before it moves on. Three across
# easy/medium/hard gives 0 / 33 / 67 / 100 instead of a coin flip, and probes the
# competency at more than one level.
TARGET_QUESTIONS_PER_COMPETENCY = 3


def focus_size(max_questions: int) -> int:
    """
    How many competencies a run of this length can honestly band.

    A 10-question run can say something defensible about three competencies or
    nothing defensible about ten. Never returns 0, so a very short run still has
    somewhere to put its questions.
    """
    try:
        n = int(max_questions)
    except (TypeError, ValueError):
        n = 0
    return max(1, n // TARGET_QUESTIONS_PER_COMPETENCY)


def choose_candidate(
    candidates: List[Tuple[str, str]],
    cover_counts: Optional[Dict[str, int]] = None,
    role_targets: Optional[Dict[str, float]] = None,
    focus: int = 3,
):
    """
    Pick the next question from the eligible rows of one difficulty band.

    candidates:   [(question_id, competency_id), ...] - already filtered to unseen
                  and trainer-approved rows at the wanted difficulty.
    cover_counts: {competency_id: answers already given in this run}
    role_targets: {competency_id: target_score} for this officer's job role
    focus:        how many competencies this run should concentrate on

    Deterministic given its inputs - the caller shuffles beforehand if it wants
    equal-ranking rows to vary between runs.

    Rule, in order:
      1. Once the run has started `focus` competencies, stay inside that set. This
         is what buys depth instead of a one-question-per-competency spray.
      2. Prefer the least-covered competency, so the focus set fills evenly.
      3. Break ties toward the highest role target, so a run that cannot cover
         everything spends its questions where the role demands the most.

    Returns the chosen (question_id, competency_id), or None if there is nothing
    to choose from.
    """
    if not candidates:
        return None
    cover_counts = cover_counts or {}
    role_targets = role_targets or {}

    started = {cid for cid, n in cover_counts.items() if n > 0}
    pool = candidates
    if len(started) >= max(1, focus):
        inside = [c for c in candidates if c[1] in started]
        # Relax rather than end the run early: an empty focus set in this band is a
        # pool limitation, not a reason to stop measuring.
        pool = inside or candidates

    return min(
        pool,
        key=lambda c: (
            cover_counts.get(c[1], 0),
            -float(role_targets.get(c[1], 0) or 0),
        ),
    )


def coverage_of(trail: List[dict]) -> Dict[str, int]:
    """
    {competency_id: answers given} read off a run's own trail.

    Derived rather than stored, so it cannot drift out of step with the audit view
    and needs no extra column on adaptive_sessions.
    """
    counts: Dict[str, int] = {}
    for entry in trail or []:
        cid = (entry or {}).get("competency_id")
        if cid:
            counts[cid] = counts.get(cid, 0) + 1
    return counts
