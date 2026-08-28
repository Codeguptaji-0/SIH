"""
MCQ quality gate.

Generated multiple-choice questions are the core deliverable of this system, so a
question that is answerable without reading the source material is worse than no
question at all: it produces a competency score that measures nothing.

A measured run of the previous generator produced five questions that all had
correct_option == 1, shared one identical distractor set, and placed the correct
answer as a verbatim continuation of the question stem. A bot that always picked
option [1] scored 100%. Everything in this module exists to make that impossible.

The checks are deliberately mechanical and deterministic - no model call - so the
same question always gets the same verdict and a rejection can be explained.
"""

from __future__ import annotations

import random
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

MIN_OPTIONS = 4
MIN_STEM_CHARS = 20
MIN_OPTION_CHARS = 2
VALID_DIFFICULTIES = ("easy", "medium", "hard")

# A correct answer sharing a long run of words with the stem means the stem gives the
# answer away. Six words is long enough to allow legitimate shared terminology
# ("Consumer Price Index basket") without allowing a copied clause.
MAX_SHARED_WORD_RUN = 6


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower())


def _words(text: str) -> List[str]:
    return [w for w in _normalise(text).split() if w]


def _longest_shared_run(stem: str, answer: str) -> int:
    """Length, in words, of the longest word sequence common to stem and answer."""
    a, b = _words(stem), _words(answer)
    if not a or not b:
        return 0
    best = 0
    # Classic LCSubstring DP, on words rather than characters.
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best = cur[j]
        prev = cur
    return best


def validate_mcq(item: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Return (is_valid, reason_if_invalid) for one generated question.

    Rejection reasons are returned rather than raised so a batch can be filtered and
    the discard count reported honestly to the caller.
    """
    if not isinstance(item, dict):
        return False, "not a JSON object"

    stem = (item.get("question_text") or "").strip()
    if len(stem) < MIN_STEM_CHARS:
        return False, f"stem shorter than {MIN_STEM_CHARS} characters"

    options = item.get("options")
    if not isinstance(options, list) or len(options) < MIN_OPTIONS:
        return False, f"needs at least {MIN_OPTIONS} options"

    cleaned = [str(o).strip() for o in options]
    if any(len(o) < MIN_OPTION_CHARS for o in cleaned):
        return False, "an option is empty or near-empty"

    lowered = [o.lower() for o in cleaned]
    if len(set(lowered)) != len(lowered):
        return False, "duplicate options"

    idx = item.get("correct_option")
    if not isinstance(idx, int) or isinstance(idx, bool) or not (0 <= idx < len(cleaned)):
        return False, "correct_option is not a valid index into options"

    answer = cleaned[idx]

    # Answer-leak guard: the answer must not be quoted inside the stem, and must not
    # share a long word run with it.
    if len(answer) >= 15 and _normalise(answer) in _normalise(stem):
        return False, "answer text appears verbatim in the stem"
    run = _longest_shared_run(stem, answer)
    if run > MAX_SHARED_WORD_RUN:
        return False, f"answer shares a {run}-word run with the stem"

    # Length-cue guard: if the answer is far longer than every distractor, its length
    # alone identifies it.
    distractors = [o for i, o in enumerate(cleaned) if i != idx]
    if distractors and len(answer) > 2.5 * max(len(d) for d in distractors):
        return False, "answer is conspicuously longer than every distractor"

    difficulty = (item.get("difficulty") or "").lower()
    if difficulty not in VALID_DIFFICULTIES:
        return False, f"difficulty must be one of {VALID_DIFFICULTIES}"

    if not (item.get("explanation") or "").strip():
        return False, "missing explanation"

    return True, None


def filter_mcqs(items: Sequence[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Split a batch into (accepted, rejection_reasons)."""
    accepted: List[Dict[str, Any]] = []
    rejected: List[str] = []
    for i, item in enumerate(items or []):
        ok, reason = validate_mcq(item)
        if ok:
            accepted.append(item)
        else:
            rejected.append(f"#{i + 1}: {reason}")
    return accepted, rejected


def shuffle_options(item: Dict[str, Any], rng: Optional[random.Random] = None) -> Dict[str, Any]:
    """
    Randomise option order and rewrite correct_option to follow the answer.

    Without this, the answer sat at a fixed index and the whole assessment could be
    passed by pattern-matching the position.
    """
    rng = rng or random
    options = list(item.get("options") or [])
    idx = item.get("correct_option")
    if not options or not isinstance(idx, int) or not (0 <= idx < len(options)):
        return item

    answer = options[idx]
    rng.shuffle(options)
    item = dict(item)
    item["options"] = options
    item["correct_option"] = options.index(answer)
    return item


def answer_position_histogram(items: Sequence[Dict[str, Any]]) -> Dict[int, int]:
    """Diagnostic: how often each index holds the answer. Used by the smoke tests."""
    hist: Dict[int, int] = {}
    for item in items or []:
        idx = item.get("correct_option")
        if isinstance(idx, int):
            hist[idx] = hist.get(idx, 0) + 1
    return hist
