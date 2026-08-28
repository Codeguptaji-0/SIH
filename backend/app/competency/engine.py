from typing import List, Dict, Any

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
    def evaluate_quiz(cls, answers: List[Dict[str, Any]], questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        question_map = {q["id"]: q for q in questions}
        
        # Group performance by competency_id
        competency_stats: Dict[str, Dict[str, Any]] = {}

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

        # Difficulty-weighted, so the README's "dynamic difficulty weighting" is now
        # something the code actually does.
        overall_score = round((correct_weight / total_weight) * 100.0, 1) if total_weight else 0.0
        raw_score = round((total_correct / max(total_questions, 1)) * 100.0, 1)

        competency_results = []
        priority_counter = 1

        for comp_id, stats in competency_stats.items():
            comp_score = (
                round((stats["weight_correct"] / stats["weight_total"]) * 100.0, 1)
                if stats["weight_total"] else 0.0
            )
            
            if comp_score >= cls.STRONG_THRESHOLD:
                status = "strong"
                priority = 0
                evidence = f"Demonstrated high proficiency answering {stats['correct']} of {stats['total']} questions correctly in {stats['competency_name']}."
            elif comp_score >= cls.NEEDS_IMPROVEMENT_THRESHOLD:
                status = "needs_improvement"
                priority = priority_counter + 5
                evidence = f"Answered {stats['correct']} of {stats['total']} questions correctly. Moderate knowledge gap identified."
            else:
                status = "critical_gap"
                priority = priority_counter
                priority_counter += 1
                missed_summary = f" (Missed key questions like: '{stats['missed_questions'][0]}')" if stats["missed_questions"] else ""
                evidence = f"Critical skill gap detected: Only {stats['correct']} of {stats['total']} questions answered correctly{missed_summary}."

            competency_results.append({
                "competency_id": comp_id,
                "competency_name": stats["competency_name"],
                "domain": stats["domain"],
                "score": comp_score,
                "status": status,
                "priority": priority,
                "evidence": evidence
            })

        return {
            "overall_score": overall_score,
            "raw_score": raw_score,
            "scoring_method": "difficulty-weighted (easy 0.7, medium 1.0, hard 1.4)",
            "total_questions": total_questions,
            "correct_answers": total_correct,
            "competency_results": competency_results
        }
