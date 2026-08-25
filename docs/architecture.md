# SkillSetu Technical Architecture Specification

## 1. Monorepo Overview
SkillSetu is structured as a decoupled monorepo:
- `frontend/`: Next.js 14 App Router, React, Tailwind CSS, Recharts.
- `backend/`: FastAPI Python REST API, SQLAlchemy ORM, PyMuPDF, OpenAI / Mock AI provider.
- `database/`: `schema.sql` DDL and `seed.sql` DML data scripts.

## 2. AI Provider Abstraction Architecture
The backend uses a polymorphic `AIProvider` factory:
```python
if DEMO_MODE or not OPENAI_API_KEY:
    return MockAIProvider()
else:
    return OpenAIProvider(OPENAI_API_KEY)
```
This guarantees that API key exhaustion or network offline status never interrupts hackathon evaluation.

## 3. MoSPI 4-Domain Competency Framework
Competencies are evaluated across:
1. **Statistical Competencies:** Survey Design, Sampling, National Accounts, CPI/WPI, Metadata.
2. **Technical Competencies:** Python, R, SQL, Stata, SPSS, GIS, Open Data Standards.
3. **Digital Governance:** Cybersecurity, Data Privacy (DPDP Act 2023), Government Cloud, DPI.
4. **Behavioural & Managerial:** Leadership, Communication, Survey Project Management, Ethics.

## 4. Human-In-The-Loop Workflow
AI-generated questions default to `review_status = "PENDING"`. Trainers inspect and approve/edit questions on `/trainer/review` before they are committed to official assessment question banks.
