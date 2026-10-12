import threading
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.models.work_order import WorkOrder

_sequence_lock = threading.Lock()
_last_seq_by_year = {}

def generate_work_order_number(db: Session) -> str:
    """
    Generates a unique, monotonically increasing work order number.
    Format: WO-YYYY-XXXX (e.g., WO-2026-0001).
    Guaranteed unique under concurrent requests via memory-lock sequence tracker
    and DB verification fallback.
    """
    year = datetime.utcnow().year
    prefix = f"WO-{year}-"
    
    with _sequence_lock:
        if year not in _last_seq_by_year:
            # Initialize from database
            highest = 0
            existing_numbers = db.query(WorkOrder.work_order_number).filter(
                WorkOrder.work_order_number.like(f"{prefix}%")
            ).all()
            for (num,) in existing_numbers:
                try:
                    parts = num.split("-")
                    if len(parts) >= 3:
                        val = int(parts[2])
                        if val > highest:
                            highest = val
                except (ValueError, IndexError):
                    pass
            _last_seq_by_year[year] = highest

        _last_seq_by_year[year] += 1
        candidate = f"{prefix}{_last_seq_by_year[year]:04d}"

        # Safety check against DB
        while db.query(WorkOrder.id).filter(WorkOrder.work_order_number == candidate).first():
            _last_seq_by_year[year] += 1
            candidate = f"{prefix}{_last_seq_by_year[year]:04d}"

        return candidate
