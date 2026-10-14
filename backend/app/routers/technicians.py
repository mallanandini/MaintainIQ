from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.technician import Technician
from backend.app.models.work_order import WorkOrder
from backend.app.schemas.technician import (
    TechnicianCreate,
    TechnicianUpdate,
    TechnicianResponse,
    TechnicianDetailResponse
)
from backend.app.services.recommendation_service import (
    get_technician_recommendations,
    TechnicianRecommendationResponse
)

router = APIRouter(prefix="/technicians", tags=["Technicians"])

@router.get("", response_model=List[TechnicianDetailResponse])
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
    
    techs = query.order_by(Technician.name.asc()).all()
    if not techs:
        return []

    tech_ids = [t.id for t in techs]
    # Single aggregate query for total and active workload counts
    counts = (
        db.query(
            WorkOrder.assigned_technician_id,
            func.count(WorkOrder.id).label("total"),
            func.sum(
                case(
                    (WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"]), 1),
                    else_=0
                )
            ).label("active")
        )
        .filter(WorkOrder.assigned_technician_id.in_(tech_ids))
        .group_by(WorkOrder.assigned_technician_id)
        .all()
    )
    counts_map = {row[0]: (row[1], int(row[2] or 0)) for row in counts}

    result = []
    for t in techs:
        total, active = counts_map.get(t.id, (0, 0))
        item = TechnicianDetailResponse.model_validate(t)
        item.assigned_work_orders_count = total
        item.active_work_orders_count = active
        result.append(item)
    return result

@router.post("", response_model=TechnicianDetailResponse, status_code=status.HTTP_201_CREATED)
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
    
    resp = TechnicianDetailResponse.model_validate(tech)
    resp.assigned_work_orders_count = 0
    resp.active_work_orders_count = 0
    return resp

@router.get("/recommendations", response_model=List[TechnicianRecommendationResponse])
def get_recommendations_for_new_work_order(
    asset_id: Optional[int] = Query(None, description="Target asset ID"),
    priority: Optional[str] = Query("MEDIUM", description="Work order priority"),
    maintenance_type_id: Optional[int] = Query(None, description="Maintenance type ID"),
    title: Optional[str] = Query(None, description="Work order title or context"),
    limit: int = Query(3, ge=1, le=20, description="Max recommendations to return"),
    db: Session = Depends(get_db)
):
    """
    Returns deterministic, explainable smart technician recommendations
    suitable for work-order creation or prospective dispatch.
    """
    return get_technician_recommendations(
        db=db,
        asset_id=asset_id,
        priority=priority,
        maintenance_type_id=maintenance_type_id,
        wo_context=title,
        limit=limit
    )

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

@router.patch("/{tech_id}", response_model=TechnicianDetailResponse)
@router.put("/{tech_id}", response_model=TechnicianDetailResponse)
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

    # Deactivation Guardrail: Handle active assignments explicitly
    if "status" in update_data and update_data["status"]:
        new_status = update_data["status"]
        if hasattr(new_status, "value"):
            new_status = new_status.value
        new_status = str(new_status).upper()
        
        # If transitioning from ACTIVE to INACTIVE or ON_LEAVE, check active assignments
        if new_status in ("INACTIVE", "ON_LEAVE") and tech.status == "ACTIVE":
            active_orders = (
                db.query(WorkOrder)
                .filter(
                    WorkOrder.assigned_technician_id == tech_id,
                    WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"])
                )
                .all()
            )
            if active_orders:
                preview = ", ".join([wo.work_order_number for wo in active_orders[:3]])
                more = f" and {len(active_orders) - 3} more" if len(active_orders) > 3 else ""
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Cannot deactivate technician '{tech.name}' ({tech.employee_id}) with {len(active_orders)} active work order assignment(s) "
                        f"({preview}{more}). Reassign or complete all active work orders before changing status to {new_status}."
                    )
                )

    for field, val in update_data.items():
        if val is not None:
            if field == "status" and hasattr(val, "value"):
                val = val.value
            setattr(tech, field, val)
            
    db.commit()
    db.refresh(tech)

    assigned_wo = db.query(WorkOrder).filter(WorkOrder.assigned_technician_id == tech_id).count()
    active_wo = db.query(WorkOrder).filter(
        WorkOrder.assigned_technician_id == tech_id,
        WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"])
    ).count()

    resp = TechnicianDetailResponse.model_validate(tech)
    resp.assigned_work_orders_count = assigned_wo
    resp.active_work_orders_count = active_wo
    return resp

@router.delete("/{tech_id}")
def delete_technician(
    tech_id: int,
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    db: Session = Depends(get_db)
):
    # If administrative authentication is configured via environment, verify credentials
    if settings.ADMIN_API_KEY:
        if not x_admin_key or x_admin_key != settings.ADMIN_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative authorization required to permanently delete technician records."
            )

    tech = db.query(Technician).filter(Technician.id == tech_id).first()
    if not tech:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Technician with ID {tech_id} does not exist."
        )

    # Check all associated work order records (current and historical)
    associated_orders = db.query(WorkOrder).filter(WorkOrder.assigned_technician_id == tech_id).count()
    if associated_orders > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot permanently delete technician '{tech.name}' ({tech.employee_id}) because they are associated with {associated_orders} work order record(s). "
                "Permanent deletion is prohibited to preserve maintenance audit history. Deactivate the technician instead."
            )
        )

    db.delete(tech)
    db.commit()
    return {
        "success": True,
        "message": f"Technician '{tech.name}' ({tech.employee_id}) was permanently deleted successfully."
    }
