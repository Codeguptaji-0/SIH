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
  7. The selection rule in app/competency/selection.py obeys its stated contract:
     focus, least-covered-first, role-target tie-break.
  8. A simulated 10-question run over the REAL seeded pool concentrates its
     questions instead of spraying them - the defect that let a live run report a
     "65 points below target" critical gap off a single answer. Blind selection is
     simulated alongside it, so the improvement is measured, not asserted.
  9. low_evidence is set exactly when a competency has fewer than
     MIN_EVIDENCE_QUESTIONS answers, so a thin row can never read as a finding.

Usage:  python verify_competency_banding.py
Exit code 0 means every assertion held.
"""

import itertools
import json
import os
import random
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.competency.engine import CompetencyEngine  # noqa: E402
from app.competency.selection import (  # noqa: E402
    TARGET_QUESTIONS_PER_COMPETENCY,
    choose_candidate,
    coverage_of,
    focus_size,
)

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


# The scripted answer pattern: right, right, wrong, wrong, then right to the end.
# Enough to drive the ladder up, down and up again, which is what makes the run a
# fair test of selection - the pool has to hand back questions at three levels.
SCRIPT = [True, True, False, False, True, True, True, True, True, True]


def simulate_run(pool, role_targets, n=10, seed=0, blind=False):
    """
    Mirror of _pick_question() in app/routers/quizzes.py over an in-memory pool.

    Same order of operations: the engine's ladder picks the level, the level filters
    the band, the band is shuffled, and choose_candidate() picks within it. `blind`
    replaces that last step with a uniform random pick - the behaviour this file
    exists to argue against - so the two can be compared on the same seed pool.

    Returns (coverage, substitutions, served_ids).
    """
    rng = random.Random(seed)
    by_level = {}
    for q in pool:
        by_level.setdefault((q["difficulty"] or "medium").lower(), []).append(q)

    served, cover, subs = [], {}, 0
    level, consecutive_correct, consecutive_wrong = CompetencyEngine.DEFAULT_DIFFICULTY, 0, 0
    focus = focus_size(n)

    for i in range(n):
        order = [level] + [lv for lv in CompetencyEngine.LEVELS if lv != level]
        chosen = served_level = None
        for candidate_level in order:
            rows = [
                (q["id"], q["competency_id"])
                for q in by_level.get(candidate_level, [])
                if q["id"] not in served
            ]
            if not rows:
                continue
            rng.shuffle(rows)
            chosen = rng.choice(rows) if blind else choose_candidate(
                rows, cover, role_targets, focus
            )
            served_level = candidate_level
            break
        if chosen is None:
            break
        if served_level != level:
            subs += 1
        served.append(chosen[0])
        cover[chosen[1]] = cover.get(chosen[1], 0) + 1

        correct = SCRIPT[i % len(SCRIPT)]
        consecutive_correct, consecutive_wrong = (
            (consecutive_correct + 1, 0) if correct else (0, consecutive_wrong + 1)
        )
        level, _ = CompetencyEngine.next_difficulty(
            level, consecutive_correct, consecutive_wrong
        )
    return cover, subs, served


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

    # --- 7. the selection rule's own contract -----------------------------
    print("\nSelection rule: %d questions per competency -> a %d-question run focuses on %d"
          % (TARGET_QUESTIONS_PER_COMPETENCY, 10, focus_size(10)))
    check(focus_size(10) == 10 // TARGET_QUESTIONS_PER_COMPETENCY,
          "focus_size divides the run length by the depth target", str(focus_size(10)))
    check(focus_size(1) == 1 and focus_size(0) == 1,
          "focus_size never returns 0, so a very short run still has somewhere to go")
    check(choose_candidate([]) is None, "no candidates returns None rather than raising")
    check(
        choose_candidate([("q1", "a"), ("q2", "b")], {"b": 1}, {"a": 90.0, "b": 40.0}, focus=1)
        == ("q2", "b"),
        "once the focus set is full the rule stays inside it, even against a higher target",
    )
    check(
        choose_candidate([("q1", "a"), ("q2", "b")], {"a": 2, "b": 1}, {}, focus=5)
        == ("q2", "b"),
        "below the focus limit the least-covered competency wins",
    )
    check(
        choose_candidate([("q1", "a"), ("q2", "b")], {}, {"a": 55.0, "b": 80.0}, focus=5)
        == ("q2", "b"),
        "equal coverage is broken toward the higher role target",
    )
    check(
        coverage_of([{"competency_id": "a"}, {"competency_id": "a"}, {}, {"competency_id": "b"}])
        == {"a": 2, "b": 1},
        "coverage is counted off the trail and tolerates a malformed entry",
    )

    # --- 8. depth on the real pool, measured against blind selection -------
    #
    # The defect this answers was found in a PASSING live run, which reported
    # "Databases & SQL for Official Statistics 0.0% vs target 65.0 -> critical_gap
    # (65.0 points short)" off one answer. Selection, not banding, was the cause.
    pool = load_questions(cur)
    focused, subs, served = simulate_run(pool, t_a, n=10, seed=11)
    deep = sum(1 for v in focused.values() if v >= CompetencyEngine.MIN_EVIDENCE_QUESTIONS)

    # Both rules are run over many seeds, because the question is not "can it happen"
    # but "does it happen every time". The shuffle is the only thing that differs.
    def deep_count(seed, blind):
        cover, _, _ = simulate_run(pool, t_a, n=10, seed=seed, blind=blind)
        return sum(1 for v in cover.values() if v >= CompetencyEngine.MIN_EVIDENCE_QUESTIONS)

    TRIALS = 200
    focused_runs = [simulate_run(pool, t_a, n=10, seed=s) for s in range(20)]
    focused_deep = [
        sum(1 for v in c.values() if v >= CompetencyEngine.MIN_EVIDENCE_QUESTIONS)
        for c, _, _ in focused_runs
    ]
    blind_deep = [deep_count(s, True) for s in range(TRIALS)]
    blind_mean = sum(blind_deep) / float(TRIALS)
    matched = sum(1 for b in blind_deep if b >= min(focused_deep))
    print("\n10-question run over the seeded pool:")
    print("  focused: %d competencies, depths %s, %d at >= %d answers, %d substitutions"
          % (len(focused), sorted(focused.values(), reverse=True), deep,
             CompetencyEngine.MIN_EVIDENCE_QUESTIONS, subs))
    print("  focused over 20 shuffles: worst %d, best %d competencies measured deeply"
          % (min(focused_deep), max(focused_deep)))
    print("  blind over %d shuffles: %.1f on average, best %d, and %d run(s) (%.1f%%) reach %d"
          % (TRIALS, blind_mean, max(blind_deep), matched, 100.0 * matched / TRIALS,
             min(focused_deep)))
    check(len(served) == 10, "the run serves its full length without exhausting the pool",
          "%d served" % len(served))
    check(len(served) == len(set(served)), "no question is served twice in a run")
    check(all(s == 0 for _, s, _ in focused_runs),
          "difficulty is never substituted, so the ladder still means something")
    check(all(d >= focus_size(10) for d in focused_deep),
          "EVERY focused run measures at least focus_size competencies on >= %d answers"
          % CompetencyEngine.MIN_EVIDENCE_QUESTIONS,
          "worst of 20 shuffles: %d" % min(focused_deep))
    check(min(focused_deep) > blind_mean,
          "even the rule's worst run beats blind selection's average",
          "%d vs %.1f" % (min(focused_deep), blind_mean))
    # Blind selection can get lucky - it is not that it never reaches this depth, it
    # is that it reaches it rarely and by chance, while the rule reaches it always.
    # Overclaiming "never" here failed this very assertion, which is the point of it.
    check(matched <= TRIALS // 20,
          "blind selection reaches that depth in at most 5% of runs, by luck rather than rule",
          "%d of %d" % (matched, TRIALS))

    # --- 9. thin rows are disclosed, not hidden ----------------------------
    served_pool = [q for q in pool if q["id"] in set(served)]
    run_answers = [
        {"question_id": q["id"],
         "selected_option": q["correct_option"] if i % 2 == 0 else (q["correct_option"] + 1) % 4}
        for i, q in enumerate(served_pool)
    ]
    run_res = CompetencyEngine.evaluate_quiz(run_answers, served_pool, role_targets=t_a,
                                             job_role=ROLE_A)
    run_rows = run_res["competency_results"]
    check(
        all(r["low_evidence"] == (r["questions_answered"] < CompetencyEngine.MIN_EVIDENCE_QUESTIONS)
            for r in run_rows),
        "low_evidence is set exactly when a competency is under the evidence floor",
    )
    check(
        run_res["low_evidence_competencies"] == sum(1 for r in run_rows if r["low_evidence"]),
        "the summary count agrees with the rows",
        "%d" % run_res["low_evidence_competencies"],
    )
    check(
        all(("indication rather than a measurement" in r["evidence"]) == r["low_evidence"]
            for r in run_rows),
        "a thin row says so in words, so no UI can present it as a finding",
    )
    check(run_res["competencies_measured"] == len(run_rows),
          "competencies_measured matches the rows returned", "%d" % len(run_rows))
    print("  banded: %s" % ", ".join(
        "%s %.0f%%/%d ans%s" % (r["competency_name"][:26], r["score"], r["questions_answered"],
                                " (low evidence)" if r["low_evidence"] else "")
        for r in sorted(run_rows, key=lambda x: -x["questions_answered"])))

    print()
    if failures:
        print("FAILED %d assertion(s): %s" % (len(failures), "; ".join(failures)))
        return 1
    print("ALL COMPETENCY BANDING ASSERTIONS PASSED (%d questions, %d competencies, 2 job roles, "
          "selection depth measured against blind selection)." % (n_q, n_comp))
    return 0


if __name__ == "__main__":
    sys.exit(main())
