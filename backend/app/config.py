import os
import urllib.parse
from dotenv import load_dotenv

# Load local .env file if present
load_dotenv()

class Settings:
    PROJECT_NAME: str = "MaintainIQ"
    PROJECT_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")

    @property
    def DATABASE_URL(self) -> str:
        # 1. Direct explicit DATABASE_URL
        explicit_url = os.getenv("DATABASE_URL")
        if explicit_url:
            return explicit_url

        # 2. Individual MySQL connection parameters
        mysql_user = os.getenv("MYSQL_USER")
        if mysql_user:
            mysql_password = os.getenv("MYSQL_PASSWORD", "")
            mysql_host = os.getenv("MYSQL_HOST", "127.0.0.1")
            mysql_port = os.getenv("MYSQL_PORT", "3306")
            mysql_db = os.getenv("MYSQL_DATABASE", "maintainiq")
            encoded_password = urllib.parse.quote_plus(mysql_password)
            return f"mysql+pymysql://{mysql_user}:{encoded_password}@{mysql_host}:{mysql_port}/{mysql_db}?charset=utf8mb4"

        # 3. Default fallback SQLite
        return "sqlite:///./maintainiq.db"

settings = Settings()
