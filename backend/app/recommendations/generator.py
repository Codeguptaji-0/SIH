from typing import List, Dict, Any
from app.services.igot_service import IGOTService

class RecommendationGenerator:
    @staticmethod
    async def generate_learning_path(competency_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sorts competency results by priority (Critical Gaps first),
        queries IGOTService catalog for matching courses, and builds personalized roadmap.
        """
        # Sort by priority (ascending, where 1 is highest priority)
        sorted_gaps = sorted(competency_results, key=lambda x: (0 if x["status"] == "critical_gap" else (1 if x["status"] == "needs_improvement" else 2), x.get("priority", 99)))

        learning_path = []
        seen_course_ids = set()

        # Coverage rule: every competency that is not "strong" must appear in the
        # returned path, either with a matched course or with an explicit
        # NO_COURSE_MAPPED marker.
        #
        # The previous version broke out of the loop once the path reached five items.
        # Because courses were appended competency-by-competency, the last gaps were
        # silently dropped - a measured run produced three items for seven gaps, and one
        # critical gap vanished with no trace in the response. Losing a critical gap
        # without saying so is worse than returning a longer list.
        MAX_COURSES_PER_COMPETENCY = 2

        for item in sorted_gaps:
            comp_id = item["competency_id"]
            comp_name = item["competency_name"]
            status = item["status"]

            if status == "strong":
                # Strong areas need no remediation.
                continue

            priority_label = "High" if status == "critical_gap" else "Medium"
            matching_courses = await IGOTService.search_courses(comp_name)

            added_for_this_competency = 0
            for course in matching_courses:
                if added_for_this_competency >= MAX_COURSES_PER_COMPETENCY:
                    break
                if course["course_id"] in seen_course_ids:
                    continue
                seen_course_ids.add(course["course_id"])
                added_for_this_competency += 1
                learning_path.append({
                    "course_id": course["course_id"],
                    "course_title": course["title"],
                    "competency_id": comp_id,
                    "competency_name": comp_name,
                    "provider": course["provider"],
                    "priority": priority_label,
                    "estimated_duration": course["duration"],
                    "status": "ASSIGNED"
                })

            if added_for_this_competency == 0:
                # Visible placeholder. The gap was identified, the catalogue simply has
                # nothing mapped to it yet - which is itself useful information for an
                # administrator deciding what NSSTA should commission.
                learning_path.append({
                    "course_id": None,
                    "course_title": f"No mapped course yet for {comp_name}",
                    "competency_id": comp_id,
                    "competency_name": comp_name,
                    "provider": None,
                    "priority": priority_label,
                    "estimated_duration": None,
                    "status": "NO_COURSE_MAPPED"
                })

        return learning_path
