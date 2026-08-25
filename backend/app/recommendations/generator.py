from typing import List, Dict, Any
from app.services.igot_service import IGOTService

class RecommendationGenerator:
    @staticmethod
    def generate_learning_path(competency_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sorts competency results by priority (Critical Gaps first),
        queries IGOTService catalog for matching courses, and builds personalized roadmap.
        """
        # Sort by priority (ascending, where 1 is highest priority)
        sorted_gaps = sorted(competency_results, key=lambda x: (0 if x["status"] == "critical_gap" else (1 if x["status"] == "needs_improvement" else 2), x.get("priority", 99)))

        learning_path = []
        seen_course_ids = set()

        for item in sorted_gaps:
            comp_id = item["competency_id"]
            comp_name = item["competency_name"]
            status = item["status"]

            # Skip strong areas unless no gaps exist
            if status == "strong" and len(learning_path) >= 3:
                continue

            priority_label = "High" if status == "critical_gap" else ("Medium" if status == "needs_improvement" else "Low")
            matching_courses = IGOTService.search_courses(comp_name)

            for course in matching_courses:
                if course["course_id"] not in seen_course_ids:
                    seen_course_ids.add(course["course_id"])
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
                    if len(learning_path) >= 5:
                        break

        return learning_path
