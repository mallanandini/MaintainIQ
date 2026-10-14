from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import calendar
import io
import csv
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, extract, desc
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.schemas.analytics import (
    MaintenanceAnalyticsResponse,
    AnalyticsSummary,
    StatusDistributionItem,
    PriorityDistributionItem,
    MonthlyCompletionItem,
    TechnicianWorkloadItem,
    FrequentlyMaintainedAssetItem,
    OverdueMetrics,
    OverdueWorkOrderReportItem,
    TechnicianWorkloadReportItem
)

STATUS_CONFIG = {
    "OPEN": {"label": "Open", "color": "#0284c7"},
    "ASSIGNED": {"label": "Assigned", "color": "#0d9488"},
    "IN_PROGRESS": {"label": "In Progress", "color": "#6366f1"},
    "COMPLETED": {"label": "Completed", "color": "#10b981"},
    "CANCELLED": {"label": "Cancelled", "color": "#f43f5e"},
}

PRIORITY_CONFIG = {
    "LOW": {"label": "Low", "color": "#64748b"},
    "MEDIUM": {"label": "Medium", "color": "#0284c7"},
    "HIGH": {"label": "High", "color": "#f59e0b"},
    "CRITICAL": {"label": "Critical", "color": "#e11d48"},
}

def get_now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

def compute_maintenance_analytics(
    db: Session,
    top_assets_limit: int = 5,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> MaintenanceAnalyticsResponse:
    """
    Executes efficient database aggregation queries to generate comprehensive
    maintenance analytics with optional date-range filtering.
    
    Avoids full-table memory loading by pushing groupings and conditional
    aggregations directly into SQL.
    
    Documented Overdue Rule:
        A work order is classified as OVERDUE if and only if:
        1. Status is non-terminal: status in ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
        2. Scheduled date is strictly before the current UTC time: scheduled_date < now_utc
    """
    now_utc = get_now_utc()

    # Build date range filter conditions
    wo_filters = []
    if start_date is not None:
        wo_filters.append(WorkOrder.created_at >= start_date)
    if end_date is not None:
        wo_filters.append(WorkOrder.created_at <= end_date)

    # 1. Total Counts & Summary Metrics
    total_wo = db.query(func.count(WorkOrder.id)).filter(*wo_filters).scalar() or 0
    total_assets = db.query(func.count(Asset.id)).scalar() or 0
    total_technicians = db.query(func.count(Technician.id)).scalar() or 0
    active_technicians = (
        db.query(func.count(Technician.id))
        .filter(Technician.status == "ACTIVE")
        .scalar() or 0
    )

    # 2. Status Distribution Aggregation
    status_query = db.query(WorkOrder.status, func.count(WorkOrder.id))
    if wo_filters:
        status_query = status_query.filter(*wo_filters)
    status_rows = status_query.group_by(WorkOrder.status).all()

    status_counts: Dict[str, int] = {s: 0 for s in STATUS_CONFIG}
    for st, count in status_rows:
        if st in status_counts:
            status_counts[st] = count

    active_wo = (
        status_counts["OPEN"] +
        status_counts["ASSIGNED"] +
        status_counts["IN_PROGRESS"]
    )
    completed_wo = status_counts["COMPLETED"]
    cancelled_wo = status_counts["CANCELLED"]
    completion_rate = round((completed_wo / total_wo * 100.0), 1) if total_wo > 0 else 0.0
    cancellation_rate = round((cancelled_wo / total_wo * 100.0), 1) if total_wo > 0 else 0.0

    status_distribution: List[StatusDistributionItem] = []
    for st, cfg in STATUS_CONFIG.items():
        cnt = status_counts[st]
        pct = round((cnt / total_wo * 100.0), 1) if total_wo > 0 else 0.0
        status_distribution.append(
            StatusDistributionItem(
                status=st,
                label=cfg["label"],
                count=cnt,
                percentage=pct,
                color=cfg["color"]
            )
        )

    # 3. Priority Distribution Aggregation
    priority_query = db.query(WorkOrder.priority, func.count(WorkOrder.id))
    if wo_filters:
        priority_query = priority_query.filter(*wo_filters)
    priority_rows = priority_query.group_by(WorkOrder.priority).all()

    priority_counts: Dict[str, int] = {p: 0 for p in PRIORITY_CONFIG}
    for pr, count in priority_rows:
        if pr in priority_counts:
            priority_counts[pr] = count

    priority_distribution: List[PriorityDistributionItem] = []
    for pr, cfg in PRIORITY_CONFIG.items():
        cnt = priority_counts[pr]
        pct = round((cnt / total_wo * 100.0), 1) if total_wo > 0 else 0.0
        priority_distribution.append(
            PriorityDistributionItem(
                priority=pr,
                label=cfg["label"],
                count=cnt,
                percentage=pct,
                color=cfg["color"]
            )
        )

    # 4. Overdue Work Orders (Documented Rule Enforcement)
    overdue_base = db.query(func.count(WorkOrder.id)).filter(
        WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"]),
        WorkOrder.scheduled_date < now_utc
    )
    if wo_filters:
        overdue_base = overdue_base.filter(*wo_filters)
    overdue_count = overdue_base.scalar() or 0

    critical_overdue_q = db.query(func.count(WorkOrder.id)).filter(
        WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"]),
        WorkOrder.scheduled_date < now_utc,
        WorkOrder.priority == "CRITICAL"
    )
    if wo_filters:
        critical_overdue_q = critical_overdue_q.filter(*wo_filters)
    critical_overdue = critical_overdue_q.scalar() or 0

    high_overdue_q = db.query(func.count(WorkOrder.id)).filter(
        WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"]),
        WorkOrder.scheduled_date < now_utc,
        WorkOrder.priority == "HIGH"
    )
    if wo_filters:
        high_overdue_q = high_overdue_q.filter(*wo_filters)
    high_overdue = high_overdue_q.scalar() or 0

    overdue_metrics = OverdueMetrics(
        overdue_count=overdue_count,
        critical_overdue_count=critical_overdue,
        high_overdue_count=high_overdue,
        rule_description="Work order has non-terminal status (OPEN, ASSIGNED, or IN_PROGRESS) and target scheduled date is in the past (< UTC now)."
    )

    # 5. Monthly Completed Work Orders (Using Actual Completion Timestamps)
    completed_subq = (
        db.query(
            WorkOrder.id.label("wo_id"),
            func.coalesce(
                func.max(WorkOrderStatusHistory.created_at),
                WorkOrder.updated_at
            ).label("completed_at")
        )
        .outerjoin(
            WorkOrderStatusHistory,
            (WorkOrderStatusHistory.work_order_id == WorkOrder.id) &
            (WorkOrderStatusHistory.to_status == "COMPLETED")
        )
        .filter(WorkOrder.status == "COMPLETED")
    )
    if wo_filters:
        completed_subq = completed_subq.filter(*wo_filters)
    completed_subq = completed_subq.group_by(WorkOrder.id, WorkOrder.updated_at).subquery()

    monthly_rows = (
        db.query(
            extract("year", completed_subq.c.completed_at).label("yr"),
            extract("month", completed_subq.c.completed_at).label("mo"),
            func.count(completed_subq.c.wo_id).label("cnt")
        )
        .group_by(
            extract("year", completed_subq.c.completed_at),
            extract("month", completed_subq.c.completed_at)
        )
        .order_by(
            extract("year", completed_subq.c.completed_at).asc(),
            extract("month", completed_subq.c.completed_at).asc()
        )
        .all()
    )

    monthly_completion_trend: List[MonthlyCompletionItem] = []
    for yr, mo, cnt in monthly_rows:
        if yr is not None and mo is not None:
            yr_int = int(yr)
            mo_int = int(mo)
            month_key = f"{yr_int:04d}-{mo_int:02d}"
            month_abbr = calendar.month_abbr[mo_int]
            label = f"{month_abbr} {yr_int}"
            monthly_completion_trend.append(
                MonthlyCompletionItem(
                    month_key=month_key,
                    label=label,
                    year=yr_int,
                    month=mo_int,
                    completed_count=cnt
                )
            )

    # 6. Technician Workloads (Active & Historical Assignment Metrics)
    tech_rows = (
        db.query(
            Technician.id,
            Technician.name,
            Technician.employee_id,
            Technician.specialization,
            Technician.status,
            func.count(
                case((WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"]), WorkOrder.id), else_=None)
            ).label("active_count"),
            func.count(
                case((WorkOrder.status == "COMPLETED", WorkOrder.id), else_=None)
            ).label("completed_count"),
            func.count(WorkOrder.id).label("total_assigned_count"),
            func.coalesce(
                func.sum(
                    case((WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"]), WorkOrder.estimated_hours), else_=0.0)
                ),
                0.0
            ).label("active_hours")
        )
        .outerjoin(WorkOrder, WorkOrder.assigned_technician_id == Technician.id)
        .group_by(
            Technician.id,
            Technician.name,
            Technician.employee_id,
            Technician.specialization,
            Technician.status
        )
        .order_by(
            func.count(
                case((WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"]), WorkOrder.id), else_=None)
            ).desc(),
            Technician.name.asc()
        )
        .all()
    )

    technician_workloads: List[TechnicianWorkloadItem] = []
    for t_id, name, emp_id, spec, status, act_cnt, comp_cnt, tot_cnt, act_hrs in tech_rows:
        technician_workloads.append(
            TechnicianWorkloadItem(
                technician_id=t_id,
                name=name,
                employee_id=emp_id,
                specialization=spec,
                status=status,
                active_work_orders_count=act_cnt,
                completed_work_orders_count=comp_cnt,
                total_assigned_count=tot_cnt,
                active_estimated_hours=round(float(act_hrs or 0.0), 1)
            )
        )

    # 7. Frequently Maintained Assets (Top Assets by Work Order Frequency)
    asset_query = (
        db.query(
            Asset.id,
            Asset.asset_tag,
            Asset.name,
            Asset.category,
            Asset.criticality,
            func.count(WorkOrder.id).label("total_wo"),
            func.count(case((WorkOrder.status == "COMPLETED", WorkOrder.id), else_=None)).label("comp_wo"),
            func.count(case((WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"]), WorkOrder.id), else_=None)).label("act_wo")
        )
        .join(WorkOrder, WorkOrder.asset_id == Asset.id)
    )
    if wo_filters:
        asset_query = asset_query.filter(*wo_filters)
    asset_rows = (
        asset_query.group_by(
            Asset.id,
            Asset.asset_tag,
            Asset.name,
            Asset.category,
            Asset.criticality
        )
        .order_by(func.count(WorkOrder.id).desc(), Asset.id.asc())
        .limit(top_assets_limit)
        .all()
    )

    frequently_maintained_assets: List[FrequentlyMaintainedAssetItem] = []
    for a_id, tag, name, cat, crit, tot, comp, act in asset_rows:
        frequently_maintained_assets.append(
            FrequentlyMaintainedAssetItem(
                asset_id=a_id,
                asset_tag=tag,
                name=name,
                category=cat,
                criticality=crit,
                total_work_orders=tot,
                completed_work_orders=comp,
                active_work_orders=act
            )
        )

    # 8. Accurate Turnaround & Cancellation Details
    # Average completion duration from creation to completion transition
    comp_durations_q = (
        db.query(
            WorkOrder.created_at,
            func.coalesce(
                func.max(WorkOrderStatusHistory.created_at),
                WorkOrder.updated_at
            ).label("completed_at")
        )
        .outerjoin(
            WorkOrderStatusHistory,
            (WorkOrderStatusHistory.work_order_id == WorkOrder.id) &
            (WorkOrderStatusHistory.to_status == "COMPLETED")
        )
        .filter(WorkOrder.status == "COMPLETED")
    )
    if wo_filters:
        comp_durations_q = comp_durations_q.filter(*wo_filters)
    comp_durations = comp_durations_q.group_by(WorkOrder.id, WorkOrder.created_at, WorkOrder.updated_at).all()

    avg_completion_hours: Optional[float] = None
    if comp_durations:
        durations = [
            (c - o).total_seconds() / 3600.0
            for o, c in comp_durations
            if o is not None and c is not None and c >= o
        ]
        if durations:
            avg_completion_hours = round(sum(durations) / len(durations), 1)

    # Cancellation reasons breakdown
    cancel_q = (
        db.query(WorkOrder.cancellation_reason, func.count(WorkOrder.id))
        .filter(WorkOrder.status == "CANCELLED")
    )
    if wo_filters:
        cancel_q = cancel_q.filter(*wo_filters)
    cancel_rows = cancel_q.group_by(WorkOrder.cancellation_reason).order_by(func.count(WorkOrder.id).desc()).all()
    cancellation_reasons = [
        {"reason": r or "Unspecified cancellation", "count": cnt}
        for r, cnt in cancel_rows
    ]

    summary = AnalyticsSummary(
        total_work_orders=total_wo,
        active_work_orders=active_wo,
        completed_work_orders=completed_wo,
        cancelled_work_orders=cancelled_wo,
        overdue_work_orders=overdue_count,
        completion_rate_percentage=completion_rate,
        cancellation_rate_percentage=cancellation_rate,
        avg_completion_time_hours=avg_completion_hours,
        cancellation_reasons_breakdown=cancellation_reasons,
        total_assets=total_assets,
        total_technicians=total_technicians,
        active_technicians=active_technicians,
        date_range_start=start_date.isoformat() if start_date else None,
        date_range_end=end_date.isoformat() if end_date else None
    )

    return MaintenanceAnalyticsResponse(
        summary=summary,
        status_distribution=status_distribution,
        priority_distribution=priority_distribution,
        monthly_completion_trend=monthly_completion_trend,
        technician_workloads=technician_workloads,
        frequently_maintained_assets=frequently_maintained_assets,
        overdue_metrics=overdue_metrics
    )


def get_overdue_work_orders_report(
    db: Session,
    priority: Optional[str] = None
) -> List[OverdueWorkOrderReportItem]:
    """
    Returns an audited report of all overdue work orders, sorted by criticality
    and days overdue descending.
    """
    now_utc = get_now_utc()
    query = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.asset),
            joinedload(WorkOrder.technician)
        )
        .filter(
            WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"]),
            WorkOrder.scheduled_date < now_utc
        )
    )
    if priority:
        query = query.filter(WorkOrder.priority == priority.upper())

    # Order by priority weight (CRITICAL > HIGH > MEDIUM > LOW) and oldest scheduled date
    priority_order = case(
        (WorkOrder.priority == "CRITICAL", 1),
        (WorkOrder.priority == "HIGH", 2),
        (WorkOrder.priority == "MEDIUM", 3),
        else_=4
    )
    orders = query.order_by(priority_order.asc(), WorkOrder.scheduled_date.asc()).all()

    report_items: List[OverdueWorkOrderReportItem] = []
    for wo in orders:
        days_overdue = max(0, (now_utc - wo.scheduled_date).days)
        report_items.append(
            OverdueWorkOrderReportItem(
                id=wo.id,
                work_order_number=wo.work_order_number,
                title=wo.title,
                priority=wo.priority,
                status=wo.status,
                asset_id=wo.asset_id,
                asset_tag=wo.asset.asset_tag if wo.asset else None,
                asset_name=wo.asset.name if wo.asset else None,
                location=wo.asset.location if wo.asset else None,
                assigned_technician_id=wo.assigned_technician_id,
                technician_name=wo.technician.name if wo.technician else "Unassigned",
                scheduled_date=wo.scheduled_date,
                days_overdue=days_overdue,
                estimated_hours=wo.estimated_hours or 1.0
            )
        )
    return report_items


def generate_overdue_report_csv(items: List[OverdueWorkOrderReportItem]) -> str:
    """Generates RFC 4180-compliant CSV for the overdue work orders report."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Work Order Number",
        "Title",
        "Priority",
        "Status",
        "Asset Tag",
        "Asset Name",
        "Location",
        "Assigned Technician",
        "Scheduled Target Date",
        "Days Overdue",
        "Estimated Hours"
    ])
    for item in items:
        writer.writerow([
            item.work_order_number,
            item.title,
            item.priority,
            item.status,
            item.asset_tag or "",
            item.asset_name or "",
            item.location or "",
            item.technician_name or "Unassigned",
            item.scheduled_date.strftime("%Y-%m-%d %H:%M") if item.scheduled_date else "",
            item.days_overdue,
            item.estimated_hours
        ])
    return output.getvalue()


def get_technician_workload_report(db: Session) -> List[TechnicianWorkloadReportItem]:
    """
    Returns an audited report of all technicians, current active assignments,
    accumulated workload hours, and utilization status.
    """
    technicians = (
        db.query(Technician)
        .options(joinedload(Technician.work_orders))
        .order_by(Technician.name.asc())
        .all()
    )

    report_items: List[TechnicianWorkloadReportItem] = []
    for tech in technicians:
        wos = tech.work_orders or []
        active_wos = [w for w in wos if w.status in ["ASSIGNED", "IN_PROGRESS"]]
        completed_wos = [w for w in wos if w.status == "COMPLETED"]
        active_count = len(active_wos)
        completed_count = len(completed_wos)
        total_assigned = len(wos)
        active_hours = sum(w.estimated_hours or 0.0 for w in active_wos)

        # Capacity utilization tier
        if tech.status != "ACTIVE":
            utilization = "UNAVAILABLE"
        elif active_count == 0:
            utilization = "AVAILABLE"
        elif active_count <= 2 and active_hours <= 10.0:
            utilization = "OPTIMAL"
        elif active_count <= 4 and active_hours <= 25.0:
            utilization = "HEAVY"
        else:
            utilization = "OVERLOADED"

        active_wo_details = [
            {
                "id": w.id,
                "work_order_number": w.work_order_number,
                "title": w.title,
                "priority": w.priority,
                "status": w.status,
                "scheduled_date": w.scheduled_date.isoformat() if w.scheduled_date else None,
                "estimated_hours": w.estimated_hours
            }
            for w in active_wos
        ]

        report_items.append(
            TechnicianWorkloadReportItem(
                technician_id=tech.id,
                employee_id=tech.employee_id,
                name=tech.name,
                specialization=tech.specialization,
                status=tech.status,
                active_work_orders_count=active_count,
                active_estimated_hours=round(active_hours, 1),
                completed_work_orders_count=completed_count,
                total_assigned_count=total_assigned,
                utilization_status=utilization,
                active_work_orders=active_wo_details
            )
        )

    # Sort report: ACTIVE with highest workload first, then others
    report_items.sort(key=lambda x: (x.status == "ACTIVE", x.active_work_orders_count, x.active_estimated_hours), reverse=True)
    return report_items


def generate_technician_workload_csv(items: List[TechnicianWorkloadReportItem]) -> str:
    """Generates RFC 4180-compliant CSV for the technician workload report."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Employee ID",
        "Technician Name",
        "Specialization",
        "Status",
        "Capacity Utilization",
        "Active Work Orders",
        "Active Estimated Hours",
        "Completed Work Orders",
        "Total Assigned Lifetime"
    ])
    for item in items:
        writer.writerow([
            item.employee_id,
            item.name,
            item.specialization,
            item.status,
            item.utilization_status,
            item.active_work_orders_count,
            item.active_estimated_hours,
            item.completed_work_orders_count,
            item.total_assigned_count
        ])
    return output.getvalue()
