from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory
from backend.app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderTransitionRequest,
    BulkAssignTechnicianRequest,
    BulkAssignTechnicianResponse,
    BulkOperationResultItem,
    WorkOrderDuplicateRequest
)
from backend.app.services.sequence import generate_work_order_number

# Complete allowed status transition graph:
# OPEN → ASSIGNED → IN_PROGRESS → COMPLETED
# OPEN → CANCELLED
# ASSIGNED → CANCELLED
# State skipping and backward transitions are strictly forbidden.
# COMPLETED and CANCELLED are terminal states.
VALID_TRANSITIONS = {
    "OPEN": ["ASSIGNED", "CANCELLED"],
    "ASSIGNED": ["IN_PROGRESS", "CANCELLED"],
    "IN_PROGRESS": ["COMPLETED"],
    "COMPLETED": [],  # Terminal
    "CANCELLED": []   # Terminal
}


def normalize_to_utc(dt: datetime) -> datetime:
    """
    Normalizes any datetime to a timezone-naive UTC datetime for consistent comparison and DB storage.
    If the datetime is timezone-aware, converts to UTC and removes tzinfo.
    If naive, assumes UTC.
    """
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def get_now_utc() -> datetime:
    """Returns the current UTC datetime as a naive datetime object."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def validate_work_order_creation_rules(db: Session, wo_data: WorkOrderCreate) -> tuple[Asset, MaintenanceType, Optional[Technician]]:
    """
    Validates all mandatory creation business rules:
    - Rule 2: A CRITICAL work order must have an assigned technician.
    - Rule 5: Newly created work orders cannot have scheduled dates in the past.
    - Rule 6: OUT_OF_SERVICE assets cannot receive new non-emergency work orders (strict boolean check).
    - Entity existence: asset_id (404), maintenance_type_id (404), assigned_technician_id (404).
    - Status constraints: DECOMMISSIONED asset (422), INACTIVE / ON_LEAVE technician (422).
    """
    now_utc = get_now_utc()
    scheduled_utc = normalize_to_utc(wo_data.scheduled_date)

    # Rule 5: Cannot be scheduled in the past (allow 120s tolerance for network/clock skew)
    if scheduled_utc < (now_utc - timedelta(seconds=120)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Rule 5 Violation: Newly created work orders cannot have scheduled dates in the past."
        )

    # Asset existence and status check
    asset = db.query(Asset).filter(Asset.id == wo_data.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {wo_data.asset_id} does not exist."
        )

    if asset.status == "DECOMMISSIONED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Asset '{asset.name}' is DECOMMISSIONED and cannot receive any work orders."
        )

    # Maintenance type check
    maint_type = db.query(MaintenanceType).filter(MaintenanceType.id == wo_data.maintenance_type_id).first()
    if not maint_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance type with ID {wo_data.maintenance_type_id} does not exist."
        )

    # Rule 6: OUT_OF_SERVICE assets cannot receive new non-emergency work orders
    # Emergency eligibility must come strictly from the explicit maintenance-type field `is_emergency`, not keyword matching
    if asset.status == "OUT_OF_SERVICE":
        if not bool(maint_type.is_emergency):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Rule 6 Violation: Asset '{asset.name}' is OUT_OF_SERVICE and cannot receive new non-emergency work orders. Emergency eligibility requires a maintenance type with is_emergency=True."
            )

    # Technician check
    technician = None
    if wo_data.assigned_technician_id:
        technician = db.query(Technician).filter(Technician.id == wo_data.assigned_technician_id).first()
        if not technician:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Technician with ID {wo_data.assigned_technician_id} does not exist."
            )
        if technician.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Technician '{technician.name}' is {technician.status} and cannot be assigned new work orders."
            )

    # Rule 2: CRITICAL work orders must have an assigned technician
    priority_str = wo_data.priority.value if hasattr(wo_data.priority, "value") else str(wo_data.priority)
    if priority_str == "CRITICAL" and not wo_data.assigned_technician_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Rule 2 Violation: A CRITICAL work order must have an assigned technician."
        )

    return asset, maint_type, technician


def create_work_order(db: Session, wo_data: WorkOrderCreate) -> WorkOrder:
    asset, maint_type, technician = validate_work_order_creation_rules(db, wo_data)

    initial_status = "ASSIGNED" if wo_data.assigned_technician_id else "OPEN"
    scheduled_utc = normalize_to_utc(wo_data.scheduled_date)
    priority_str = wo_data.priority.value if hasattr(wo_data.priority, "value") else str(wo_data.priority)

    # Rule 1: Unique work-order numbers
    if wo_data.work_order_number:
        clean_number = wo_data.work_order_number.strip()
        existing = db.query(WorkOrder).filter(WorkOrder.work_order_number == clean_number).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Rule 1 Violation: Work order number '{clean_number}' already exists."
            )

        work_order = WorkOrder(
            work_order_number=clean_number,
            title=wo_data.title.strip(),
            description=wo_data.description.strip(),
            asset_id=wo_data.asset_id,
            maintenance_type_id=wo_data.maintenance_type_id,
            priority=priority_str,
            status=initial_status,
            assigned_technician_id=wo_data.assigned_technician_id,
            scheduled_date=scheduled_utc,
            estimated_hours=wo_data.estimated_hours,
        )

        try:
            db.add(work_order)
            db.flush()

            history = WorkOrderStatusHistory(
                work_order_id=work_order.id,
                from_status=None,
                to_status=initial_status,
                changed_by=None,
                notes=f"Work order created with status {initial_status}."
            )
            db.add(history)

            if asset.status == "OPERATIONAL" and (priority_str == "CRITICAL" or maint_type.is_emergency):
                asset.status = "UNDER_MAINTENANCE"
                db.add(asset)

            db.commit()
            db.refresh(work_order)
            return work_order
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Rule 1 Violation: Work order number '{clean_number}' already exists."
            )

    # Auto-generation loop with retry and sequence locking
    max_retries = 5
    for attempt in range(max_retries):
        wo_number = generate_work_order_number(db)

        work_order = WorkOrder(
            work_order_number=wo_number,
            title=wo_data.title.strip(),
            description=wo_data.description.strip(),
            asset_id=wo_data.asset_id,
            maintenance_type_id=wo_data.maintenance_type_id,
            priority=priority_str,
            status=initial_status,
            assigned_technician_id=wo_data.assigned_technician_id,
            scheduled_date=scheduled_utc,
            estimated_hours=wo_data.estimated_hours,
        )

        try:
            db.add(work_order)
            db.flush()

            history = WorkOrderStatusHistory(
                work_order_id=work_order.id,
                from_status=None,
                to_status=initial_status,
                changed_by=None,
                notes=f"Work order created with status {initial_status}."
            )
            db.add(history)

            if asset.status == "OPERATIONAL" and (priority_str == "CRITICAL" or maint_type.is_emergency):
                asset.status = "UNDER_MAINTENANCE"
                db.add(asset)

            db.commit()
            db.refresh(work_order)
            return work_order
        except IntegrityError as e:
            db.rollback()
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Rule 1 Violation: Concurrency collision generating unique work order number: {str(e)}"
                )


def update_work_order(db: Session, wo_id: int, update_data: WorkOrderUpdate) -> WorkOrder:
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order {wo_id} not found."
        )

    # Terminal state check: COMPLETED and CANCELLED cannot be updated
    if wo.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Cannot edit work order in terminal state {wo.status}."
        )

    # Determine effective priority and technician
    raw_priority = update_data.priority.value if hasattr(update_data.priority, "value") else update_data.priority
    effective_priority = raw_priority if raw_priority is not None else wo.priority
    tech_provided = "assigned_technician_id" in update_data.model_fields_set
    effective_tech_id = update_data.assigned_technician_id if tech_provided else wo.assigned_technician_id

    # Rule 2: CRITICAL work orders must have an assigned technician
    if str(effective_priority) == "CRITICAL" and not effective_tech_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Rule 2 Violation: A CRITICAL work order must have an assigned technician."
        )

    # Validate technician existence and active status if specified
    if tech_provided and update_data.assigned_technician_id is not None:
        tech = db.query(Technician).filter(Technician.id == update_data.assigned_technician_id).first()
        if not tech:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Technician with ID {update_data.assigned_technician_id} does not exist."
            )
        if tech.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Technician '{tech.name}' is {tech.status} and cannot be assigned."
            )

    # Validate scheduled_date if updated (Rule 5 prevention against bypassing via update)
    if update_data.scheduled_date is not None:
        scheduled_utc = normalize_to_utc(update_data.scheduled_date)
        now_utc = get_now_utc()
        if scheduled_utc < (now_utc - timedelta(seconds=120)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Rule 5 Violation: Scheduled date cannot be updated to a date in the past."
            )
        wo.scheduled_date = scheduled_utc

    # Apply updates
    if update_data.title is not None:
        wo.title = update_data.title.strip()
    if update_data.description is not None:
        wo.description = update_data.description.strip()
    if update_data.priority is not None:
        wo.priority = str(effective_priority)
    if tech_provided:
        wo.assigned_technician_id = update_data.assigned_technician_id
        # If order was OPEN and technician is newly assigned, advance to ASSIGNED
        if wo.status == "OPEN" and wo.assigned_technician_id:
            wo.status = "ASSIGNED"
            db.add(WorkOrderStatusHistory(
                work_order_id=wo.id,
                from_status="OPEN",
                to_status="ASSIGNED",
                changed_by=None,
                notes="Assigned technician via work order update."
            ))
    if update_data.estimated_hours is not None:
        wo.estimated_hours = update_data.estimated_hours
    if update_data.actual_hours is not None:
        wo.actual_hours = update_data.actual_hours
    if update_data.resolution_summary is not None:
        wo.resolution_summary = update_data.resolution_summary

    wo.updated_at = get_now_utc()
    db.commit()
    db.refresh(wo)
    return wo


def transition_work_order_status(db: Session, wo_id: int, req: WorkOrderTransitionRequest) -> WorkOrder:
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order {wo_id} not found."
        )

    current = wo.status
    target = req.to_status.value if hasattr(req.to_status, "value") else str(req.to_status).upper()

    # Rule 3: COMPLETED work orders cannot transition to OPEN or any other state
    if current == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Rule 3 Violation: COMPLETED work orders cannot transition to OPEN or any other state. COMPLETED is a terminal state."
        )

    # Rule 4: CANCELLED work orders cannot transition to IN_PROGRESS or any other state
    if current == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Rule 4 Violation: CANCELLED work orders cannot transition to IN_PROGRESS or any other state. CANCELLED is a terminal state."
        )

    # Repeating the same status creates no duplicate transition event
    if target == current:
        return wo

    # Allowed status transition graph
    allowed_targets = VALID_TRANSITIONS.get(current, [])
    if target not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid transition from {current} to {target}. Valid next states for {current} are: {allowed_targets or 'None (terminal)'}."
        )

    # Business rule: moving to IN_PROGRESS requires an assigned technician
    if target == "IN_PROGRESS" and not wo.assigned_technician_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Cannot start work order without an assigned technician."
        )

    # Rule 2 enforcement: if CRITICAL, technician must remain assigned unless cancelled
    if wo.priority == "CRITICAL" and not wo.assigned_technician_id and target != "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Rule 2 Violation: A CRITICAL work order must have an assigned technician."
        )

    # Completion conditions validation when moving to COMPLETED
    if target == "COMPLETED":
        from backend.app.models.checklist import WorkOrderChecklist
        checklist = db.query(WorkOrderChecklist).filter(WorkOrderChecklist.work_order_id == wo.id).first()
        if checklist:
            items = checklist.items or []
            failed_required = sum(1 for it in items if it.is_required and it.status == "FAIL")
            if failed_required > 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Cannot complete work order {wo.work_order_number}: {failed_required} required digital inspection checklist item(s) failed inspection."
                )
            pending_required = sum(1 for it in items if it.is_required and it.status == "PENDING")
            if pending_required > 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Cannot complete work order {wo.work_order_number}: {pending_required} required digital inspection checklist item(s) are pending verification."
                )

    # Actor extraction: do not invent fake identities when authentication is absent
    actor = None
    if req.changed_by and req.changed_by.strip():
        actor = req.changed_by.strip()
    elif req.actor_id and req.actor_id.strip():
        actor = req.actor_id.strip()

    # Execute status change and history record atomically within the same transaction
    try:
        wo.status = target
        wo.updated_at = get_now_utc()
        if req.actual_hours is not None:
            wo.actual_hours = req.actual_hours
        if req.resolution_summary is not None:
            wo.resolution_summary = req.resolution_summary
        if req.cancellation_reason is not None:
            wo.cancellation_reason = req.cancellation_reason

        # Add history record
        history = WorkOrderStatusHistory(
            work_order_id=wo.id,
            from_status=current,
            to_status=target,
            changed_by=actor,
            notes=req.notes or f"Transitioned from {current} to {target}."
        )
        db.add(history)

        # Asset state maintenance side effects
        if target == "IN_PROGRESS" and wo.asset.status == "OPERATIONAL":
            wo.asset.status = "UNDER_MAINTENANCE"
            db.add(wo.asset)
        elif target == "COMPLETED" and wo.asset.status == "UNDER_MAINTENANCE":
            # Check if any other active work orders exist for this asset
            other_active = db.query(WorkOrder).filter(
                WorkOrder.asset_id == wo.asset_id,
                WorkOrder.id != wo.id,
                WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"])
            ).count()
            if other_active == 0:
                wo.asset.status = "OPERATIONAL"
                db.add(wo.asset)

        db.commit()
        db.refresh(wo)
        return wo
    except Exception:
        db.rollback()
        raise


def bulk_assign_technician(db: Session, req: BulkAssignTechnicianRequest) -> BulkAssignTechnicianResponse:
    """
    Safely assigns an active technician to multiple work orders with per-record
    validation and clear partial-failure reporting.
    """
    technician = db.query(Technician).filter(Technician.id == req.technician_id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Technician with ID {req.technician_id} does not exist."
        )
    if technician.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Technician '{technician.name}' is {technician.status} and cannot be assigned work orders."
        )

    results: List[BulkOperationResultItem] = []
    success_count = 0
    failure_count = 0

    for wo_id in req.work_order_ids:
        wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
        if not wo:
            results.append(BulkOperationResultItem(
                work_order_id=wo_id,
                work_order_number=None,
                success=False,
                error=f"Work order with ID {wo_id} not found."
            ))
            failure_count += 1
            continue

        # Terminal state check
        if wo.status in ("COMPLETED", "CANCELLED"):
            results.append(BulkOperationResultItem(
                work_order_id=wo.id,
                work_order_number=wo.work_order_number,
                success=False,
                error=f"Work order {wo.work_order_number} is in terminal status ({wo.status}) and cannot be reassigned."
            ))
            failure_count += 1
            continue

        # Decommissioned asset check
        if wo.asset and wo.asset.status == "DECOMMISSIONED":
            results.append(BulkOperationResultItem(
                work_order_id=wo.id,
                work_order_number=wo.work_order_number,
                success=False,
                error=f"Asset '{wo.asset.name}' is DECOMMISSIONED and cannot receive updates."
            ))
            failure_count += 1
            continue

        old_status = wo.status
        new_status = "ASSIGNED" if old_status == "OPEN" else old_status

        try:
            wo.assigned_technician_id = technician.id
            wo.status = new_status
            wo.updated_at = get_now_utc()

            history = WorkOrderStatusHistory(
                work_order_id=wo.id,
                from_status=old_status,
                to_status=new_status,
                notes=f"Bulk technician assignment: assigned to {technician.name} ({technician.employee_id})."
            )
            db.add(history)
            db.commit()
            db.refresh(wo)

            results.append(BulkOperationResultItem(
                work_order_id=wo.id,
                work_order_number=wo.work_order_number,
                success=True,
                error=None
            ))
            success_count += 1
        except Exception as e:
            db.rollback()
            results.append(BulkOperationResultItem(
                work_order_id=wo.id,
                work_order_number=wo.work_order_number,
                success=False,
                error=str(e)
            ))
            failure_count += 1

    return BulkAssignTechnicianResponse(
        total_requested=len(req.work_order_ids),
        success_count=success_count,
        failure_count=failure_count,
        results=results
    )


def duplicate_work_order(db: Session, wo_id: int, req: Optional[WorkOrderDuplicateRequest] = None) -> WorkOrder:
    """
    Duplicates an existing work order into a new record with a unique generated
    work order number, revalidating all business creation rules.
    """
    original = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order with ID {wo_id} not found."
        )

    now_utc = get_now_utc()

    # Scheduled date calculation: must be strictly in the future (Rule 5)
    target_scheduled_date: datetime
    if req and req.scheduled_date is not None:
        target_scheduled_date = req.scheduled_date
    elif original.scheduled_date > now_utc:
        target_scheduled_date = original.scheduled_date
    else:
        # Default to tomorrow at 09:00 UTC if original was in the past
        tomorrow = now_utc + timedelta(days=1)
        target_scheduled_date = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)

    fields_set = req.model_fields_set if req else set()
    title = req.title.strip() if req and req.title else f"{original.title} (Copy)"
    description = req.description.strip() if req and req.description else original.description
    priority = req.priority if req and req.priority else original.priority
    assigned_tech_id = req.assigned_technician_id if "assigned_technician_id" in fields_set else original.assigned_technician_id
    estimated_hours = req.estimated_hours if ("estimated_hours" in fields_set and req.estimated_hours is not None) else (original.estimated_hours or 1.0)

    create_payload = WorkOrderCreate(
        title=title,
        description=description,
        asset_id=original.asset_id,
        maintenance_type_id=original.maintenance_type_id,
        priority=priority,
        assigned_technician_id=assigned_tech_id,
        scheduled_date=target_scheduled_date,
        estimated_hours=estimated_hours
    )

    new_wo = create_work_order(db, create_payload)

    # Record duplication provenance in status history
    try:
        history = WorkOrderStatusHistory(
            work_order_id=new_wo.id,
            from_status=None,
            to_status=new_wo.status,
            notes=f"Duplicated from work order {original.work_order_number}."
        )
        db.add(history)
        db.commit()
        db.refresh(new_wo)
    except Exception:
        db.rollback()

    return new_wo

