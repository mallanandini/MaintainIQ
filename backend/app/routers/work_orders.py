from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from backend.app.database import get_db
from backend.app.models.work_order import WorkOrder
from backend.app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderDetailResponse,
    WorkOrderTransitionRequest
)
from backend.app.services.work_order_service import (
    create_work_order,
    update_work_order,
    transition_work_order_status
)

router = APIRouter(prefix="/work-orders", tags=["Work Orders"])

@router.get("", response_model=List[WorkOrderDetailResponse])
def list_work_orders(
    q: Optional[str] = Query(None, description="Search by WO number, title, or description"),
    status: Optional[str] = Query(None, description="Filter by status (OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED)"),
    priority: Optional[str] = Query(None, description="Filter by priority (LOW, MEDIUM, HIGH, CRITICAL)"),
    asset_id: Optional[int] = Query(None, description="Filter by asset ID"),
    technician_id: Optional[int] = Query(None, description="Filter by assigned technician ID"),
    db: Session = Depends(get_db)
):
    query = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.asset),
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.maintenance_type),
            joinedload(WorkOrder.status_history)
        )
    )

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                WorkOrder.work_order_number.ilike(term),
                WorkOrder.title.ilike(term),
                WorkOrder.description.ilike(term)
            )
        )

    if status:
        query = query.filter(WorkOrder.status == status.upper())

    if priority:
        query = query.filter(WorkOrder.priority == priority.upper())

    if asset_id:
        query = query.filter(WorkOrder.asset_id == asset_id)

    if technician_id:
        query = query.filter(WorkOrder.assigned_technician_id == technician_id)

    return query.order_by(WorkOrder.created_at.desc()).all()


@router.post("", response_model=WorkOrderDetailResponse, status_code=status.HTTP_201_CREATED)
def create_new_work_order(payload: WorkOrderCreate, db: Session = Depends(get_db)):
    wo = create_work_order(db, payload)
    # Refresh with relationships loaded
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.asset),
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.maintenance_type),
            joinedload(WorkOrder.status_history)
        )
        .filter(WorkOrder.id == wo.id)
        .first()
    )


@router.get("/{wo_id}", response_model=WorkOrderDetailResponse)
def get_work_order_detail(wo_id: int, db: Session = Depends(get_db)):
    wo = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.asset),
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.maintenance_type),
            joinedload(WorkOrder.status_history)
        )
        .filter(WorkOrder.id == wo_id)
        .first()
    )
    if not wo:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Work order {wo_id} not found.")
    return wo


@router.patch("/{wo_id}", response_model=WorkOrderDetailResponse)
def update_work_order_details(wo_id: int, payload: WorkOrderUpdate, db: Session = Depends(get_db)):
    wo = update_work_order(db, wo_id, payload)
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.asset),
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.maintenance_type),
            joinedload(WorkOrder.status_history)
        )
        .filter(WorkOrder.id == wo.id)
        .first()
    )


@router.post("/{wo_id}/transition", response_model=WorkOrderDetailResponse)
def transition_work_order(wo_id: int, payload: WorkOrderTransitionRequest, db: Session = Depends(get_db)):
    wo = transition_work_order_status(db, wo_id, payload)
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.asset),
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.maintenance_type),
            joinedload(WorkOrder.status_history)
        )
        .filter(WorkOrder.id == wo.id)
        .first()
    )
