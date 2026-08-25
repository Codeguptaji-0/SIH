from typing import List, Dict, Any

class IGOTService:
    """
    Simulated iGOT Karmayogi & NSSTA TPAC Integration Abstraction Layer.
    Provides course catalog lookup and learning material references.
    """
    MOCK_CATALOG = [
        {
            "course_id": "NSSTA-TPAC-STAT-101",
            "title": "Advanced Survey Sampling & Weight Calibration",
            "competency_keyword": "sampling",
            "provider": "NSSTA TPAC",
            "duration": "4 hours",
            "url": "https://nssta.gov.in/courses/stat-101"
        },
        {
            "course_id": "IGOT-STAT-204",
            "title": "Statistical Inference & Hypothesis Testing in Practice",
            "competency_keyword": "statistical",
            "provider": "iGOT Karmayogi",
            "duration": "3 hours",
            "url": "https://igotkarmayogi.gov.in/courses/igot-stat-204"
        },
        {
            "course_id": "IGOT-ECON-102",
            "title": "National Accounts Statistics & Inflation Metrics",
            "competency_keyword": "national accounts",
            "provider": "iGOT Karmayogi",
            "duration": "2.5 hours",
            "url": "https://igotkarmayogi.gov.in/courses/igot-econ-102"
        },
        {
            "course_id": "NSSTA-TECH-301",
            "title": "SDMX Metadata Standards & Open Data Publishing",
            "competency_keyword": "official statistics",
            "provider": "NSSTA TPAC",
            "duration": "2 hours",
            "url": "https://nssta.gov.in/courses/tech-301"
        },
        {
            "course_id": "IGOT-PYTHON-501",
            "title": "Automated Statistical Computing with Python & Pandas",
            "competency_keyword": "python",
            "provider": "iGOT Karmayogi",
            "duration": "5 hours",
            "url": "https://igotkarmayogi.gov.in/courses/igot-python-501"
        },
        {
            "course_id": "IGOT-GOV-402",
            "title": "Digital Personal Data Protection (DPDP) Guidelines for Officials",
            "competency_keyword": "privacy",
            "provider": "iGOT Karmayogi",
            "duration": "1.5 hours",
            "url": "https://igotkarmayogi.gov.in/courses/igot-gov-402"
        }
    ]

    @classmethod
    def search_courses(cls, competency_name: str) -> List[Dict[str, Any]]:
        query = competency_name.lower()
        results = []
        for course in cls.MOCK_CATALOG:
            if course["competency_keyword"] in query or query in course["title"].lower():
                results.append(course)
        
        # Fallback if no direct keyword match
        if not results:
            results.append(cls.MOCK_CATALOG[0])
            results.append(cls.MOCK_CATALOG[1])

        return results

    @classmethod
    def get_all_courses(cls) -> List[Dict[str, Any]]:
        return cls.MOCK_CATALOG
