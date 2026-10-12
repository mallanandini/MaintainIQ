import os
import urllib.parse
import sys
from dotenv import load_dotenv

# Ensure root directory is on python path
sys.path.insert(0, os.path.abspath("."))

from sqlalchemy import create_engine, text

# Load environment configuration
load_dotenv()

def init_database():
    from backend.app.config import settings

    if "mysql" in settings.DATABASE_URL:
        mysql_user = os.getenv("MYSQL_USER", "root")
        mysql_password = os.getenv("MYSQL_PASSWORD", "")
        mysql_host = os.getenv("MYSQL_HOST", "127.0.0.1")
        mysql_port = os.getenv("MYSQL_PORT", "3306")
        mysql_db = os.getenv("MYSQL_DATABASE", "maintainiq")

        encoded_pw = urllib.parse.quote_plus(mysql_password)
        server_url = f"mysql+pymysql://{mysql_user}:{encoded_pw}@{mysql_host}:{mysql_port}/"

        print(f"Connecting to MySQL server at {mysql_host}:{mysql_port}...")
        try:
            server_engine = create_engine(server_url, pool_pre_ping=True)
            with server_engine.connect() as conn:
                conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{mysql_db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
                conn.commit()
            print(f"Database '{mysql_db}' exists/created successfully.")
        except Exception as e:
            print(f"Error creating MySQL database '{mysql_db}': {e}", file=sys.stderr)
            raise

    from backend.app.database import engine, Base
    from backend.app.models import Asset, Technician, MaintenanceType, WorkOrder, WorkOrderStatusHistory
    from backend.app.seed import seed_database

    print("Creating tables, unique constraints, and foreign keys...")
    Base.metadata.create_all(bind=engine)
    print("Database schema successfully synchronized.")

    print("Populating initial realistic assets, technicians, and work orders...")
    seed_database()
    print("Seed data successfully populated.")

if __name__ == "__main__":
    init_database()
