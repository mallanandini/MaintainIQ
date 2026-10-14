import sys
import os

# Ensure repository root is on sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from backend.app.database import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    db.execute(text("SELECT 1"))
    db.close()
    print("CONNECTED")
except Exception as e:
    print(f"ERROR: {str(e)}")
