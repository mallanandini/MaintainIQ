from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.schemas.maintenance_type import MaintenanceTypeResponse

router = APIRouter(prefix="/maintenance-types", tags=["Maintenance Types"])

@router.get("", response_model=List[MaintenanceTypeResponse])
def list_maintenance_types(db: Session = Depends(get_db)):
    return db.query(MaintenanceType).order_by(MaintenanceType.id.asc()).all()
