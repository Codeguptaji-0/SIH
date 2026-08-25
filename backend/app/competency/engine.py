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

    @classmethod
    def evaluate_quiz(cls, answers: List[Dict[str, Any]], questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        question_map = {q["id"]: q for q in questions}
        
        # Group performance by competency_id
        competency_stats: Dict[str, Dict[str, Any]] = {}

        total_questions = len(answers)
        total_correct = 0

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

            if is_correct:
                total_correct += 1

            if comp_id not in competency_stats:
                competency_stats[comp_id] = {
                    "competency_id": comp_id,
                    "competency_name": comp_name,
                    "domain": domain,
                    "total": 0,
                    "correct": 0,
                    "missed_questions": []
                }

            competency_stats[comp_id]["total"] += 1
            if is_correct:
                competency_stats[comp_id]["correct"] += 1
            else:
                competency_stats[comp_id]["missed_questions"].append(q["question_text"])

        overall_score = round((total_correct / max(total_questions, 1)) * 100.0, 1)

        competency_results = []
        priority_counter = 1

        for comp_id, stats in competency_stats.items():
            comp_score = round((stats["correct"] / max(stats["total"], 1)) * 100.0, 1)
            
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
            "total_questions": total_questions,
            "correct_answers": total_correct,
            "competency_results": competency_results
        }
