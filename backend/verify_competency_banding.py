"""
Offline verification of the seed pool and role-relative competency banding.

Runs with no third-party dependencies and no server: it builds database/schema.sql
and database/seed.sql into an in-memory sqlite database and drives
CompetencyEngine directly. That makes it runnable anywhere, including on a machine
where the backend requirements are not installed.

What it asserts:
  1. The demo database builds, and the seed pool is large enough that the adaptive
     ladder cannot exhaust a difficulty band mid-run.
  2. Answer positions are spread, so "always pick B" is not a winning strategy.
  3. Every options_json row is a valid four-option array with an in-range answer.
  4. role_targets reach the engine keyed correctly by competency_id, exactly as
     _role_context() in app/routers/quizzes.py loads them.
  5. The same answers produce DIFFERENT verdicts for two different job roles -
     which is the whole reason role_targets exists.
  6. answer_review carries the stored explanation and the correct option text for
     every answered question.

Usage:  python verify_competency_banding.py
Exit code 0 means every assertion held.
"""

import itertools
import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.competency.engine import CompetencyEngine  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = os.path.join(REPO, "database", "schema.sql")
SEED = os.path.join(REPO, "database", "seed.sql")

ROLE_A = "Senior Data Analyst & Field Survey Coordinator"
ROLE_B = "Administrative Officer (Establishment)"

# A 20-question adaptive run is the longest the backend allows (MAX_ADAPTIVE_QUESTIONS),
# so every band needs at least this many approved questions for the ladder to move
# freely without substituting a different difficulty.
MIN_PER_BAND = 20

failures = []


def check(condition, label, detail=""):
    status = "[PASS]" if condition else "[FAIL]"
    print("%s %s%s" % (status, label, (" -> %s" % detail) if detail else ""))
    if not condition:
        failures.append(label)


def build():
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    for path in (SCHEMA, SEED):
        with open(path, encoding="utf-8") as fh:
            con.executescript(fh.read())
    return con


def load_questions(cur, where="1=1", params=()):
    rows = cur.execute(
        """SELECT q.id, q.competency_id, c.name, c.domain, q.correct_option,
                  q.question_text, q.difficulty, q.explanation, q.options_json
           FROM questions q JOIN competencies c ON q.competency_id = c.id
           WHERE q.review_status = 'APPROVED' AND %s
           ORDER BY q.id""" % where,
        params,
    ).fetchall()
    return [
        {
            "id": r["id"],
            "competency_id": r["competency_id"],
            "competency_name": r["name"],
            "domain": r["domain"],
            "correct_option": r["correct_option"],
            "question_text": r["question_text"],
            "difficulty": r["difficulty"],
            "explanation": r["explanation"],
            "options": json.loads(r["options_json"]),
        }
        for r in rows
    ]


def targets_for(cur, job_role):
    """Mirror of _role_context() in app/routers/quizzes.py."""
    return {
        r["competency_id"]: r["target_score"]
        for r in cur.execute(
            "SELECT competency_id, target_score FROM role_targets WHERE job_role = ?",
            (job_role,),
        )
    }


def main():
    print("Building %s + %s into sqlite" % (os.path.basename(SCHEMA), os.path.basename(SEED)))
    con = build()
    cur = con.cursor()

    # --- 1. pool size ------------------------------------------------------
    n_comp = cur.execute("SELECT COUNT(*) FROM competencies").fetchone()[0]
    n_q = cur.execute("SELECT COUNT(*) FROM questions WHERE review_status='APPROVED'").fetchone()[0]
    bands = {
        r[0]: r[1]
        for r in cur.execute(
            "SELECT difficulty, COUNT(*) FROM questions WHERE review_status='APPROVED' GROUP BY difficulty"
        )
    }
    print("\nPool: %d competencies, %d approved questions, bands %s" % (n_comp, n_q, bands))
    check(n_comp >= 20, "at least 20 competencies seeded", str(n_comp))
    for level in CompetencyEngine.LEVELS:
        check(
            bands.get(level, 0) >= MIN_PER_BAND,
            "band '%s' holds >= %d approved questions" % (level, MIN_PER_BAND),
            str(bands.get(level, 0)),
        )
    thin = cur.execute(
        """SELECT c.id FROM competencies c
           WHERE (SELECT COUNT(DISTINCT q.difficulty) FROM questions q
                  WHERE q.competency_id = c.id AND q.review_status='APPROVED') < 3"""
    ).fetchall()
    check(not thin, "every competency covers all three difficulty bands",
          "thin: %s" % [r[0] for r in thin] if thin else "24/24")

    # --- 2. answer position spread ----------------------------------------
    spread = {
        r[0]: r[1]
        for r in cur.execute("SELECT correct_option, COUNT(*) FROM questions GROUP BY correct_option")
    }
    worst = max(spread.values()) / float(n_q)
    print("\ncorrect_option spread: %s (most common position = %.0f%% of the pool)" % (spread, worst * 100))
    check(sorted(spread) == [0, 1, 2, 3], "all four answer positions are used", str(sorted(spread)))
    check(worst < 0.35, "no single answer position dominates (< 35%)", "%.0f%%" % (worst * 100))

    # --- 3. option integrity ----------------------------------------------
    bad = []
    for r in cur.execute("SELECT id, options_json, correct_option FROM questions"):
        try:
            opts = json.loads(r[1])
        except ValueError:
            bad.append((r[0], "invalid json"))
            continue
        if not isinstance(opts, list) or len(opts) != 4:
            bad.append((r[0], "not four options"))
        elif len(set(opts)) != 4:
            bad.append((r[0], "duplicate options"))
        elif not 0 <= r[2] < 4:
            bad.append((r[0], "correct_option out of range"))
    check(not bad, "every question is a valid four-option MCQ", str(bad[:3]) if bad else "%d rows" % n_q)

    # --- 4. role targets reach the engine ---------------------------------
    profile = cur.execute(
        "SELECT p.job_role FROM profiles p JOIN users u ON p.user_id = u.id WHERE u.role='OFFICIAL'"
    ).fetchone()
    job_role = profile[0] if profile else None
    t_a = targets_for(cur, job_role or "")
    print("\nDemo officer job_role: %r -> %d role targets" % (job_role, len(t_a)))
    check(job_role == ROLE_A, "demo officer's job_role matches a seeded role", str(job_role))
    check(len(t_a) == n_comp, "the role declares a target for every competency", "%d/%d" % (len(t_a), n_comp))

    sample = load_questions(cur)[:12]
    answers = [
        {
            "question_id": q["id"],
            "selected_option": q["correct_option"] if i % 3 == 0 else (q["correct_option"] + 1) % 4,
        }
        for i, q in enumerate(sample)
    ]
    res = CompetencyEngine.evaluate_quiz(answers, sample, role_targets=t_a, job_role=job_role)
    rows = res["competency_results"]
    check(
        res["role_targets_applied"] == len(rows),
        "every competency in the run was banded against its role target",
        "%d/%d" % (res["role_targets_applied"], len(rows)),
    )
    check(all(r["benchmark"] == "role_target" for r in rows), "each row names role_target as its benchmark")
    check(all(r["target_score"] is not None for r in rows), "each row reports the target it was judged against")
    gaps = [r["gap_points"] for r in sorted(rows, key=lambda x: x["priority"]) if r["priority"]]
    check(gaps == sorted(gaps, reverse=True), "priority is ordered by the size of the shortfall", str(gaps))

    # Fallback: no targets at all must still produce a banded, scored result.
    plain = CompetencyEngine.evaluate_quiz(answers, sample)
    check(plain["role_targets_applied"] == 0, "with no targets, nothing claims a role benchmark")
    check(
        all(r["benchmark"] == "absolute" for r in plain["competency_results"]),
        "with no targets, every row falls back to absolute thresholds",
    )
    check(plain["overall_score"] == res["overall_score"], "the score itself does not depend on the role",
          "%s == %s" % (plain["overall_score"], res["overall_score"]))

    # --- 5. the same score, two roles, different verdicts -----------------
    t_b = targets_for(cur, ROLE_B)
    survey = load_questions(cur, "q.competency_id = ?", ("comp-stat-002",))
    print(
        "\nSurvey Design & Sampling target -> %s: %.0f%% | %s: %.0f%%"
        % (ROLE_A, t_a["comp-stat-002"], ROLE_B, t_b["comp-stat-002"])
    )
    divergent = {}
    for mask in itertools.product([0, 1], repeat=len(survey)):
        ans = [
            {
                "question_id": q["id"],
                "selected_option": q["correct_option"] if m else (q["correct_option"] + 1) % 4,
            }
            for q, m in zip(survey, mask)
        ]
        a = CompetencyEngine.evaluate_quiz(ans, survey, role_targets=t_a, job_role=ROLE_A)["competency_results"][0]
        b = CompetencyEngine.evaluate_quiz(ans, survey, role_targets=t_b, job_role=ROLE_B)["competency_results"][0]
        if a["status"] != b["status"]:
            divergent.setdefault((a["status"], b["status"]), (a["score"], sum(mask)))
    for (sa, sb), (score, correct) in sorted(divergent.items()):
        print(
            "  %5.1f%% (%d/%d correct)  coordinator: %-18s establishment: %s"
            % (score, correct, len(survey), sa, sb)
        )
    check(bool(divergent), "identical answers band differently for two job roles", "%d cases" % len(divergent))

    # --- 6. explanations are returned -------------------------------------
    review = res["answer_review"]
    check(len(review) == len(answers), "one review entry per answered question", "%d" % len(review))
    check(all(a["explanation"] for a in review), "every review entry carries the stored explanation")
    check(all(a["correct_text"] for a in review), "every review entry names the correct option text")
    check(
        all(a["is_correct"] == (a["selected_option"] == a["correct_option"]) for a in review),
        "is_correct agrees with the options it reports",
    )

    print()
    if failures:
        print("FAILED %d assertion(s): %s" % (len(failures), "; ".join(failures)))
        return 1
    print("ALL COMPETENCY BANDING ASSERTIONS PASSED (%d questions, %d competencies, 2 job roles)."
          % (n_q, n_comp))
    return 0


if __name__ == "__main__":
    sys.exit(main())
