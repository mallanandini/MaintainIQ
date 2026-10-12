from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.database import get_db
from backend.app.models.technician import Technician
from backend.app.models.work_order import WorkOrder
from backend.app.schemas.technician import (
    TechnicianCreate,
    TechnicianUpdate,
    TechnicianResponse,
    TechnicianDetailResponse
)

router = APIRouter(prefix="/technicians", tags=["Technicians"])

@router.get("", response_model=List[TechnicianResponse])
def list_technicians(
    q: Optional[str] = Query(None, description="Search by name, employee_id, email"),
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE, ON_LEAVE, INACTIVE)"),
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
    db: Session = Depends(get_db)
):
    query = db.query(Technician)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Technician.name.ilike(term),
                Technician.employee_id.ilike(term),
                Technician.email.ilike(term)
            )
        )
    if status:
        query = query.filter(Technician.status == status.upper())
    if specialization:
        query = query.filter(Technician.specialization == specialization)
    return query.order_by(Technician.name.asc()).all()

@router.post("", response_model=TechnicianResponse, status_code=status.HTTP_201_CREATED)
def create_technician(payload: TechnicianCreate, db: Session = Depends(get_db)):
    if db.query(Technician).filter(Technician.employee_id == payload.employee_id.strip()).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Employee ID '{payload.employee_id}' is already registered."
        )
    if db.query(Technician).filter(Technician.email == payload.email.lower().strip()).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' is already registered."
        )

    data = payload.model_dump()
    data["email"] = data["email"].lower().strip()
    data["employee_id"] = data["employee_id"].strip()
    tech = Technician(**data)
    db.add(tech)
    db.commit()
    db.refresh(tech)
    return tech

@router.get("/{tech_id}", response_model=TechnicianDetailResponse)
def get_technician(tech_id: int, db: Session = Depends(get_db)):
    tech = db.query(Technician).filter(Technician.id == tech_id).first()
    if not tech:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found.")
    
    assigned_wo = db.query(WorkOrder).filter(WorkOrder.assigned_technician_id == tech_id).count()
    active_wo = db.query(WorkOrder).filter(
        WorkOrder.assigned_technician_id == tech_id,
        WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"])
    ).count()

    resp = TechnicianDetailResponse.model_validate(tech)
    resp.assigned_work_orders_count = assigned_wo
    resp.active_work_orders_count = active_wo
    return resp

@router.put("/{tech_id}", response_model=TechnicianResponse)
def update_technician(tech_id: int, payload: TechnicianUpdate, db: Session = Depends(get_db)):
    tech = db.query(Technician).filter(Technician.id == tech_id).first()
    if not tech:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found.")
    
    update_data = payload.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"]:
        email_clean = update_data["email"].lower().strip()
        existing = db.query(Technician).filter(Technician.email == email_clean, Technician.id != tech_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already used by another technician.")
        update_data["email"] = email_clean

    for field, val in update_data.items():
        if val is not None:
            setattr(tech, field, val)
            
    db.commit()
    db.refresh(tech)
    return tech
