from typing import List, Optional, Any
from pydantic import BaseModel
from datetime import datetime

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    full_name: str
    designation: str
    department: str
    job_role: Optional[str] = None
    current_assignment: Optional[str] = None
    educational_qualification: Optional[str] = None
    previous_trainings: List[str] = []
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    job_role: Optional[str] = None
    current_assignment: Optional[str] = None
    educational_qualification: Optional[str] = None
    previous_trainings: Optional[List[str]] = None

class CompetencySchema(BaseModel):
    id: str
    domain: str
    name: str
    description: Optional[str] = None

class DocumentSchema(BaseModel):
    id: str
    title: str
    filename: str
    department: str
    page_count: int
    status: str
    created_at: datetime

class QuestionSchema(BaseModel):
    id: str
    competency_id: str
    competency_name: Optional[str] = None
    question_text: str
    options: List[str]
    correct_option: int
    explanation: str
    difficulty: str
    review_status: str
    source_reference: Optional[str] = None

class QuizGenerateRequest(BaseModel):
    document_id: Optional[str] = None
    number_of_questions: int = 10
    difficulty: str = "mixed"

class AnswerSubmit(BaseModel):
    question_id: str
    selected_option: int

class QuizSubmitRequest(BaseModel):
    answers: List[AnswerSubmit]

class CompetencyResultSchema(BaseModel):
    competency_id: str
    competency_name: str
    domain: str
    score: float
    status: str # strong, needs_improvement, critical_gap
    priority: int
    evidence: str

class QuizResultResponse(BaseModel):
    attempt_id: str
    overall_score: float
    total_questions: int
    correct_answers: int
    results: List[CompetencyResultSchema]

class LearningItemSchema(BaseModel):
    id: str
    course_id: str
    course_title: str
    competency_id: str
    competency_name: str
    provider: str
    priority: str
    estimated_duration: str
    status: str

class ChatMessageRequest(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    reply: str
    sources: List[str] = []

class AdminAnalyticsResponse(BaseModel):
    total_officials: int
    assessments_completed: int
    average_competency: float
    critical_gaps_count: int
    domain_readiness: dict
    domain_trends: Optional[dict] = None
    top_gaps: List[dict]
    training_demand: List[dict]
