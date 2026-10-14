from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database import get_db
from backend.app.models.work_order import WorkOrder
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.schemas.analytics import (
    MaintenanceAnalyticsResponse,
    OverdueWorkOrderReportItem,
    TechnicianWorkloadReportItem
)
from backend.app.services.analytics_service import (
    compute_maintenance_analytics,
    get_overdue_work_orders_report,
    generate_overdue_report_csv,
    get_technician_workload_report,
    generate_technician_workload_csv
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/analytics", response_model=MaintenanceAnalyticsResponse)
def get_maintenance_analytics(
    top_assets_limit: int = Query(5, ge=1, le=50, description="Number of top maintained assets to return"),
    start_date: Optional[datetime] = Query(None, description="Start date filter for reporting period"),
    end_date: Optional[datetime] = Query(None, description="End date filter for reporting period"),
    db: Session = Depends(get_db)
):
    """
    Returns comprehensive maintenance analytics:
    - Status & Priority distributions
    - Monthly completed trend using actual completion timestamps
    - Documented overdue metrics
    - Technician workloads and active tasks
    - Most frequently maintained assets
    - Accurate completion & cancellation rates, plus average completion turnaround hours
    """
    return compute_maintenance_analytics(
        db=db,
        top_assets_limit=top_assets_limit,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/reports/overdue", response_model=List[OverdueWorkOrderReportItem])
def get_overdue_report(
    priority: Optional[str] = Query(None, description="Optional priority filter (LOW, MEDIUM, HIGH, CRITICAL)"),
    db: Session = Depends(get_db)
):
    """Returns an audited list of overdue work orders with days overdue."""
    return get_overdue_work_orders_report(db=db, priority=priority)

@router.get("/reports/overdue/export")
def export_overdue_report(
    priority: Optional[str] = Query(None, description="Optional priority filter"),
    db: Session = Depends(get_db)
):
    """Exports overdue work orders report to CSV."""
    items = get_overdue_work_orders_report(db=db, priority=priority)
    csv_data = generate_overdue_report_csv(items)
    filename = f"maintainiq_overdue_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/reports/technician-workload", response_model=List[TechnicianWorkloadReportItem])
def get_technician_workload_report_endpoint(db: Session = Depends(get_db)):
    """Returns technician capacity, active workload hours, and assignment summary."""
    return get_technician_workload_report(db=db)

@router.get("/reports/technician-workload/export")
def export_technician_workload_report(db: Session = Depends(get_db)):
    """Exports technician workload report to CSV."""
    items = get_technician_workload_report(db=db)
    csv_data = generate_technician_workload_csv(items)
    filename = f"maintainiq_technician_workload_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()

    # Work order status counts
    open_count = db.query(WorkOrder).filter(WorkOrder.status == "OPEN").count()
    assigned_count = db.query(WorkOrder).filter(WorkOrder.status == "ASSIGNED").count()
    in_progress_count = db.query(WorkOrder).filter(WorkOrder.status == "IN_PROGRESS").count()
    completed_count = db.query(WorkOrder).filter(WorkOrder.status == "COMPLETED").count()
    cancelled_count = db.query(WorkOrder).filter(WorkOrder.status == "CANCELLED").count()
    total_wo = db.query(WorkOrder).count()

    # Priority counts
    critical_count = db.query(WorkOrder).filter(
        WorkOrder.priority == "CRITICAL",
        WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"])
    ).count()

    high_count = db.query(WorkOrder).filter(
        WorkOrder.priority == "HIGH",
        WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"])
    ).count()

    # Overdue count
    overdue_count = db.query(WorkOrder).filter(
        WorkOrder.scheduled_date < now,
        WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"])
    ).count()

    # Asset stats
    total_assets = db.query(Asset).count()
    out_of_service_assets = db.query(Asset).filter(Asset.status == "OUT_OF_SERVICE").count()
    under_maintenance_assets = db.query(Asset).filter(Asset.status == "UNDER_MAINTENANCE").count()
    operational_assets = db.query(Asset).filter(Asset.status == "OPERATIONAL").count()

    # Technicians stats
    total_technicians = db.query(Technician).count()
    active_technicians = db.query(Technician).filter(Technician.status == "ACTIVE").count()

    return {
        "work_orders": {
            "total": total_wo,
            "open": open_count,
            "assigned": assigned_count,
            "in_progress": in_progress_count,
            "completed": completed_count,
            "cancelled": cancelled_count,
            "active": open_count + assigned_count + in_progress_count,
            "critical_active": critical_count,
            "high_active": high_count,
            "overdue": overdue_count
        },
        "assets": {
            "total": total_assets,
            "operational": operational_assets,
            "under_maintenance": under_maintenance_assets,
            "out_of_service": out_of_service_assets
        },
        "technicians": {
            "total": total_technicians,
            "active": active_technicians
        }
    }
