# SkillSetu — AI-Powered Competency Bridge for Government Officials

**Smart India Hackathon 2026 MVP**  
**Problem Statement ID:** SIH26101  
**Organization:** Ministry of Statistics and Programme Implementation (MoSPI - Data Informatics & Innovation Division / DIID)  
**Theme:** Smart Education & Capacity Building  

---

## 🌟 Executive Overview

SkillSetu is an AI-powered competency assessment and personalized learning pathway platform built specifically for officials in India's Official Statistical System.

The platform resolves traditional manual skill-assessment challenges by:
1. Evaluating officials across **4 MoSPI Competency Domains** (Statistical, Technical, Digital Governance, Behavioural & Managerial).
2. Parsing official PDF training manuals to automatically generate 4-option MCQs.
3. Incorporating **Human-in-the-Loop** review for trainers to approve AI-generated questions.
4. Conducting **Adaptive Assessments** with dynamic difficulty weighting.
5. Providing **Transparent & Explainable Competency Gap Analysis**.
6. Generating **Personalized Training Pathways** drawing from **iGOT Karmayogi** and **NSSTA TPAC** recommended courses.
7. Tracking learner progress with **Before vs After Proficiency Comparison**.
8. Delivering **Executive Department Analytics** for MoSPI leadership without exposing sensitive official data.
9. Embedding an **AI Virtual Assistant (SkillSetu Assistant)** for statistical learner support.

---

## 🚀 Golden Path Workflow (Hackathon 3-Min Demo)

```text
Login (Persona Selector)
   ↓
Official Profile & 4-Domain Target Framework
   ↓
Upload Learning Material PDF (PyMuPDF Chunking)
   ↓
AI MCQ Generation & Human-in-the-Loop Trainer Review
   ↓
Start Adaptive Assessment
   ↓
Visual "Analyzing Competency..." Transition
   ↓
Explainable Gap Analysis (Strong / Needs Improvement / Critical Gap)
   ↓
Personalized Training Pathway (iGOT Karmayogi + NSSTA TPAC)
   ↓
Progress Tracker (+29 Points Gain) & Executive Admin Dashboard
```

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router, TypeScript) | SSR/SSG rendering, fast UI component architecture, responsive design. |
| **Styling & UI** | Tailwind CSS + Lucide Icons | Clean government visual aesthetics, zero heavy dependencies. |
| **Data Charts** | Recharts | Multi-dimensional radar charts, bar charts, and progress metrics. |
| **Backend Framework** | Python FastAPI (Pydantic v2) | Asynchronous REST endpoints, strict schema validation. |
| **PDF Extraction** | PyMuPDF (`fitz`) | High-speed C-based text extraction & page-level document chunking. |
| **Database** | SQLite (`skillsetu.db`) | Embedded zero-config database matching Supabase/PostgreSQL schema syntax. |
| **AI System** | Dual Provider (`OpenAIProvider` + `MockAIProvider`) | Zero-crash fallback architecture for hackathon evaluation. |

---

## ⚡ Quick Start Guide (Local Setup)

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### 1. Database Initialization
```bash
cd backend
python init_db.py
```

> `init_db.py` deletes and rebuilds `skillsetu.db` from `database/schema.sql` +
> `database/seed.sql`, so **stop the backend first**. While uvicorn is running it
> holds the file open and you get
> `PermissionError: [WinError 32] ... being used by another process` — the old
> database then stays in place and every later command silently tests stale data.

### 2. Start Backend Service (Port 8000)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000 --reload
```
*Backend API docs available at `http://localhost:8000/docs`*

> Start it as `python -m uvicorn`, not bare `uvicorn`. The `uvicorn` launcher on
> PATH can belong to a different Python installation than `python`/`pip`, so
> `pip install -r requirements.txt` may satisfy one interpreter while the server
> runs on another. `python -m` guarantees both are the same.

### 2a. Verify the seed pool and competency banding (no server needed)
```bash
cd backend
python verify_competency_banding.py
```
*Builds `schema.sql` + `seed.sql` into an in-memory SQLite database with no
third-party dependencies and drives `CompetencyEngine` directly. Asserts that every
difficulty band is deep enough that a 20-question adaptive run cannot exhaust it,
that answer positions are spread so "always pick B" loses, that the demo officer's
role targets reach the engine, and — by enumerating every possible answer pattern on
one competency — that identical answers are banded differently for two job roles.
It also simulates a full 10-question run over the real seeded pool and asserts that
**every** run measures at least three competencies on two or more answers each, while
blind question selection manages that in under 1% of 200 runs. That is the difference
between a gap report and a coin flip: a competency scored on one answer can only ever
read 0% or 100%, and such rows are flagged `low_evidence` rather than presented as
findings.*

### 2b. Verify the adaptive assessment end to end
```bash
cd backend
python smoke_adaptive.py
```
*Asserts the difficulty ladder over real HTTP: two consecutive correct answers must
step the level up, two consecutive incorrect must step it down, a single answer must
not move it, served questions must not leak the correct option, and another account
must not be able to read the session. Also asserts that role targets reach both
scoring paths and that a fixed-length submission returns `answer_review` with the
correct option and explanation for every answer. Section 7c asserts the depth the
gap report rests on: the rows must account for every answer given, at least
`max_questions / 3` competencies must be measured on two or more answers, and the
loudest verdict in the report — the top-priority row — must either stand on two
answers or be flagged `low_evidence` in the payload. Exits non-zero if any of that
stops being true, and refuses to run at all against a database that predates the
current seed — a thin pool makes the ladder substitute difficulties and proves
nothing.*

*If `/api/auth/login` ever returns HTTP 500, run `python diag_login.py` — it walks
the login path in six widening stages and prints the real traceback for the one
that breaks.*

### 2c. Pin the dependencies to the versions you just verified

```bash
cd backend
python pin_requirements.py            # show what would change
python pin_requirements.py --write    # rewrite requirements.txt with ==
```
*`requirements.txt` ships with `>=` ranges, which resolve to "whatever PyPI
publishes today" — one major release of any listed package is enough to break a
setup that worked last week. This rewrites the same curated list with the versions
installed under the interpreter you run it with, so the pins describe an
environment the demo has actually run on. It is deliberately not `pip freeze`,
which would replace the curated list with the entire environment and lose the
record of which packages the project chose. Extras such as
`python-jose[cryptography]` survive the rewrite; anything not installed makes it
exit non-zero and write nothing.*

### 3. Start Frontend UI (Port 3000)
```bash
cd frontend
npm install
npm run dev
```
*Open `http://localhost:3000` in your web browser.*

---

## 🚢 Deployment (Postgres + Vercel)

Everything above runs on SQLite on one machine. For a real URL — Supabase Postgres,
the API on Render or Railway, the frontend on Vercel — follow **[DEPLOY.md](DEPLOY.md)**.
The switch is one environment variable plus a driver, because `app/database.py`
builds the engine from `DATABASE_URL`, but three things need doing that the local
path never exercises:

```bash
cd backend
python seed_db.py --selftest      # prove the Postgres seed rewrite, no database needed
python -m pip install -r requirements-postgres.txt
python seed_db.py                 # create_all() + load seed into DATABASE_URL
```

`init_db.py` cannot do this: it uses `sqlite3.executescript` and the seed's
`INSERT OR REPLACE`, neither of which Postgres understands. `seed_db.py` splits the
script on real statement boundaries and rewrites those upserts to
`ON CONFLICT (id) DO NOTHING`. On the frontend, set `BACKEND_ORIGIN` — `next.config.js`
used to hardcode `http://127.0.0.1:8000`, which on Vercel points at nothing.

---

## 🔑 Demo Login Accounts

All three seeded accounts share the password **`SkillSetu@2026`**.

| Role | Email | Persona |
|---|---|---|
| Official | `official@skillsetu.demo` | Ananya Sharma — Statistical Officer, MoSPI DIID |
| Trainer | `trainer@skillsetu.demo` | Dr. V. K. Rao — Senior Faculty, NSSTA |
| Admin | `admin@skillsetu.demo` | Rajesh Kumar — Director, MoSPI DIID |

The `/login` screen offers both one-click persona buttons (which submit the demo
password for you) and an email + password form. A failed sign-in stays on the
login screen and shows the error — it no longer navigates into the dashboard.

If sign-in fails with *"Invalid email or password"*, re-seed the database:
`cd backend && python init_db.py`. The seeded password hashes live in
`database/seed.sql`.

### Authentication notes

- Passwords are verified server-side with **PBKDF2-HMAC-SHA256**, 600,000
  iterations and a 16-byte random per-user salt (Python standard library, no
  extra dependency). PBKDF2 is an approved scheme under NIST SP 800-63B.
- Access tokens are **signed HS256 JWTs** carrying `sub`, `role`, `exp`, `iat`
  and a unique `jti`. Unsigned or tampered tokens are rejected, and `POST
  /api/auth/logout` adds a token to a revocation list.
- Authorization is enforced by the `require_role(...)` dependency on every
  protected route, using an exact role match.
- **Before deploying anywhere real:** remove the quick-login buttons from
  `frontend/app/login/page.tsx`, drop `DEMO_PASSWORD` from
  `frontend/app/context/AuthContext.tsx`, rotate `SECRET_KEY`, and replace the
  seeded accounts. The demo password is published above and is readable in the
  client bundle, which is inherent to one-click login.

---

## 📜 Problem Statement SIH26101 Compliance Matrix

| Requirement | SkillSetu MVP Implementation | Status |
|---|---|---|
| Competency-gap detection | `CompetencyEngine` categorizing scores into Strong/Needs Improvement/Critical Gap | ✅ Implemented |
| iGOT Karmayogi Integration | Abstracted `IGOTService` returning iGOT + NSSTA TPAC course items | ✅ Implemented |
| MCQ Generation from Uploaded Content | PyMuPDF text chunking + AI MCQ generator with options & explanations | ✅ Implemented |
| Human-in-the-Loop Review | Trainer review interface to Approve/Edit/Reject pending AI MCQs | ✅ Implemented |
| Learner & Admin Dashboards | Dedicated Official learner dashboard + Admin DIID aggregated analytics | ✅ Implemented |
| Offline / Zero-Crash Reliability | `DEMO_MODE=true` deterministic AI fallback mode | ✅ Implemented |
