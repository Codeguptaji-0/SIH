from typing import List, Dict, Any, Optional

class CompetencyEngine:
    """
    Evaluates quiz responses against standard MoSPI competency frameworks.
    Score thresholds:
    - 80% to 100%: Strong
    - 60% to 79%:  Needs Improvement
    - 0% to 59%:   Critical Gap
    """
    STRONG_THRESHOLD = 80.0
    NEEDS_IMPROVEMENT_THRESHOLD = 60.0

    # Difficulty-weighted scoring. A hard question answered correctly is worth more
    # than an easy one, so two officers with the same raw count are not reported as
    # equally competent. Weights are fixed and documented rather than learned, which
    # keeps every score reproducible and explainable in an audit.
    DIFFICULTY_WEIGHTS = {"easy": 0.7, "medium": 1.0, "hard": 1.4}
    DEFAULT_DIFFICULTY = "medium"

    # Adaptive ladder thresholds.
    LEVELS = ["easy", "medium", "hard"]
    STEP_UP_AFTER = 2    # consecutive correct answers before difficulty increases
    STEP_DOWN_AFTER = 2  # consecutive wrong answers before difficulty decreases

    # Role-relative banding.
    #
    # A gap is a shortfall against what the officer's ROLE requires, not against one
    # global pass mark. 62% in Survey Design & Sampling is a real gap for a field
    # survey coordinator running an NSS round (role target 80) and adequate for an
    # establishment officer who never touches sample design (role target 35). Judged
    # by STRONG_THRESHOLD alone both officers read identically, which is what turns
    # "competency gap detection" into "low score detection".
    #
    # At or above the role target is strong; within NEAR_TARGET_RATIO of it is a
    # moderate shortfall; below that is a critical gap. When the role declares no
    # target for a competency the absolute thresholds above still apply, so a missing
    # row degrades the reading instead of breaking it, and the response says which
    # yardstick was used for every row.
    NEAR_TARGET_RATIO = 0.8

    @classmethod
    def weight_for(cls, difficulty) -> float:
        return cls.DIFFICULTY_WEIGHTS.get(
            (difficulty or cls.DEFAULT_DIFFICULTY).lower(),
            cls.DIFFICULTY_WEIGHTS[cls.DEFAULT_DIFFICULTY],
        )

    @classmethod
    def next_difficulty(cls, current_level, consecutive_correct: int, consecutive_wrong: int):
        """
        Decide the difficulty of the next question.

        Rule-based on purpose: two consecutive correct answers step the level up, two
        consecutive wrong answers step it down, anything else holds. Deterministic, so
        the same answer sequence always produces the same ladder and the decision can
        be replayed for any attempt.

        Returns (next_level, reason).
        """
        level = (current_level or cls.DEFAULT_DIFFICULTY).lower()
        if level not in cls.LEVELS:
            level = cls.DEFAULT_DIFFICULTY
        idx = cls.LEVELS.index(level)

        if consecutive_correct >= cls.STEP_UP_AFTER and idx < len(cls.LEVELS) - 1:
            return cls.LEVELS[idx + 1], (
                "%d consecutive correct at '%s' - stepping up." % (consecutive_correct, level)
            )
        if consecutive_wrong >= cls.STEP_DOWN_AFTER and idx > 0:
            return cls.LEVELS[idx - 1], (
                "%d consecutive incorrect at '%s' - stepping down." % (consecutive_wrong, level)
            )
        if consecutive_correct >= cls.STEP_UP_AFTER:
            return level, "Already at the hardest level - holding at '%s'." % level
        if consecutive_wrong >= cls.STEP_DOWN_AFTER:
            return level, "Already at the easiest level - holding at '%s'." % level
        return level, "Holding at '%s'." % level

    @classmethod
    def evaluate_quiz(
        cls,
        answers: List[Dict[str, Any]],
        questions: List[Dict[str, Any]],
        role_targets: Optional[Dict[str, float]] = None,
        job_role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Score one submission and band every competency touched by it.

        role_targets maps competency_id -> expected score for the officer's job role.
        Pass it and each competency is judged against its own target; omit it and the
        absolute thresholds apply. Every returned row names its own benchmark, so a
        mixed result (some competencies with targets, some without) stays readable.

        Also returns answer_review: one entry per answered question carrying the
        correct option and the stored explanation. The adaptive path already revealed
        these one question at a time; the fixed-length path collected them and threw
        them away, so an officer was told a score and never told what was wrong.
        """
        question_map = {q["id"]: q for q in questions}
        role_targets = {k: float(v) for k, v in (role_targets or {}).items()}
        role_label = (job_role or "").strip()

        # Group performance by competency_id
        competency_stats: Dict[str, Dict[str, Any]] = {}
        answer_review: List[Dict[str, Any]] = []

        total_questions = len(answers)
        total_correct = 0
        total_weight = 0.0
        correct_weight = 0.0

        for ans in answers:
            qid = ans["question_id"]
            selected = ans["selected_option"]
            
            if qid not in question_map:
                continue

            q = question_map[qid]
            comp_id = q["competency_id"]
            comp_name = q.get("competency_name", "Statistical Methods")
            domain = q.get("domain", "Statistical Competencies")
            is_correct = (selected == q["correct_option"])
            weight = cls.weight_for(q.get("difficulty"))

            total_weight += weight
            if is_correct:
                total_correct += 1
                correct_weight += weight

            if comp_id not in competency_stats:
                competency_stats[comp_id] = {
                    "competency_id": comp_id,
                    "competency_name": comp_name,
                    "domain": domain,
                    "total": 0,
                    "correct": 0,
                    "weight_total": 0.0,
                    "weight_correct": 0.0,
                    "missed_questions": []
                }

            competency_stats[comp_id]["total"] += 1
            competency_stats[comp_id]["weight_total"] += weight
            if is_correct:
                competency_stats[comp_id]["correct"] += 1
                competency_stats[comp_id]["weight_correct"] += weight
            else:
                competency_stats[comp_id]["missed_questions"].append(q["question_text"])

            options = q.get("options") or []
            answer_review.append({
                "question_id": qid,
                "question_text": q["question_text"],
                "competency_id": comp_id,
                "competency_name": comp_name,
                "difficulty": (q.get("difficulty") or cls.DEFAULT_DIFFICULTY).lower(),
                "options": options,
                "selected_option": selected,
                "selected_text": options[selected] if isinstance(selected, int) and 0 <= selected < len(options) else None,
                "correct_option": q["correct_option"],
                "correct_text": options[q["correct_option"]] if 0 <= q["correct_option"] < len(options) else None,
                "is_correct": is_correct,
                "explanation": q.get("explanation") or "",
                "weight": weight,
            })

        # Difficulty-weighted, so the README's "dynamic difficulty weighting" is now
        # something the code actually does.
        overall_score = round((correct_weight / total_weight) * 100.0, 1) if total_weight else 0.0
        raw_score = round((total_correct / max(total_questions, 1)) * 100.0, 1)

        competency_results = []

        for comp_id, stats in competency_stats.items():
            comp_score = (
                round((stats["weight_correct"] / stats["weight_total"]) * 100.0, 1)
                if stats["weight_total"] else 0.0
            )
            answered = "%d of %d questions" % (stats["correct"], stats["total"])
            missed = stats["missed_questions"][0] if stats["missed_questions"] else None
            detail = (" Missed, for example: '%s'." % missed) if missed else ""
            target = role_targets.get(comp_id)

            if target is not None:
                benchmark = "role_target"
                shortfall = round(max(target - comp_score, 0.0), 1)
                article = "an" if role_label[:1].lower() in "aeiou" else "a"
                against = (
                    "the %.0f%% expected of %s %s" % (target, article, role_label) if role_label
                    else "the %.0f%% this role expects" % target
                )
                if comp_score >= target:
                    status = "strong"
                    evidence = (
                        "Scored %.1f%% in %s (%s correct), meeting %s."
                        % (comp_score, stats["competency_name"], answered, against)
                    )
                elif comp_score >= target * cls.NEAR_TARGET_RATIO:
                    status = "needs_improvement"
                    evidence = (
                        "Scored %.1f%% in %s (%s correct), %.1f points below %s."
                        % (comp_score, stats["competency_name"], answered, shortfall, against)
                    )
                else:
                    status = "critical_gap"
                    evidence = (
                        "Critical gap against role requirement: scored %.1f%% in %s (%s correct), "
                        "%.1f points below %s.%s"
                        % (comp_score, stats["competency_name"], answered, shortfall, against, detail)
                    )
            else:
                benchmark = "absolute"
                shortfall = round(max(cls.STRONG_THRESHOLD - comp_score, 0.0), 1)
                basis = (
                    " No proficiency target is defined for this job role, so the standard "
                    "%.0f%% / %.0f%% thresholds were applied."
                    % (cls.STRONG_THRESHOLD, cls.NEEDS_IMPROVEMENT_THRESHOLD)
                )
                if comp_score >= cls.STRONG_THRESHOLD:
                    status = "strong"
                    evidence = (
                        "Demonstrated high proficiency answering %s correctly in %s.%s"
                        % (answered, stats["competency_name"], basis)
                    )
                elif comp_score >= cls.NEEDS_IMPROVEMENT_THRESHOLD:
                    status = "needs_improvement"
                    evidence = (
                        "Answered %s correctly. Moderate knowledge gap identified.%s" % (answered, basis)
                    )
                else:
                    status = "critical_gap"
                    evidence = (
                        "Critical skill gap detected: only %s answered correctly.%s%s"
                        % (answered, detail, basis)
                    )

            competency_results.append({
                "competency_id": comp_id,
                "competency_name": stats["competency_name"],
                "domain": stats["domain"],
                "score": comp_score,
                "status": status,
                "benchmark": benchmark,
                "target_score": target,
                "gap_points": shortfall,
                "priority": 0,
                "evidence": evidence
            })

        # Priority is now ordered by the SIZE of the shortfall inside each band, not by
        # dictionary order. Two critical gaps are not equally urgent: 30 points below the
        # role target should outrank 5 points below it, and RecommendationGenerator sorts
        # on this field to decide which course an officer is pointed at first.
        # 0 = strong, 1..n = critical gaps, n+6.. = moderate gaps, so the existing
        # contract (critical always ahead of moderate) is preserved.
        criticals = sorted(
            [r for r in competency_results if r["status"] == "critical_gap"],
            key=lambda r: (-r["gap_points"], r["score"], r["competency_name"]),
        )
        moderates = sorted(
            [r for r in competency_results if r["status"] == "needs_improvement"],
            key=lambda r: (-r["gap_points"], r["score"], r["competency_name"]),
        )
        for i, row in enumerate(criticals):
            row["priority"] = i + 1
        for i, row in enumerate(moderates):
            row["priority"] = len(criticals) + 6 + i

        return {
            "overall_score": overall_score,
            "raw_score": raw_score,
            "scoring_method": "difficulty-weighted (easy 0.7, medium 1.0, hard 1.4)",
            "total_questions": total_questions,
            "correct_answers": total_correct,
            "job_role": role_label or None,
            "role_targets_applied": sum(
                1 for r in competency_results if r["benchmark"] == "role_target"
            ),
            "banding_method": (
                "role-relative where a target exists, otherwise absolute thresholds "
                "(strong >= %.0f%%, needs improvement >= %.0f%%)"
                % (cls.STRONG_THRESHOLD, cls.NEEDS_IMPROVEMENT_THRESHOLD)
            ),
            "competency_results": competency_results,
            "answer_review": answer_review,
        }
