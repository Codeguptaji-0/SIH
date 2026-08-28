#!/usr/bin/env python3
"""
End-to-end smoke test for the adaptive difficulty ladder (SkillSetu UVP #2), plus
the fixed-length submit path and role-relative competency banding.

Everything about POST /api/quizzes/adaptive/start, .../{id}/answer and
GET /api/quizzes/adaptive/{id} had only ever been verified *statically* -
py_compile, a route-shadowing read, and a pure-engine ladder simulation. No real
HTTP request had ever reached them. This script sends real ones and asserts on
the responses instead of printing them for a human to eyeball.

The trick that makes a deterministic assertion possible: a client cannot know
which option is correct before answering, so this script reads correct_option
straight out of the demo sqlite file and then *chooses* to be right or wrong on
each question. Scripted plan: 2 correct (expect a step UP), then 2 wrong (expect
a step DOWN), then correct for the rest. Because the run is scripted, the
expected ladder is known up front.

Reading the DB is only legitimate because this is a test harness against the
demo database. The API itself never leaks correct_option before an answer.

Sections 7b, 7c and 8 cover what the ladder alone does not: that the role targets
in seed.sql reach both scoring paths over real HTTP, that no per-competency verdict
is passed off as a finding when it rests on a single answer, and that a
fixed-length submission comes back with answer_review so an officer is told what
was wrong rather than only how badly they did. Section 0 refuses to run at all
against a database that predates the seed expansion - see the comment there.

Usage - the backend must already be running:
    python smoke_adaptive.py
    python smoke_adaptive.py --base http://127.0.0.1:8000 --db skillsetu.db

Exit code 0 means every assertion passed. Non-zero prints what failed.
"""

import argparse
import json
import os
import pathlib
import sqlite3
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO_EMAIL = "official@skillsetu.demo"
DEMO_PASSWORD = "SkillSetu@2026"  # seeded demo credential, documented in database/seed.sql
LEVELS = ["easy", "medium", "hard"]

# The longest run the backend allows is MAX_ADAPTIVE_QUESTIONS = 20, so a band with
# at least that many approved questions can never be exhausted mid-run. seed.sql
# ships 24 / 24 / 25; anything below this means the live DB predates the expansion.
MIN_PER_BAND = 20

failures = []
notes = []


def ok(label):
    print("  [PASS] %s" % label)


def check(condition, label, detail=""):
    """Record an assertion instead of raising, so one run reports every problem."""
    if condition:
        ok(label)
    else:
        print("  [FAIL] %s%s" % (label, (" -> " + detail) if detail else ""))
        failures.append(label)
    return bool(condition)


def call(method, url, token=None, body=None):
    """One HTTP round trip. Returns (status_code, parsed_json_or_text)."""
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read().decode("utf-8")
            status = res.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        status = e.code
    except urllib.error.URLError as e:
        print("\nCannot reach %s (%s)." % (url, e.reason))
        print("Start the backend first:  uvicorn app.main:app --reload")
        sys.exit(2)

    try:
        return status, json.loads(raw)
    except ValueError:
        return status, raw


def load_answer_key(db_path):
    """question_id -> (correct_option, option_count, difficulty, review_status)."""
    if not os.path.exists(db_path):
        print("Database not found at %s. Run:  python init_db.py" % db_path)
        sys.exit(2)
    # Read-only via a proper file: URI so Windows paths with spaces and backslashes
    # survive; plain connect as a fallback if the URI form is rejected.
    try:
        uri = pathlib.Path(db_path).absolute().as_uri() + "?mode=ro"
        con = sqlite3.connect(uri, uri=True)
    except (sqlite3.Error, ValueError):
        con = sqlite3.connect(db_path)
    try:
        rows = con.execute(
            "SELECT id, correct_option, options_json, difficulty, review_status FROM questions"
        ).fetchall()
    finally:
        con.close()

    key = {}
    for qid, correct, options_json, difficulty, review_status in rows:
        try:
            count = len(json.loads(options_json))
        except (TypeError, ValueError):
            count = 0
        key[qid] = (correct, count, difficulty, review_status)
    return key


def wrong_option(correct, count):
    """
    A valid-but-incorrect index, without assuming 0-based or 1-based storage.
    correct+1 stays in range for every case except the top option, where we step
    down instead. is_correct in the response is asserted afterwards, so a wrong
    assumption here surfaces as a clear failure rather than a silent pass.
    """
    if count >= 2 and correct + 1 < count:
        return correct + 1
    return correct - 1 if correct - 1 >= 0 else correct + 1


def move_kind(before, after):
    if before not in LEVELS or after not in LEVELS or before == after:
        return "hold"
    return "up" if LEVELS.index(after) > LEVELS.index(before) else "down"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--db", default=os.path.join(HERE, "skillsetu.db"))
    parser.add_argument("--questions", type=int, default=10)
    args = parser.parse_args()
    base = args.base.rstrip("/")

    answer_key = load_answer_key(args.db)
    approved = {q: v for q, v in answer_key.items() if v[3] == "APPROVED"}
    print("Answer key loaded: %d questions, %d APPROVED" % (len(answer_key), len(approved)))
    by_level = {}
    for _, (_, _, difficulty, review_status) in approved.items():
        by_level[difficulty] = by_level.get(difficulty, 0) + 1
    print("Approved pool by difficulty: %s\n" % (by_level or "empty"))

    # ------------------------------------------------------- stale-DB guard
    #
    # This test reads the live sqlite file the server is using. init_db.py cannot
    # rewrite that file while uvicorn holds it open - it fails with
    # "PermissionError: [WinError 32] ... being used by another process" - so it is
    # easy to reseed nothing, restart nothing, and then watch a run that quietly
    # exercises the OLD pool. That happened: a 10-question run against the old
    # 2-easy pool substituted twice and every ladder assertion still passed,
    # because substitution is honest behaviour, just not the behaviour being
    # claimed. Fail loudly instead.
    print("0. Live database is current with database/seed.sql")
    stale = [lv for lv in LEVELS if by_level.get(lv, 0) < MIN_PER_BAND]
    if not check(
        not stale,
        "every difficulty band holds >= %d approved questions" % MIN_PER_BAND,
        "thin bands %s in %s" % ({lv: by_level.get(lv, 0) for lv in stale}, args.db),
    ):
        print("")
        print("  The server is running against a stale database. Reseed it:")
        print("    1. stop uvicorn (Ctrl+C)  - it holds skillsetu.db open")
        print("    2. python init_db.py")
        print("    3. python -m uvicorn app.main:app --reload")
        print("    4. python smoke_adaptive.py")
        print("")
        print("Cannot prove the ladder walks freely on a pool this thin.")
        return 1
    print("")

    # ---------------------------------------------------------------- login
    print("1. POST /api/auth/login")
    status, payload = call("POST", base + "/api/auth/login",
                           body={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    if not check(status == 200, "login returns 200", "HTTP %s %s" % (status, payload)):
        print("\nCannot continue without a token.")
        return 1
    token = (payload or {}).get("access_token")
    check(bool(token), "login returns an access_token")
    check((payload or {}).get("role") == "OFFICIAL", "role is OFFICIAL",
          str((payload or {}).get("role")))
    if not token:
        return 1
    print("  token acquired (length %d, value not printed)\n" % len(token))

    # ------------------------------------------------------- start session
    print("2. POST /api/quizzes/adaptive/start")
    status, start = call("POST", base + "/api/quizzes/adaptive/start", token=token,
                         body={"max_questions": args.questions, "starting_level": "medium"})
    if not check(status == 200, "start returns 200", "HTTP %s %s" % (status, start)):
        return 1

    session_id = start.get("session_id")
    if session_id is None:
        print("  Backend reported no session: %r" % start.get("message"))
        print("  That is the honest empty-pool path, not a crash. Approve questions")
        print("  in the trainer review queue (or re-run init_db.py) and try again.")
        failures.append("start produced a session")
        return 1
    ok("start returns a session_id")
    start_ladder = start.get("ladder") or {}
    substituted_at_start = bool(start_ladder.get("level_substituted"))
    check(start.get("current_level") == "medium" or substituted_at_start,
          "session starts at medium (or reports level_substituted)",
          "level=%s substituted=%s" % (start.get("current_level"), substituted_at_start))
    step_up = start_ladder.get("step_up_after")
    step_down = start_ladder.get("step_down_after")
    check(isinstance(step_up, int) and isinstance(step_down, int),
          "start exposes step_up_after / step_down_after thresholds",
          "up=%r down=%r" % (step_up, step_down))
    question = start.get("question")
    check(isinstance(question, dict) and bool(question.get("id")), "start serves a question")
    check("correct_option" not in (question or {}),
          "served question does NOT leak correct_option")
    check("explanation" not in (question or {}),
          "served question does NOT leak explanation")
    print("  session %s, first question at difficulty %r, thresholds up=%s down=%s\n"
          % (session_id, (question or {}).get("difficulty"), step_up, step_down))

    # ------------------------------------------------------- scripted answers
    # Deliberate plan. The first two right should earn a rung UP, the next two
    # wrong should give it back. Single right / single wrong must NOT move the
    # ladder - that is the streak-reset behaviour, and getting it wrong is how a
    # naive implementation ends up only ever climbing.
    plan = [True, True, False, False] + [True] * max(0, args.questions - 4)
    expected = {2: "up", 4: "down", 1: "hold", 3: "hold"}

    seen_ids = [question["id"]]
    answered = 0
    completed = False
    last_answer = None

    print("3. POST /api/quizzes/adaptive/{session_id}/answer  (scripted run)")
    for turn, intend_correct in enumerate(plan, start=1):
        if question is None or completed:
            break
        qid = question["id"]
        if qid not in answer_key:
            check(False, "served question %s exists in the database" % qid)
            break
        correct, count, _, _ = answer_key[qid]
        choice = correct if intend_correct else wrong_option(correct, count)

        status, res = call("POST",
                           "%s/api/quizzes/adaptive/%s/answer" % (base, session_id),
                           token=token,
                           body={"question_id": qid, "selected_option": choice})
        if not check(status == 200, "Q%d answer returns 200" % turn,
                     "HTTP %s %s" % (status, res)):
            break

        last_answer = res
        answered += 1
        ans = res.get("answered") or {}
        ladder = res.get("ladder") or {}
        before, after = ladder.get("level_before"), ladder.get("level_after")
        kind = move_kind(before, after)
        reason = ladder.get("adaptation_reason") or ""

        print("   Q%-2d intended=%-9s %s -> %s [%s]  %s"
              % (turn, "CORRECT" if intend_correct else "WRONG",
                 before, after, kind, reason))

        check(ans.get("is_correct") is intend_correct,
              "Q%d graded as intended (%s)" % (turn, "correct" if intend_correct else "wrong"),
              "server said is_correct=%r for option %r" % (ans.get("is_correct"), choice))
        check(bool(reason), "Q%d carries a non-empty adaptation_reason" % turn)
        check(ans.get("explanation") not in (None, ""),
              "Q%d reveals the explanation after answering" % turn)

        # The reason string and the reported move must not contradict each other. A
        # live run caught exactly this: a substituted question produced "hard -> easy"
        # captioned "Holding at 'hard'.", which reads as a bug on the officer's screen.
        check(ladder.get("ladder_decision") in LEVELS,
              "Q%d reports the engine's own verdict as ladder_decision" % turn,
              str(ladder.get("ladder_decision")))
        if ladder.get("level_substituted"):
            agrees = "served instead" in reason
        elif kind == "hold":
            agrees = "olding" in reason
        elif kind == "up":
            agrees = "stepping up" in reason
        else:
            agrees = "stepping down" in reason
        check(agrees, "Q%d adaptation_reason agrees with %s -> %s" % (turn, before, after),
              reason)

        want = expected.get(turn)
        if want:
            floor_or_ceiling = (want == "up" and before == "hard") or \
                               (want == "down" and before == "easy")
            check(kind == want or floor_or_ceiling,
                  "Q%d ladder moves %s" % (turn, want.upper()),
                  "got %s (%s -> %s)" % (kind, before, after))

        completed = bool(res.get("completed"))
        question = res.get("question")
        if completed:
            print("   run completed after %d answers" % answered)
            break
        if question is None:
            check(False, "Q%d serves a next question or reports completed" % turn)
            break
        check(question.get("id") not in seen_ids,
              "Q%d next question is one not served before" % turn,
              "repeat of %s" % question.get("id"))
        seen_ids.append(question.get("id"))
        if not ladder.get("level_substituted"):
            check(question.get("difficulty") == after,
                  "Q%d next question matches the new level" % turn,
                  "served %r at level %r" % (question.get("difficulty"), after))
        else:
            notes.append("Q%d fell back to a substitute level - the approved pool at %r was "
                         "exhausted, so %r was served instead. Honest, but it interrupts a "
                         "demo. Seed expansion is the fix."
                         % (turn, ladder.get("ladder_decision"), after))

    print("")

    # -------------------------------------------- pending-question enforcement
    print("4. Replay / wrong-question guard")
    if not completed and question is not None and len(seen_ids) >= 2:
        stale = seen_ids[0]
        status, res = call("POST",
                           "%s/api/quizzes/adaptive/%s/answer" % (base, session_id),
                           token=token,
                           body={"question_id": stale, "selected_option": 0})
        check(status == 400, "answering a non-pending question is rejected with 400",
              "HTTP %s %s" % (status, res))
    else:
        print("  skipped (run already finished)")
    print("")

    # ------------------------------------------------------------- audit view
    print("5. GET /api/quizzes/adaptive/{session_id}")
    status, audit = call("GET", "%s/api/quizzes/adaptive/%s" % (base, session_id), token=token)
    if check(status == 200, "audit view returns 200", "HTTP %s %s" % (status, audit)):
        trail = audit.get("ladder") or []
        check(isinstance(trail, list) and len(trail) == answered,
              "audit trail has one entry per answer (%d)" % answered,
              "trail length %s" % (len(trail) if isinstance(trail, list) else type(trail)))
        check(bool(audit.get("rule")), "audit view states the ladder rule in words")
        if isinstance(trail, list) and trail:
            need = ("question_id", "is_correct", "level_before", "level_after",
                    "adaptation_reason", "weight")
            missing = [k for k in need if k not in trail[0]]
            check(not missing, "trail entries carry the full audit fields",
                  "missing %s" % missing)
        check(audit.get("answered") == answered, "audit answered count matches",
              "%r vs %d" % (audit.get("answered"), answered))
        if completed:
            check(audit.get("status") == "COMPLETED", "session status is COMPLETED",
                  str(audit.get("status")))
            check(bool(audit.get("attempt_id")),
                  "completion wrote a QuizAttempt (attempt_id present)")
    print("")

    # ------------------------------------------------- ownership (IDOR) check
    print("6. Ownership - another account must not read this session")
    status, other = call("POST", base + "/api/auth/login",
                         body={"email": "admin@skillsetu.demo", "password": DEMO_PASSWORD})
    other_token = (other or {}).get("access_token") if status == 200 else None
    if other_token:
        status, res = call("GET", "%s/api/quizzes/adaptive/%s" % (base, session_id),
                           token=other_token)
        check(status == 404, "a different user gets 404, not the officer's session",
              "HTTP %s %s" % (status, res))
    else:
        print("  skipped (could not log in as the admin demo account)")
    print("")

    # ------------------------------------------------------------ final score
    if completed and last_answer:
        result = last_answer.get("result") or {}
        print("7. Final scoring")
        check("overall_score" in result, "result carries overall_score")
        check("raw_score" in result, "result carries raw_score alongside the weighted score")
        check(result.get("scoring_method") not in (None, ""),
              "result names its scoring_method", str(result.get("scoring_method")))
        check(result.get("final_level") in LEVELS, "result carries final_level",
              str(result.get("final_level")))
        print("  overall=%s raw=%s method=%r final_level=%s correct=%s/%s"
              % (result.get("overall_score"), result.get("raw_score"),
                 result.get("scoring_method"), result.get("final_level"),
                 result.get("correct_answers"), result.get("total_questions")))
        print("")

        # ------------------------------------------- role-relative banding
        #
        # The engine reads role_targets now, and the adaptive summary returns
        # evaluate_quiz() wholesale, so the adaptive path must inherit the role
        # banding too. Asserted here because the offline harness proves the
        # engine and the seed, not that this endpoint actually passes them.
        print("7b. Role-relative banding reached the adaptive summary")
        check(result.get("job_role") not in (None, ""),
              "summary names the officer's job_role", str(result.get("job_role")))
        check(result.get("banding_method") not in (None, ""),
              "summary names the banding_method it used")
        rows = result.get("results") or result.get("competency_results") or []
        check(bool(rows), "summary carries per-competency rows", "%d rows" % len(rows))
        applied = result.get("role_targets_applied")
        check(isinstance(applied, int) and applied > 0,
              "at least one competency was banded against a role target",
              "role_targets_applied=%r of %d rows" % (applied, len(rows)))
        if rows:
            check(all(r.get("benchmark") in ("role_target", "absolute") for r in rows),
                  "every row names the yardstick it was judged by")
            targeted = [r for r in rows if r.get("benchmark") == "role_target"]
            check(all(r.get("target_score") is not None for r in targeted),
                  "every role-banded row reports the target it was judged against")
            check(all(isinstance(r.get("gap_points"), (int, float)) for r in rows),
                  "every row quantifies its shortfall in points")
            worst = sorted(
                [r for r in rows if r.get("priority")],
                key=lambda r: r.get("priority"),
            )
            if worst:
                top = worst[0]
                print("  top priority: %s %.1f%% vs target %s -> %s (%.1f points short)"
                      % (top.get("competency_name"), top.get("score") or 0.0,
                         top.get("target_score"), top.get("status"),
                         top.get("gap_points") or 0.0))
        print("")

        # ------------------------------------------- depth of evidence
        #
        # This section exists because of one line section 7b printed while every
        # other assertion in the run passed:
        #
        #   top priority: Databases & SQL for Official Statistics 0.0% vs target
        #   65.0 -> critical_gap (65.0 points short)
        #
        # A 65-point critical-gap verdict off a *single* answer. With 24 seeded
        # competencies and a 10-question run, blind selection hands each competency
        # about one question, and a competency scored on one answer can only ever
        # read 0% or 100% - a coin flip wearing a gap report's clothes.
        # app/competency/selection.py now concentrates a run on roughly
        # max_questions / 3 competencies and engine.py flags whatever is still
        # thin. verify_competency_banding.py proves both offline; this proves the
        # live endpoint actually inherits them.
        print("7c. Depth of evidence: no verdict rests on a single answer")
        MIN_EVIDENCE = 2        # app/competency/engine.py: MIN_EVIDENCE_QUESTIONS
        PER_COMPETENCY = 3      # selection.py: TARGET_QUESTIONS_PER_COMPETENCY
        measured = result.get("competencies_measured")
        thin = result.get("low_evidence_competencies")
        check(isinstance(measured, int) and measured > 0,
              "summary counts how many competencies it actually measured",
              "competencies_measured=%r" % measured)
        check(isinstance(thin, int),
              "summary counts how many of those rest on thin evidence",
              "low_evidence_competencies=%r" % thin)
        check(bool(result.get("evidence_rule")),
              "summary states the evidence rule in words",
              str(result.get("evidence_rule")))
        if rows:
            check(all(isinstance(r.get("questions_answered"), int)
                      and r.get("questions_answered") > 0 for r in rows),
                  "every row says how many answers it is based on")
            counted = sum(r.get("questions_answered") or 0 for r in rows)
            check(counted == answered,
                  "the rows account for every answer given",
                  "%d across rows vs %d answered" % (counted, answered))
            check(thin == sum(1 for r in rows if r.get("low_evidence")),
                  "the thin-evidence count matches the flagged rows")
            check(all(bool(r.get("low_evidence"))
                      == ((r.get("questions_answered") or 0) < MIN_EVIDENCE)
                      for r in rows),
                  "a row is flagged low_evidence exactly when it is below the rule")
            # The discriminator: blind selection over this pool spreads 10 answers
            # across ~9 competencies, the rule keeps it near 10/3.
            check(measured <= max(2, answered // MIN_EVIDENCE),
                  "selection concentrated the run instead of spreading it thin",
                  "%d competencies over %d answers" % (measured, answered))
            deep = [r for r in rows
                    if (r.get("questions_answered") or 0) >= MIN_EVIDENCE]
            check(len(deep) >= max(1, answered // PER_COMPETENCY),
                  "at least max_questions/%d competencies were measured on >= %d "
                  "answers each" % (PER_COMPETENCY, MIN_EVIDENCE),
                  "%d of %d rows" % (len(deep), len(rows)))
            if worst:
                # The specific regression: the loudest verdict in the report must
                # either stand on real evidence or admit in the payload that it
                # does not. Silent single-answer verdicts are what broke trust.
                depth = top.get("questions_answered") or 0
                check(depth >= MIN_EVIDENCE or bool(top.get("low_evidence")),
                      "the top-priority verdict rests on >= %d answers, or is "
                      "flagged low_evidence" % MIN_EVIDENCE,
                      "%s: %d answer(s), low_evidence=%r"
                      % (top.get("competency_name"), depth,
                         top.get("low_evidence")))
            print("  depths: %s"
                  % ", ".join("%s %d/%d%s"
                              % ((r.get("competency_name") or "?")[:26],
                                 r.get("questions_correct") or 0,
                                 r.get("questions_answered") or 0,
                                 " LOW" if r.get("low_evidence") else "")
                              for r in rows))
            print("  %d competencies over %d answers, %d thin, %d deep"
                  % (measured, answered, thin, len(deep)))
        print("")

    # ------------------------------------------- fixed-length submit + review
    #
    # The adaptive path revealed the explanation one question at a time; the
    # fixed-length path collected explanations and threw them away, so an officer
    # got a score and never learned what was wrong. answer_review closed that,
    # and the quiz review screen renders it - which means it has to exist over
    # real HTTP, not only in the engine's return value.
    print("8. POST /api/quizzes/{quiz_id}/submit  (fixed-length path + answer_review)")
    status, active = call("GET", base + "/api/quizzes/active", token=token)
    if check(status == 200, "active quiz returns 200", "HTTP %s %s" % (status, active)):
        quiz_id = (active or {}).get("quiz_id")
        served = (active or {}).get("questions") or []
        check(bool(served), "active quiz serves questions",
              "%d served, approved_pool_size=%s"
              % (len(served), (active or {}).get("approved_pool_size")))
        check(all("correct_option" not in q for q in served),
              "the fixed-length payload does NOT leak correct_option")
        check(all("explanation" not in q for q in served),
              "the fixed-length payload does NOT leak explanation before answering")
        if served and quiz_id:
            # Deliberately mixed: every third answer correct, the rest wrong, so the
            # review has both kinds of entry and the banding has a real shortfall.
            body = {"answers": []}
            intended = {}
            for i, q in enumerate(served):
                key = answer_key.get(q["id"])
                if not key:
                    continue
                correct, count = key[0], key[1]
                pick = correct if i % 3 == 0 else wrong_option(correct, count)
                intended[q["id"]] = (pick == correct)
                body["answers"].append({"question_id": q["id"], "selected_option": pick})
            status, sub = call("POST", "%s/api/quizzes/%s/submit"
                              % (base, quiz_id), token=token, body=body)
            if check(status == 200, "submit returns 200", "HTTP %s %s" % (status, sub)):
                review = (sub or {}).get("answer_review") or []
                check(len(review) == len(body["answers"]),
                      "answer_review has one entry per submitted answer",
                      "%d vs %d" % (len(review), len(body["answers"])))
                check(all(a.get("explanation") for a in review),
                      "every review entry carries the stored explanation")
                check(all(a.get("correct_text") for a in review),
                      "every review entry names the correct option text")
                check(all(a.get("is_correct") == intended.get(a.get("question_id"))
                          for a in review),
                      "the server graded every answer the way this script intended")
                check((sub or {}).get("banding_method") not in (None, ""),
                      "submit names the banding_method it used")
                check(isinstance((sub or {}).get("role_targets_applied"), int)
                      and (sub or {}).get("role_targets_applied") > 0,
                      "submit banded against role targets",
                      "role_targets_applied=%r" % (sub or {}).get("role_targets_applied"))
                check((sub or {}).get("raw_score") is not None,
                      "submit reports raw_score alongside the weighted score")
                # /api/quizzes/active ranks by the same focus_size() rule, so the
                # fixed-length report has to be as deep as the adaptive one. If
                # this fails while 7c passes, the two paths have drifted apart.
                sub_rows = (sub or {}).get("results") \
                    or (sub or {}).get("competency_results") or []
                sub_deep = [r for r in sub_rows
                            if (r.get("questions_answered") or 0) >= 2]
                check(bool(sub_rows) and len(sub_deep) >= 1,
                      "the fixed-length report also measures competencies in depth",
                      "%d of %d rows on >= 2 answers, evidence_rule=%r"
                      % (len(sub_deep), len(sub_rows),
                         bool((sub or {}).get("evidence_rule"))))
                wrong_entries = [a for a in review if not a.get("is_correct")]
                print("  scored %s%% (raw %s%%) over %s answers, %d wrong, job_role=%r"
                      % ((sub or {}).get("overall_score"), (sub or {}).get("raw_score"),
                         (sub or {}).get("total_questions"), len(wrong_entries),
                         (sub or {}).get("job_role")))
                if wrong_entries:
                    w = wrong_entries[0]
                    print("  example review entry -> picked %r, correct %r"
                          % (w.get("selected_text"), w.get("correct_text")))
                    print("    why: %s" % (w.get("explanation") or "")[:140])
    print("")

    # ----------------------------------------------------------------- report
    for note in notes:
        print("NOTE: %s" % note)
    if failures:
        print("\n%d ASSERTION(S) FAILED:" % len(failures))
        for f in failures:
            print("  - %s" % f)
        return 1
    print("\nALL SMOKE ASSERTIONS PASSED: adaptive ladder (%d answers), role-relative "
          "banding, depth of evidence and fixed-length answer_review, all over "
          "real HTTP." % answered)
    return 0


if __name__ == "__main__":
    sys.exit(main())
