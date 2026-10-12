import os

class Settings:
    PROJECT_NAME: str = "MaintainIQ"
    PROJECT_VERSION: str = "1.0.0"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./maintainiq.db")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")

settings = Settings()
