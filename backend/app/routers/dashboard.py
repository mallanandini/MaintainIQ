from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database import get_db
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

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
