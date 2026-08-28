import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SkillSetu API"
    VERSION: str = "1.0.0"
    DEMO_MODE: bool = True

    # Which live model provider to use, and the keys for each.
    #
    # AI_PROVIDER is an explicit override: "anthropic", "openai", or "mock". Leave it
    # empty for the old behaviour, where DEMO_MODE=true always means the deterministic
    # MockAIProvider and DEMO_MODE=false picks whichever key is set (Anthropic first).
    # Naming a provider explicitly wins even under DEMO_MODE, which is what makes it
    # possible to test a real key locally without also turning on the strict
    # SECRET_KEY and CORS_ORIGINS requirements that DEMO_MODE=false brings.
    #
    # ANTHROPIC_MODEL is configurable because model IDs are dated strings that change
    # faster than this code does ("claude-sonnet-4-20250514" and so on). Run
    # `python check_anthropic.py` to print the exact IDs your key can see, then set
    # this to one of them rather than trusting the default below.
    AI_PROVIDER: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = ""
    DATABASE_URL: str = "sqlite:///./skillsetu.db"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Secrets. These MUST be declared here, not read with getattr(settings, ...).
    # An undeclared name combined with `extra = "ignore"` means pydantic-settings
    # silently drops the environment variable, so getattr() always fell through to
    # its hardcoded default and no env var could ever override it.
    SECRET_KEY: str = ""
    IGOT_API_KEY: str = ""
    IGOT_BASE_URL: str = "https://igotkarmayogi.gov.in/api/v1"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
