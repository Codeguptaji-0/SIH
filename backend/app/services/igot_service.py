import asyncio
import random
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings

logger = logging.getLogger("IGOTService")

class IGOTService:
    """
    Production-Grade iGOT Karmayogi & NSSTA TPAC Ecosystem Integration Adapter.
    
    Adapter Pattern: Swap in real iGOT Karmayogi API credentials via IGOT_API_KEY and IGOT_BASE_URL
    environment variables in config/env — no other code changes needed.
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
    async def _call_external_api(cls, endpoint: str, params: dict) -> List[Dict[str, Any]]:
        api_key = getattr(settings, "IGOT_API_KEY", None)
        base_url = getattr(settings, "IGOT_BASE_URL", "https://igotkarmayogi.gov.in/api/v1")

        max_retries = 3
        backoff_delay = 0.2

        for attempt in range(1, max_retries + 1):
            try:
                if settings.DEMO_MODE or not api_key:
                    # Simulate realistic network delay (0.05s - 0.15s) for responsive hackathon demo
                    await asyncio.sleep(random.uniform(0.05, 0.15))
                    return cls.MOCK_CATALOG
                
                async with httpx.AsyncClient(timeout=5.0) as client:
                    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
                    response = await client.get(f"{base_url}/{endpoint}", params=params, headers=headers)
                    if response.status_code == 200:
                        return response.json().get("courses", cls.MOCK_CATALOG)
                    else:
                        raise Exception(f"HTTP {response.status_code}: {response.text}")

            except Exception as e:
                logger.warning(f"[iGOT Adapter Attempt {attempt}/{max_retries}] Call failed: {e}")
                if attempt == max_retries:
                    logger.info("[iGOT Adapter Fallback] Returning local MOCK_CATALOG as fallback.")
                    return cls.MOCK_CATALOG
                await asyncio.sleep(backoff_delay * (2 ** (attempt - 1)))
                
        return cls.MOCK_CATALOG

    @classmethod
    async def search_courses(cls, competency_name: str) -> List[Dict[str, Any]]:
        catalog = await cls._call_external_api("courses/search", {"q": competency_name})
        query = competency_name.lower()
        results = []
        for course in catalog:
            if course.get("competency_keyword", "") in query or query in course.get("title", "").lower():
                results.append(course)
        
        if not results:
            results = catalog[:2]

        return results

    @classmethod
    async def get_all_courses(cls) -> List[Dict[str, Any]]:
        return await cls._call_external_api("courses/all", {})

