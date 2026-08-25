from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.routers import auth, profile, materials, quizzes, competency, recommendations, assistant, trainer, admin

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SkillSetu API — AI-Powered Competency Bridge for Government Officials",
    description="Backend API service for Smart India Hackathon 2026 (SIH26101 MoSPI)",
    version=settings.VERSION
)

# CORS setup
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permissive for hackathon local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(materials.router)
app.include_router(quizzes.router)
app.include_router(competency.router)
app.include_router(recommendations.router)
app.include_router(assistant.router)
app.include_router(trainer.router)
app.include_router(admin.router)

@app.get("/")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app_name": "SkillSetu",
        "problem_statement": "SIH26101 (MoSPI)",
        "demo_mode": settings.DEMO_MODE,
        "database": "SQLite (skillsetu.db)"
    }
