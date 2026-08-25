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

### 2. Start Backend Service (Port 8000)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```
*Backend API docs available at `http://localhost:8000/docs`*

### 3. Start Frontend UI (Port 3000)
```bash
cd frontend
npm install
npm run dev
```
*Open `http://localhost:3000` in your web browser.*

---

## 🔑 Demo Login Accounts

Single-click persona auth buttons are enabled on `/login`:
- **Official Persona:** `official@skillsetu.demo` (Ananya Sharma - Statistical Officer, MoSPI DIID)
- **Trainer Persona:** `trainer@skillsetu.demo` (Dr. V. K. Rao - Senior Faculty, NSSTA)
- **Admin Persona:** `admin@skillsetu.demo` (Rajesh Kumar - Director, MoSPI DIID)

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
