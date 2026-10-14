from typing import Optional, List, Tuple
from datetime import datetime
import io
import csv
from fastapi import HTTPException, status as http_status
from sqlalchemy.orm import Session, joinedload, selectinload
from backend.app.models.asset import Asset
from backend.app.models.work_order import WorkOrder
from backend.app.models.checklist import WorkOrderChecklist
from backend.app.schemas.asset import AssetMaintenanceHistoryItem

def get_asset_maintenance_history(
    db: Session,
    asset_id: int,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Tuple[List[AssetMaintenanceHistoryItem], int]:
    """
    Fetches complete chronological maintenance history for a specific physical asset.
    - Ensures asset exists (returns 404 if nonexistent).
    - Prevents N+1 database queries by eagerly joining maintenance_type, technician, and status_history.
    - Orders records newest first (created_at DESC).
    - Supports optional status, priority, and date-range filtering.
    - Supports optional pagination.
    - Accurately derives completed_date from lifecycle status transition history.
    """
    # 1. Validate that the asset exists
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {asset_id} does not exist."
        )

    # 2. Build filters
    filters = [WorkOrder.asset_id == asset_id]
    if status:
        filters.append(WorkOrder.status == status.upper())
    if priority:
        filters.append(WorkOrder.priority == priority.upper())
    if start_date:
        filters.append(WorkOrder.created_at >= start_date)
    if end_date:
        filters.append(WorkOrder.created_at <= end_date)

    # 3. Total count with filters
    total_count = db.query(WorkOrder).filter(*filters).count()

    # 4. Build eager-loaded query to eliminate N+1 queries
    query = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.maintenance_type),
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.status_history),
            joinedload(WorkOrder.checklist).selectinload(WorkOrderChecklist.items)
        )
        .filter(*filters)
        .order_by(WorkOrder.created_at.desc(), WorkOrder.id.desc())
    )

    # 5. Apply pagination if requested
    if page is not None and page_size is not None:
        query = query.offset((page - 1) * page_size).limit(page_size)
    elif limit is not None:
        if offset is not None:
            query = query.offset(offset)
        query = query.limit(limit)
    elif offset is not None:
        query = query.offset(offset)

    work_orders = query.all()

    # 6. Transform models to response schema with completed_date calculation
    records: List[AssetMaintenanceHistoryItem] = []
    for wo in work_orders:
        completed_date = None
        if wo.status == "COMPLETED":
            for h in (wo.status_history or []):
                if h.to_status == "COMPLETED":
                    completed_date = h.created_at
                    break
            if completed_date is None:
                completed_date = wo.updated_at

        # Checklist association
        has_checklist = bool(wo.checklist)
        checklist_status = None
        checklist_summary = None
        if wo.checklist:
            items = wo.checklist.items or []
            failed = sum(1 for it in items if it.status == "FAIL")
            passed = sum(1 for it in items if it.status == "PASS")
            if failed > 0:
                checklist_status = "FAILED_ITEMS"
                checklist_summary = f"{failed} inspection item(s) failed"
            elif wo.checklist.completed_at:
                checklist_status = "COMPLETED"
                checklist_summary = f"All {passed} items passed"
            else:
                checklist_status = "IN_PROGRESS"
                checklist_summary = f"{passed}/{len(items)} items inspected"

        records.append(
            AssetMaintenanceHistoryItem(
                id=wo.id,
                work_order_number=wo.work_order_number,
                title=wo.title,
                description=wo.description,
                maintenance_type_id=wo.maintenance_type_id,
                maintenance_type=wo.maintenance_type,
                priority=wo.priority,
                status=wo.status,
                assigned_technician_id=wo.assigned_technician_id,
                technician=wo.technician,
                scheduled_date=wo.scheduled_date,
                created_date=wo.created_at,
                created_at=wo.created_at,
                completed_date=completed_date,
                actual_hours=wo.actual_hours,
                estimated_hours=wo.estimated_hours,
                resolution_summary=wo.resolution_summary,
                cancellation_reason=wo.cancellation_reason,
                has_checklist=has_checklist,
                checklist_status=checklist_status,
                checklist_summary=checklist_summary,
            )
        )

    return records, total_count


def generate_asset_maintenance_history_csv(
    asset: Asset,
    records: List[AssetMaintenanceHistoryItem]
) -> str:
    """Generates RFC 4180-compliant CSV for an asset's complete maintenance history."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Work Order Number",
        "Title",
        "Status",
        "Priority",
        "Maintenance Type",
        "Assigned Technician",
        "Scheduled Date",
        "Created Date",
        "Completed Date",
        "Estimated Hours",
        "Actual Hours",
        "Checklist Status",
        "Checklist Summary",
        "Resolution Summary",
        "Cancellation Reason",
        "Description"
    ])
    for r in records:
        writer.writerow([
            r.work_order_number,
            r.title,
            r.status,
            r.priority,
            r.maintenance_type.name if r.maintenance_type else "",
            r.technician.name if r.technician else "Unassigned",
            r.scheduled_date.strftime("%Y-%m-%d %H:%M") if r.scheduled_date else "",
            r.created_date.strftime("%Y-%m-%d %H:%M") if r.created_date else "",
            r.completed_date.strftime("%Y-%m-%d %H:%M") if r.completed_date else "",
            r.estimated_hours or 0.0,
            r.actual_hours if r.actual_hours is not None else "",
            r.checklist_status or "NO_CHECKLIST",
            r.checklist_summary or "",
            r.resolution_summary or "",
            r.cancellation_reason or "",
            r.description or ""
        ])
    return output.getvalue()
