import uuid
from datetime import datetime
from sqlalchemy import (Column, String, Integer, Float, Text, DateTime, ForeignKey,
                        UniqueConstraint, CheckConstraint)
from sqlalchemy.orm import relationship
from app.database import Base

# Why the CheckConstraints below exist, in one place.
#
# database/schema.sql declares 8 CHECK constraints, and SQLite enforces every one
# of them because init_db.py executes that file. But schema.sql is never executed
# outside SQLite: app/main.py calls Base.metadata.create_all(bind=engine), so on
# Postgres the DDL is emitted from THIS file. Until these constraints were
# mirrored here, a Postgres deploy quietly dropped all 8 domains - the same code
# that raises IntegrityError locally would have inserted review_status='WHATEVER'
# in production and served an unreviewed question to an officer.
#
# Each constraint below is a verbatim mirror of the CHECK in schema.sql, cited by
# line. Keep the two in step: if a domain changes in one, change it in the other,
# or SQLite and Postgres stop being the same product.

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False) # OFFICIAL, TRAINER, ADMIN
    created_at = Column(DateTime, default=datetime.utcnow)

    # schema.sql:7. require_role(...) compares against these exact strings, so a
    # row with role='admin' would authorise nothing and look like a broken login.
    __table_args__ = (
        CheckConstraint("role IN ('OFFICIAL', 'TRAINER', 'ADMIN')",
                        name="ck_users_role"),
    )

    profile = relationship("Profile", back_populates="user", uselist=False)

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    designation = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    job_role = Column(String(100), nullable=True)
    current_assignment = Column(String(150), nullable=True)
    educational_qualification = Column(String(150), nullable=True)
    previous_trainings = Column(Text, nullable=True) # JSON list string
    experience_years = Column(Integer, default=5)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="profile")

class Competency(Base):
    __tablename__ = "competencies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    domain = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class RoleTarget(Base):
    """
    Expected proficiency for a job role on one competency.

    A gap is a shortfall against what the officer's ROLE requires, not against one
    global pass mark - 62% in Survey Design is a gap for a Statistical Officer running
    NSS rounds and adequate for someone who never touches sample design. The engine
    falls back to its absolute thresholds when no target exists for the role, so a
    missing row degrades the reading rather than breaking it.

    Mirrored in database/schema.sql, which is what init_db.py actually executes.
    """
    __tablename__ = "role_targets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_role = Column(String(100), nullable=False, index=True)
    competency_id = Column(String(36), ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False)
    target_score = Column(Float, nullable=False)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # schema.sql:45. A target of 0 would mark every score "strong" and a target
    # above 100 would mark every score a critical gap - both silently, since the
    # engine only ever subtracts.
    __table_args__ = (
        UniqueConstraint("job_role", "competency_id", name="uq_role_target"),
        CheckConstraint("target_score > 0 AND target_score <= 100",
                        name="ck_role_targets_target_score"),
    )

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    uploaded_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    department = Column(String(100), default="MoSPI DIID")
    page_count = Column(Integer, default=0)
    status = Column(String(20), default="READY")
    extracted_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, default=1)
    content = Column(Text, nullable=False)

class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    competency_id = Column(String(36), ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False) # JSON list string
    correct_option = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=False)
    difficulty = Column(String(10), nullable=False) # easy, medium, hard
    # Fail CLOSED. A default of "APPROVED" meant any question inserted without an
    # explicit review_status (a seed row, a script, a future code path) was instantly
    # servable to officers, silently bypassing trainer review.
    review_status = Column(String(20), nullable=False, default="PENDING") # PENDING, APPROVED, REJECTED
    source_reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # schema.sql:82 and 88. The difficulty domain is what the adaptive ladder
    # steps through; a fourth value would be invisible to selection and the
    # question could never be served. The review_status domain is the
    # human-in-the-loop gate itself.
    __table_args__ = (
        CheckConstraint("difficulty IN ('easy', 'medium', 'hard')",
                        name="ck_questions_difficulty"),
        CheckConstraint("review_status IN ('PENDING', 'APPROVED', 'REJECTED')",
                        name="ck_questions_review_status"),
    )

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    overall_score = Column(Float, default=0.0)
    completed_at = Column(DateTime, default=datetime.utcnow)

class CompetencyResult(Base):
    __tablename__ = "competency_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    attempt_id = Column(String(36), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False)
    competency_id = Column(String(36), ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False)
    status = Column(String(20), nullable=False) # strong, needs_improvement, critical_gap
    priority = Column(Integer, default=1)
    evidence = Column(Text, nullable=True)

    # schema.sql:110. The frontend colours and groups gap rows by these exact
    # strings; an unknown status renders as an unstyled row rather than an error.
    __table_args__ = (
        CheckConstraint(
            "status IN ('strong', 'needs_improvement', 'critical_gap')",
            name="ck_competency_results_status"),
    )

class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    attempt_id = Column(String(36), nullable=True)
    course_id = Column(String(100), nullable=False)
    course_title = Column(String(255), nullable=False)
    competency_id = Column(String(36), ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(100), nullable=False)
    priority = Column(String(10), nullable=False)
    estimated_duration = Column(String(50), default="2 hours")
    status = Column(String(20), default="ASSIGNED") # ASSIGNED, IN_PROGRESS, COMPLETED
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # schema.sql:125. Capitalised on purpose - IGOTService emits 'High'/'Medium'/
    # 'Low' and the pathway UI sorts on them. schema.sql does not constrain the
    # `status` column here, so neither does this.
    __table_args__ = (
        CheckConstraint("priority IN ('High', 'Medium', 'Low')",
                        name="ck_learning_paths_priority"),
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AdaptiveSession(Base):
    """
    Server-side state for one adaptive assessment run.

    The current level, the streak counters and the full ladder trail live here
    rather than in the client. That matters twice over. For integrity, because a
    browser that owned this state could walk itself down to easy questions and
    then report a high score. And for auditability, because every rung of the
    ladder can be replayed later from trail_json together with the reason string
    that produced it, which is what a government audit actually asks for.
    """
    __tablename__ = "adaptive_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    current_level = Column(String(10), nullable=False, default="medium")
    consecutive_correct = Column(Integer, nullable=False, default=0)
    consecutive_wrong = Column(Integer, nullable=False, default=0)
    answered_count = Column(Integer, nullable=False, default=0)
    correct_count = Column(Integer, nullable=False, default=0)
    max_questions = Column(Integer, nullable=False, default=10)
    served_json = Column(Text, nullable=False, default="[]")   # question ids already served
    trail_json = Column(Text, nullable=False, default="[]")    # one entry per answered question
    status = Column(String(20), nullable=False, default="ACTIVE")  # ACTIVE, COMPLETED, ABANDONED
    attempt_id = Column(String(36), ForeignKey("quiz_attempts.id", ondelete="SET NULL"), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # schema.sql:148 and 157. current_level is the ladder's position, so a value
    # outside the three rungs would make step_up/step_down non-deterministic. The
    # status domain is what stops a COMPLETED session being answered again.
    __table_args__ = (
        CheckConstraint("current_level IN ('easy', 'medium', 'hard')",
                        name="ck_adaptive_sessions_current_level"),
        CheckConstraint("status IN ('ACTIVE', 'COMPLETED', 'ABANDONED')",
                        name="ck_adaptive_sessions_status"),
    )
