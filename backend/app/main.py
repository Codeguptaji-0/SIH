from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.auth.dependencies import HAS_JOSE, _JOSE_MISSING_MESSAGE
from app.routers import auth, profile, materials, quizzes, competency, recommendations, assistant, trainer, admin

# python-jose is imported defensively in auth/dependencies.py so that module can be
# inspected without it. The cost of that guard was a server which started cleanly and
# then returned a bare HTTP 500 from /api/auth/login with no explanation - exactly the
# trap a fresh clone, or a `uvicorn` shim belonging to a different interpreter, falls
# into. Refuse to start instead, and name the install command.
if not HAS_JOSE:
    raise RuntimeError(_JOSE_MISSING_MESSAGE)

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SkillSetu API — AI-Powered Competency Bridge for Government Officials",
    description="Backend API service for Smart India Hackathon 2026 (SIH26101 MoSPI)",
    version=settings.VERSION
)

# CORS setup
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
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
