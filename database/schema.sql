-- SkillSetu Database Schema (PostgreSQL / SQLite Compatible)

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OFFICIAL', 'TRAINER', 'ADMIN')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    job_role VARCHAR(100),
    current_assignment VARCHAR(150),
    educational_qualification VARCHAR(150),
    previous_trainings TEXT,
    experience_years INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competencies (
    id VARCHAR(36) PRIMARY KEY,
    domain VARCHAR(50) NOT NULL, -- Statistical, Technical, Digital Governance, Behavioural/Managerial
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    uploaded_by VARCHAR(36) NOT NULL,
    department VARCHAR(100) DEFAULT 'MoSPI DIID',
    page_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'READY',
    extracted_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    chunk_index INTEGER NOT NULL,
    page_number INTEGER DEFAULT 1,
    content TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36),
    competency_id VARCHAR(36) NOT NULL,
    question_text TEXT NOT NULL,
    options_json TEXT NOT NULL, -- Array of 4 strings in JSON format
    correct_option INTEGER NOT NULL, -- 0 to 3
    explanation TEXT NOT NULL,
    difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    -- Fail CLOSED, matching backend/app/models/models.py. init_db.py builds the
    -- database from this file, not from the SQLAlchemy models, so a default of
    -- 'APPROVED' here meant every seeded or scripted row was instantly servable
    -- to officers and trainer review was bypassed in the actual demo database.
    review_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    source_reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    overall_score FLOAT DEFAULT 0.0,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competency_results (
    id VARCHAR(36) PRIMARY KEY,
    attempt_id VARCHAR(36) NOT NULL,
    competency_id VARCHAR(36) NOT NULL,
    score FLOAT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('strong', 'needs_improvement', 'critical_gap')),
    priority INTEGER DEFAULT 1,
    evidence TEXT,
    FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_paths (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    attempt_id VARCHAR(36),
    course_id VARCHAR(100) NOT NULL,
    course_title VARCHAR(255) NOT NULL,
    competency_id VARCHAR(36) NOT NULL,
    provider VARCHAR(100) NOT NULL, -- iGOT Karmayogi / NSSTA TPAC
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    estimated_duration VARCHAR(50) DEFAULT '2 hours',
    status VARCHAR(20) DEFAULT 'ASSIGNED', -- ASSIGNED, IN_PROGRESS, COMPLETED
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Server-side state for adaptive assessment runs. Held here rather than in the
-- client so the browser cannot choose its own difficulty and then report a score.
CREATE TABLE IF NOT EXISTS adaptive_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    current_level VARCHAR(10) NOT NULL DEFAULT 'medium'
        CHECK (current_level IN ('easy', 'medium', 'hard')),
    consecutive_correct INTEGER NOT NULL DEFAULT 0,
    consecutive_wrong INTEGER NOT NULL DEFAULT 0,
    answered_count INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    max_questions INTEGER NOT NULL DEFAULT 10,
    served_json TEXT NOT NULL DEFAULT '[]',
    trail_json TEXT NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'COMPLETED', 'ABANDONED')),
    attempt_id VARCHAR(36),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE SET NULL
);
