import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SkillSetu API"
    VERSION: str = "1.0.0"
    DEMO_MODE: bool = True
    OPENAI_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./skillsetu.db"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
