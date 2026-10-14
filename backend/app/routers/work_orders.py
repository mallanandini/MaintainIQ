from typing import Optional, List
from datetime import datetime
import io
import csv
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from backend.app.database import get_db
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory
from backend.app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderDetailResponse,
    WorkOrderTransitionRequest,
    WorkOrderStatusHistoryResponse,
    BulkAssignTechnicianRequest,
    BulkAssignTechnicianResponse,
    WorkOrderDuplicateRequest
)
from backend.app.services.work_order_service import (
    create_work_order,
    update_work_order,
    transition_work_order_status,
    bulk_assign_technician,
    duplicate_work_order
)
from backend.app.services.recommendation_service import (
    get_technician_recommendations,
    TechnicianRecommendationResponse
)

router = APIRouter(prefix="/work-orders", tags=["Work Orders"])

def build_work_orders_query(
    db: Session,
    q: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    asset_id: Optional[int] = None,
    technician_id: Optional[int] = None,
    maintenance_type_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    scheduled_start_date: Optional[datetime] = None,
    scheduled_end_date: Optional[datetime] = None,
    is_overdue: Optional[bool] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: Optional[str] = "desc"
):
    now_utc = datetime.utcnow()
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

    if maintenance_type_id:
        query = query.filter(WorkOrder.maintenance_type_id == maintenance_type_id)

    if start_date:
        query = query.filter(WorkOrder.created_at >= start_date)

    if end_date:
        query = query.filter(WorkOrder.created_at <= end_date)

    if scheduled_start_date:
        query = query.filter(WorkOrder.scheduled_date >= scheduled_start_date)

    if scheduled_end_date:
        query = query.filter(WorkOrder.scheduled_date <= scheduled_end_date)

    if is_overdue is not None:
        if is_overdue:
            query = query.filter(
                WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"]),
                WorkOrder.scheduled_date < now_utc
            )
        else:
            query = query.filter(
                or_(
                    WorkOrder.status.in_(["COMPLETED", "CANCELLED"]),
                    WorkOrder.scheduled_date >= now_utc
                )
            )

    sort_map = {
        "created_at": WorkOrder.created_at,
        "scheduled_date": WorkOrder.scheduled_date,
        "work_order_number": WorkOrder.work_order_number,
        "title": WorkOrder.title,
        "priority": WorkOrder.priority,
        "status": WorkOrder.status,
    }
    col = sort_map.get(sort_by, WorkOrder.created_at)
    if sort_order and sort_order.lower() == "asc":
        return query.order_by(col.asc(), WorkOrder.id.asc())
    return query.order_by(col.desc(), WorkOrder.id.desc())


@router.get("", response_model=List[WorkOrderDetailResponse])
def list_work_orders(
    q: Optional[str] = Query(None, description="Search by WO number, title, or description"),
    status: Optional[str] = Query(None, description="Filter by status (OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED)"),
    priority: Optional[str] = Query(None, description="Filter by priority (LOW, MEDIUM, HIGH, CRITICAL)"),
    asset_id: Optional[int] = Query(None, description="Filter by asset ID"),
    technician_id: Optional[int] = Query(None, description="Filter by assigned technician ID"),
    maintenance_type_id: Optional[int] = Query(None, description="Filter by maintenance type ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by created date >= start_date"),
    end_date: Optional[datetime] = Query(None, description="Filter by created date <= end_date"),
    scheduled_start_date: Optional[datetime] = Query(None, description="Filter by scheduled date >= scheduled_start_date"),
    scheduled_end_date: Optional[datetime] = Query(None, description="Filter by scheduled date <= scheduled_end_date"),
    is_overdue: Optional[bool] = Query(None, description="Filter by overdue status"),
    sort_by: Optional[str] = Query("created_at", description="Sort field (created_at, scheduled_date, priority, status, work_order_number, title)"),
    sort_order: Optional[str] = Query("desc", description="Sort direction ('asc' or 'desc')"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Page size for pagination"),
    response: Response = None,
    db: Session = Depends(get_db)
):
    """Lists work orders with comprehensive multi-criteria filtering, sorting, and optional pagination."""
    query = build_work_orders_query(
        db=db,
        q=q,
        status=status,
        priority=priority,
        asset_id=asset_id,
        technician_id=technician_id,
        maintenance_type_id=maintenance_type_id,
        start_date=start_date,
        end_date=end_date,
        scheduled_start_date=scheduled_start_date,
        scheduled_end_date=scheduled_end_date,
        is_overdue=is_overdue,
        sort_by=sort_by,
        sort_order=sort_order
    )
    total_count = query.count()
    if response:
        response.headers["X-Total-Count"] = str(total_count)
        response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    if page is not None and page_size is not None:
        offset = (page - 1) * page_size
        return query.offset(offset).limit(page_size).all()

    return query.all()


@router.get("/export")
def export_work_orders_csv(
    q: Optional[str] = Query(None, description="Search filter"),
    status: Optional[str] = Query(None, description="Status filter"),
    priority: Optional[str] = Query(None, description="Priority filter"),
    asset_id: Optional[int] = Query(None, description="Asset filter"),
    technician_id: Optional[int] = Query(None, description="Technician filter"),
    maintenance_type_id: Optional[int] = Query(None, description="Maintenance type filter"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    scheduled_start_date: Optional[datetime] = Query(None, description="Scheduled start date filter"),
    scheduled_end_date: Optional[datetime] = Query(None, description="Scheduled end date filter"),
    is_overdue: Optional[bool] = Query(None, description="Overdue filter"),
    sort_by: Optional[str] = Query("created_at", description="Sort field"),
    sort_order: Optional[str] = Query("desc", description="Sort direction"),
    db: Session = Depends(get_db)
):
    """Exports filtered work orders to an RFC 4180-compliant CSV file."""
    orders = build_work_orders_query(
        db=db,
        q=q,
        status=status,
        priority=priority,
        asset_id=asset_id,
        technician_id=technician_id,
        maintenance_type_id=maintenance_type_id,
        start_date=start_date,
        end_date=end_date,
        scheduled_start_date=scheduled_start_date,
        scheduled_end_date=scheduled_end_date,
        is_overdue=is_overdue,
        sort_by=sort_by,
        sort_order=sort_order
    ).all()

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Work Order Number",
        "Title",
        "Status",
        "Priority",
        "Maintenance Type",
        "Asset Tag",
        "Asset Name",
        "Asset Category",
        "Asset Location",
        "Assigned Technician",
        "Technician Specialization",
        "Scheduled Date",
        "Created Date",
        "Completed Date",
        "Estimated Hours",
        "Actual Hours",
        "Resolution Summary",
        "Cancellation Reason",
        "Description"
    ])
    for wo in orders:
        completed_date = None
        if wo.status == "COMPLETED":
            for h in (wo.status_history or []):
                if h.to_status == "COMPLETED":
                    completed_date = h.created_at.strftime("%Y-%m-%d %H:%M")
                    break
            if not completed_date and wo.updated_at:
                completed_date = wo.updated_at.strftime("%Y-%m-%d %H:%M")

        writer.writerow([
            wo.work_order_number,
            wo.title,
            wo.status,
            wo.priority,
            wo.maintenance_type.name if wo.maintenance_type else "",
            wo.asset.asset_tag if wo.asset else "",
            wo.asset.name if wo.asset else "",
            wo.asset.category if wo.asset else "",
            wo.asset.location if wo.asset else "",
            wo.technician.name if wo.technician else "Unassigned",
            wo.technician.specialization if wo.technician else "",
            wo.scheduled_date.strftime("%Y-%m-%d %H:%M") if wo.scheduled_date else "",
            wo.created_at.strftime("%Y-%m-%d %H:%M") if wo.created_at else "",
            completed_date or "",
            wo.estimated_hours or 0.0,
            wo.actual_hours if wo.actual_hours is not None else "",
            wo.resolution_summary or "",
            wo.cancellation_reason or "",
            wo.description or ""
        ])

    filename = f"maintainiq_work_orders_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Work order {wo_id} not found.")
    return wo


@router.patch("/{wo_id}", response_model=WorkOrderDetailResponse)
@router.put("/{wo_id}", response_model=WorkOrderDetailResponse)
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


@router.get("/{wo_id}/history", response_model=List[WorkOrderStatusHistoryResponse])
def get_work_order_history(
    wo_id: int,
    order: Optional[str] = Query("asc", description="Sort order: 'asc' (chronological) or 'desc' (reverse chronological)"),
    db: Session = Depends(get_db)
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order with ID {wo_id} not found."
        )

    query = db.query(WorkOrderStatusHistory).filter(WorkOrderStatusHistory.work_order_id == wo_id)
    if order and order.lower() == "desc":
        query = query.order_by(WorkOrderStatusHistory.created_at.desc(), WorkOrderStatusHistory.id.desc())
    else:
        query = query.order_by(WorkOrderStatusHistory.created_at.asc(), WorkOrderStatusHistory.id.asc())

    return query.all()


@router.get("/{wo_id}/technician-recommendations", response_model=List[TechnicianRecommendationResponse])
def get_work_order_technician_recommendations(
    wo_id: int,
    limit: int = Query(3, ge=1, le=20, description="Max recommendations to return"),
    db: Session = Depends(get_db)
):
    """
    Returns deterministic, explainable smart technician recommendations
    for an existing work order.
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order with ID {wo_id} not found."
        )

    return get_technician_recommendations(
        db=db,
        asset_id=wo.asset_id,
        priority=wo.priority,
        maintenance_type_id=wo.maintenance_type_id,
        wo_context=f"{wo.title} {wo.description}",
        exclude_work_order_id=wo.id,
        limit=limit
    )


@router.post("/bulk-assign", response_model=BulkAssignTechnicianResponse)
@router.post("/bulk-assign-technician", response_model=BulkAssignTechnicianResponse)
def bulk_assign_tech(payload: BulkAssignTechnicianRequest, db: Session = Depends(get_db)):
    """
    Safely assigns an active technician to multiple work orders with per-record validation
    and clear partial failure reporting.
    """
    return bulk_assign_technician(db, payload)


@router.post("/{wo_id}/duplicate", response_model=WorkOrderDetailResponse, status_code=status.HTTP_201_CREATED)
def duplicate_wo(
    wo_id: int,
    payload: Optional[WorkOrderDuplicateRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Duplicates an existing work order into a new record with a unique generated
    work order number, revalidating all business creation rules.
    """
    new_wo = duplicate_work_order(db, wo_id, payload)
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.asset),
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.maintenance_type),
            joinedload(WorkOrder.status_history)
        )
        .filter(WorkOrder.id == new_wo.id)
        .first()
    )

