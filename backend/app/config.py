import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SkillSetu API"
    VERSION: str = "1.0.0"
    DEMO_MODE: bool = True
    OPENAI_API_KEY: str = ""
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
