import json
import random
from typing import List, Dict, Any
from app.config import settings

class AIProvider:
    def generate_mcqs(self, text_chunks: List[str], count: int = 5) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def generate_chat_response(self, prompt: str) -> str:
        raise NotImplementedError

class MockAIProvider(AIProvider):
    def generate_mcqs(self, text_chunks: List[str], count: int = 5) -> List[Dict[str, Any]]:
        # Hardcoded baseline pool as reliable fallback
        mock_pool = [
            {
                "question_text": "What is the primary objective of Stratified Sampling in National Sample Surveys?",
                "options": [
                    "To increase survey completion time",
                    "To guarantee representation across diverse homogeneous sub-strata",
                    "To reduce sample size to under 10 respondents",
                    "To replace manual field enumeration with pure estimation"
                ],
                "correct_option": 1,
                "explanation": "Stratification ensures that specific sub-groups of a population are represented proportionally, reducing variance.",
                "competency_name": "Survey Design & Sampling Methods",
                "domain": "Statistical Competencies",
                "difficulty": "medium",
                "source_reference": "NSSO Methodology Ch. 3"
            },
            {
                "question_text": "In Consumer Price Index (CPI) computation, what does base-year updating prevent?",
                "options": [
                    "Data entry errors in field apps",
                    "Commodity basket obsolescence and substitution bias",
                    "Calculation of annual inflation percentages",
                    "Publishing index numbers online"
                ],
                "correct_option": 1,
                "explanation": "Updating base years ensures that the consumer basket reflects modern consumption patterns.",
                "competency_name": "National Accounts & Price Statistics",
                "domain": "Statistical Competencies",
                "difficulty": "hard",
                "source_reference": "Price Statistics Manual"
            },
            {
                "question_text": "Which Python library feature enables vectorized numerical operations across large statistical datasets?",
                "options": [
                    "Python standard list concatenation",
                    "NumPy ndarray memory layout and C extensions",
                    "JSON string parsing",
                    "File I/O readlines"
                ],
                "correct_option": 1,
                "explanation": "NumPy arrays perform contiguous memory block operations in C, offering high computational efficiency.",
                "competency_name": "Data Analysis & Python/R",
                "domain": "Technical Competencies",
                "difficulty": "easy",
                "source_reference": "MoSPI Tech Training Guide"
            },
            {
                "question_text": "Under the Digital Personal Data Protection (DPDP) Act 2023, how should anonymized survey microdata be handled?",
                "options": [
                    "Stored unencrypted on public web drives",
                    "Stripped of direct identifiers prior to dissemination under open data standards",
                    "Deleted immediately after initial tabulation",
                    "Shared without data governance review"
                ],
                "correct_option": 1,
                "explanation": "Anonymization strips personally identifiable information (PII) while preserving data utility.",
                "competency_name": "Data Privacy & Cybersecurity",
                "domain": "Digital Governance",
                "difficulty": "medium",
                "source_reference": "DPDP Compliance Framework"
            },
            {
                "question_text": "What is the primary role of SDMX (Statistical Data and Metadata eXchange) standards?",
                "options": [
                    "Compressing statistical PDFs into zip archives",
                    "Standardizing structural metadata and data payloads between official statistical agencies",
                    "Creating graphical PowerPoint slides automatically",
                    "Generating random numbers for survey sampling"
                ],
                "correct_option": 1,
                "explanation": "SDMX facilitates automated data exchange between national statistical offices and international organizations.",
                "competency_name": "Official Statistics & Data Visualization",
                "domain": "Technical Competencies",
                "difficulty": "medium",
                "source_reference": "UN SDMX Specifications"
            }
        ]
        
        # Priority 2: Extract key sentences from uploaded text_chunks if available
        extracted_sentences = []
        if text_chunks and len(text_chunks) > 0:
            import re
            full_text = " ".join([c for c in text_chunks if isinstance(c, str)])
            # Split into candidate sentences
            raw_sentences = [s.strip() for s in re.split(r'[.\n!?]+', full_text) if len(s.strip()) > 25]
            
            # Prioritize sentences with numbers, technical terms, or longest sentence lengths
            scored_sentences = []
            for s in raw_sentences:
                has_num = bool(re.search(r'\d+', s))
                has_cap = bool(re.search(r'\b[A-Z]{2,}\b', s))
                score = len(s) + (100 if has_num else 0) + (150 if has_cap else 0)
                scored_sentences.append((score, s))
                
            scored_sentences.sort(key=lambda x: x[0], reverse=True)
            extracted_sentences = [s[1] for s in scored_sentences[:count]]
            
        if extracted_sentences and len(extracted_sentences) >= 2:
            results = []
            domains_list = [
                ("Statistical Methods & Inference", "Statistical Competencies"),
                ("Survey Design & Sampling Methods", "Statistical Competencies"),
                ("National Accounts & Price Statistics", "Statistical Competencies"),
                ("Data Analysis & Python/R", "Technical Competencies"),
                ("Official Statistics & Data Visualization", "Technical Competencies")
            ]
            
            for idx, sentence in enumerate(extracted_sentences[:count]):
                phrase = sentence[:80].strip() + "..." if len(sentence) > 80 else sentence.strip()
                comp_name, dom_name = domains_list[idx % len(domains_list)]
                
                # Build content-connected question
                q_text = f"According to the uploaded document material: '{phrase}', which of the following best represents the key principle?"
                correct_opt = sentence[:120] if len(sentence) <= 120 else sentence[:117] + "..."
                
                results.append({
                    "question_text": q_text,
                    "options": [
                        "The procedure should be bypassed during annual enumeration rounds.",
                        f"It specifies: {correct_opt}",
                        "It restricts data processing strictly to offline paper logs.",
                        "It mandates 100% automated substitution without human review."
                    ],
                    "correct_option": 1,
                    "explanation": f"Extracted directly from uploaded document reference: '{sentence}'",
                    "competency_name": comp_name,
                    "domain": dom_name,
                    "difficulty": "medium" if idx % 2 == 0 else "hard",
                    "source_reference": f"Uploaded Content Chunk #{idx + 1}"
                })
            return results

        # Fallback to static mock pool if text_chunks is empty or insufficient
        results = []
        for i in range(count):
            base_item = mock_pool[i % len(mock_pool)].copy()
            results.append(base_item)
        return results

    def generate_chat_response(self, prompt: str) -> str:
        prompt_lower = prompt.lower()
        if "sampling" in prompt_lower or "survey" in prompt_lower:
            return "In Official Statistics, sampling methods like Stratified Random Sampling and Multi-Stage Cluster Sampling are used by NSSO to ensure high statistical precision while managing field costs. Would you like a breakdown of sample weight calibration?"
        elif "cpi" in prompt_lower or "price" in prompt_lower or "inflation" in prompt_lower:
            return "Consumer Price Index (CPI) measures weighted price changes of a fixed consumer basket. In India, MoSPI releases Monthly CPI for Rural, Urban, and Combined sectors using 2012 as the base year."
        elif "python" in prompt_lower or "data" in prompt_lower or "r" in prompt_lower:
            return "SkillSetu recommends utilizing Python (Pandas/Polars) or R for statistical data processing, automated data validation, and building reproducible reporting pipelines."
        else:
            return f"SkillSetu AI Assistant (MoSPI Domain Mode): I have analyzed your query regarding '{prompt}'. For official capacity building, I recommend exploring the relevant NSSTA TPAC modules or iGOT Karmayogi courses in your personalized learning path."

class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str):
        import openai
        self.client = openai.OpenAI(api_key=api_key)

    def generate_mcqs(self, text_chunks: List[str], count: int = 5) -> List[Dict[str, Any]]:
        combined_text = "\n".join(text_chunks[:3])[:3000]
        prompt = f"""
        You are an expert government statistical training assessment designer for MoSPI India.
        Extract relevant knowledge from the text below and generate exactly {count} multiple-choice questions in valid JSON array format.

        Document Text:
        {combined_text}

        JSON Schema per question object:
        {{
            "question_text": "string",
            "options": ["Option 0", "Option 1", "Option 2", "Option 3"],
            "correct_option": integer (0 to 3),
            "explanation": "pedagogical explanation",
            "competency_name": "Statistical Methods & Inference" or "Survey Design & Sampling Methods" or "National Accounts & Price Statistics" or "Data Analysis & Python/R" or "Data Privacy & Cybersecurity",
            "domain": "Statistical Competencies" or "Technical Competencies" or "Digital Governance",
            "difficulty": "easy" or "medium" or "hard",
            "source_reference": "Document Page Reference"
        }}
        Return ONLY the raw JSON array.
        """
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            raw_content = response.choices[0].message.content.strip()
            if raw_content.startswith("```json"):
                raw_content = raw_content.replace("```json", "").replace("```", "").strip()
            return json.loads(raw_content)
        except Exception as e:
            print(f"[AI Fallback] OpenAI generation failed: {e}. Switching to MockAIProvider.")
            return MockAIProvider().generate_mcqs(text_chunks, count)

    def generate_chat_response(self, prompt: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are SkillSetu Assistant, an AI learner support bot for Indian government officials in MoSPI."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return MockAIProvider().generate_chat_response(prompt)

def get_ai_provider() -> AIProvider:
    if settings.DEMO_MODE or not settings.OPENAI_API_KEY:
        return MockAIProvider()
    try:
        return OpenAIProvider(settings.OPENAI_API_KEY)
    except Exception:
        return MockAIProvider()
