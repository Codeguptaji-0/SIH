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
#
# The old line was `allow_origins=origins if origins else ["*"]`, which is wrong in
# two different ways once this runs anywhere but a laptop. A wildcard together with
# allow_credentials=True is invalid per the CORS spec - browsers refuse the response
# outright - so the fallback that looks permissive actually breaks the deployed
# frontend in a way that reads as "the API is down". And on a public host it invites
# any origin to call the API with the user's Authorization header attached.
#
# So: keep the convenient wildcard for DEMO_MODE (a laptop, arbitrary ports, judges
# opening 127.0.0.1 vs localhost), and refuse to start without an explicit
# CORS_ORIGINS when DEMO_MODE is false. Failing at boot with a named env var is
# recoverable in seconds; failing per-request in the browser console is not.
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if not origins:
    if not settings.DEMO_MODE:
        raise RuntimeError(
            "CORS_ORIGINS is empty and DEMO_MODE is false. Set CORS_ORIGINS to the "
            "exact frontend origin(s), comma separated, e.g. "
            "CORS_ORIGINS=https://skillsetu.vercel.app - a wildcard cannot be used "
            "with credentialed requests."
        )
    origins = ["*"]
if "*" in origins and not settings.DEMO_MODE:
    raise RuntimeError(
        "CORS_ORIGINS contains '*' while DEMO_MODE is false. Browsers reject a "
        "wildcard origin on credentialed requests; list the real origins instead."
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
        # Read from the live engine, not hardcoded. This string used to say
        # "SQLite (skillsetu.db)" unconditionally, so a Postgres deployment would
        # have reported SQLite - and the one endpoint you curl to find out what a
        # host is actually talking to would have lied. The dialect name only
        # ("sqlite", "postgresql"), never the URL, which carries the password.
        "database": engine.dialect.name,
    }
