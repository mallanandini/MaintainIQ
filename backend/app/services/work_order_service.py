from datetime import datetime, timedelta
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
    WorkOrderTransitionRequest
)
from backend.app.services.sequence import generate_work_order_number

# Valid lifecycle state transitions as specified in requirements:
# OPEN → ASSIGNED → IN_PROGRESS → COMPLETED
# OPEN → CANCELLED
# ASSIGNED → CANCELLED
# COMPLETED and CANCELLED are terminal states.
VALID_TRANSITIONS = {
    "OPEN": ["ASSIGNED", "CANCELLED"],
    "ASSIGNED": ["IN_PROGRESS", "CANCELLED"],
    "IN_PROGRESS": ["COMPLETED"],
    "COMPLETED": [], # Terminal
    "CANCELLED": []  # Terminal
}

def validate_work_order_creation_rules(db: Session, wo_data: WorkOrderCreate) -> tuple[Asset, MaintenanceType, Optional[Technician]]:
    """
    Validates all mandatory creation business rules:
    - Rule 2: CRITICAL work orders must have an assigned technician.
    - Rule 5: New work orders cannot be scheduled in the past.
    - Rule 6: OUT_OF_SERVICE assets cannot receive new non-emergency work orders.
    """
    now = datetime.utcnow()
    # Rule 5: Cannot be scheduled in the past (allow 60s tolerance for clock skew)
    if wo_data.scheduled_date < (now - timedelta(seconds=60)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rule 5 Violation: New work orders cannot be scheduled in the past."
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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
    if asset.status == "OUT_OF_SERVICE":
        is_emergency = maint_type.is_emergency or maint_type.code == "EMERGENCY" or wo_data.priority == "CRITICAL"
        if not is_emergency:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Rule 6 Violation: Asset '{asset.name}' is OUT_OF_SERVICE and cannot receive new non-emergency work orders. Priority must be CRITICAL or maintenance type EMERGENCY."
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
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Technician '{technician.name}' is {technician.status} and cannot be assigned new work orders."
            )

    # Rule 2: CRITICAL work orders must have an assigned technician
    if wo_data.priority == "CRITICAL" and not wo_data.assigned_technician_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rule 2 Violation: CRITICAL work orders must have an assigned technician."
        )

    return asset, maint_type, technician


def create_work_order(db: Session, wo_data: WorkOrderCreate) -> WorkOrder:
    asset, maint_type, technician = validate_work_order_creation_rules(db, wo_data)

    initial_status = "ASSIGNED" if wo_data.assigned_technician_id else "OPEN"
    
    # Retry loop with sequence lock to guarantee Rule 1 under concurrent transactions
    max_retries = 5
    for attempt in range(max_retries):
        wo_number = generate_work_order_number(db)
        
        work_order = WorkOrder(
            work_order_number=wo_number,
            title=wo_data.title,
            description=wo_data.description,
            asset_id=wo_data.asset_id,
            maintenance_type_id=wo_data.maintenance_type_id,
            priority=wo_data.priority,
            status=initial_status,
            assigned_technician_id=wo_data.assigned_technician_id,
            scheduled_date=wo_data.scheduled_date,
            estimated_hours=wo_data.estimated_hours,
        )
        
        try:
            db.add(work_order)
            db.flush()
            
            # Initial history record
            history = WorkOrderStatusHistory(
                work_order_id=work_order.id,
                from_status=None,
                to_status=initial_status,
                changed_by="System Dispatcher",
                notes=f"Work order created with status {initial_status}."
            )
            db.add(history)
            
            # If asset was operational and order is critical or in maintenance, update asset if appropriate
            if asset.status == "OPERATIONAL" and (wo_data.priority == "CRITICAL" or maint_type.code == "EMERGENCY"):
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
                    detail=f"Concurrency collision generating unique work order number: {str(e)}"
                )


def update_work_order(db: Session, wo_id: int, update_data: WorkOrderUpdate) -> WorkOrder:
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Work order {wo_id} not found.")

    if wo.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot edit work order in terminal state {wo.status}."
        )

    # Determine effective priority and technician
    effective_priority = update_data.priority if update_data.priority is not None else wo.priority
    effective_tech_id = update_data.assigned_technician_id if update_data.assigned_technician_id is not None else wo.assigned_technician_id

    # Rule 2 re-validation: CRITICAL work orders must have an assigned technician
    if effective_priority == "CRITICAL" and not effective_tech_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rule 2 Violation: CRITICAL work orders must have an assigned technician."
        )

    if update_data.assigned_technician_id:
        tech = db.query(Technician).filter(Technician.id == update_data.assigned_technician_id).first()
        if not tech:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned technician not found.")
        if tech.status != "ACTIVE":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Technician {tech.name} is {tech.status}.")

    # Apply updates
    if update_data.title is not None:
        wo.title = update_data.title
    if update_data.description is not None:
        wo.description = update_data.description
    if update_data.priority is not None:
        wo.priority = update_data.priority
    if update_data.assigned_technician_id is not None:
        wo.assigned_technician_id = update_data.assigned_technician_id
        # If order was OPEN and now has tech assigned, move to ASSIGNED
        if wo.status == "OPEN" and wo.assigned_technician_id:
            wo.status = "ASSIGNED"
            db.add(WorkOrderStatusHistory(
                work_order_id=wo.id,
                from_status="OPEN",
                to_status="ASSIGNED",
                changed_by="Dispatcher",
                notes="Assigned technician via work order update."
            ))
    if update_data.scheduled_date is not None:
        wo.scheduled_date = update_data.scheduled_date
    if update_data.estimated_hours is not None:
        wo.estimated_hours = update_data.estimated_hours
    if update_data.actual_hours is not None:
        wo.actual_hours = update_data.actual_hours
    if update_data.resolution_summary is not None:
        wo.resolution_summary = update_data.resolution_summary

    wo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wo)
    return wo


def transition_work_order_status(db: Session, wo_id: int, req: WorkOrderTransitionRequest) -> WorkOrder:
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Work order {wo_id} not found.")

    current = wo.status
    target = req.to_status.upper()

    # Rule 3: COMPLETED work orders cannot return to OPEN (or any other state)
    if current == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rule 3 Violation: COMPLETED work orders cannot return to OPEN or any other state. COMPLETED is a terminal state."
        )

    # Rule 4: CANCELLED work orders cannot move to IN_PROGRESS (or any other state)
    if current == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rule 4 Violation: CANCELLED work orders cannot move to IN_PROGRESS or any other state. CANCELLED is a terminal state."
        )

    allowed_targets = VALID_TRANSITIONS.get(current, [])
    if target not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid transition from {current} to {target}. Valid next states for {current} are: {allowed_targets or 'None (terminal)'}."
        )

    # Business rule: moving to IN_PROGRESS requires an assigned technician
    if target == "IN_PROGRESS" and not wo.assigned_technician_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot start work order without an assigned technician."
        )

    # Rule 2 enforcement: if CRITICAL, technician must remain assigned
    if wo.priority == "CRITICAL" and not wo.assigned_technician_id and target != "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rule 2 Violation: CRITICAL work orders must have an assigned technician."
        )

    # Update state and extra fields
    wo.status = target
    wo.updated_at = datetime.utcnow()
    if req.actual_hours is not None:
        wo.actual_hours = req.actual_hours
    if req.resolution_summary is not None:
        wo.resolution_summary = req.resolution_summary
    if req.cancellation_reason is not None:
        wo.cancellation_reason = req.cancellation_reason

    # Add history
    history = WorkOrderStatusHistory(
        work_order_id=wo.id,
        from_status=current,
        to_status=target,
        changed_by=req.changed_by or "Dispatcher",
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
