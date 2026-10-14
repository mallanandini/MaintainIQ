import os
import sys
from datetime import datetime, timezone, timedelta
import pytest
from unittest.mock import patch
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory
from backend.app.services.work_order_service import transition_work_order_status
from backend.app.schemas.work_order import WorkOrderTransitionRequest, WorkOrderStatus

def _create_open_work_order(client, db_session, priority="MEDIUM"):
    """Helper to create a fresh work order in OPEN status (unassigned)."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    res = client.post("/api/work-orders", json={
        "title": "Air Handler Filter Service",
        "description": "Routine diagnostic and replacement",
        "asset_id": asset.id,
        "maintenance_type_id": maint.id,
        "priority": priority,
        "assigned_technician_id": None,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 2.5
    })
    assert res.status_code == 201
    assert res.json()["status"] == "OPEN"
    return res.json()


def test_valid_transitions_create_exactly_one_history_record_each(client, db_session):
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()
    wo_data = _create_open_work_order(client, db_session)
    wo_id = wo_data["id"]

    # On creation, exactly 1 initial history record exists (None -> OPEN)
    res_initial = client.get(f"/api/work-orders/{wo_id}/history")
    assert res_initial.status_code == 200
    initial_history = res_initial.json()
    assert len(initial_history) == 1
    assert initial_history[0]["from_status"] is None
    assert initial_history[0]["previous_status"] is None
    assert initial_history[0]["to_status"] == "OPEN"
    assert initial_history[0]["new_status"] == "OPEN"

    # Step 1: OPEN -> ASSIGNED (Assign technician via PATCH or Transition)
    res_assign = client.patch(f"/api/work-orders/{wo_id}", json={
        "assigned_technician_id": tech.id
    })
    assert res_assign.status_code == 200
    assert res_assign.json()["status"] == "ASSIGNED"

    h1 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h1) == 2
    assert h1[1]["from_status"] == "OPEN"
    assert h1[1]["previous_status"] == "OPEN"
    assert h1[1]["to_status"] == "ASSIGNED"
    assert h1[1]["new_status"] == "ASSIGNED"

    # Step 2: ASSIGNED -> IN_PROGRESS
    res_step2 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "IN_PROGRESS",
        "notes": "Work commenced on site"
    })
    assert res_step2.status_code == 200
    assert res_step2.json()["status"] == "IN_PROGRESS"

    h2 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h2) == 3
    assert h2[2]["from_status"] == "ASSIGNED"
    assert h2[2]["previous_status"] == "ASSIGNED"
    assert h2[2]["to_status"] == "IN_PROGRESS"
    assert h2[2]["new_status"] == "IN_PROGRESS"
    assert h2[2]["notes"] == "Work commenced on site"

    # Step 3: IN_PROGRESS -> COMPLETED
    res_step3 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "COMPLETED",
        "notes": "Testing and sign-off complete",
        "actual_hours": 3.0,
        "resolution_summary": "Replaced air filter and balanced blower motor."
    })
    assert res_step3.status_code == 200
    assert res_step3.json()["status"] == "COMPLETED"

    h3 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h3) == 4
    assert h3[3]["from_status"] == "IN_PROGRESS"
    assert h3[3]["previous_status"] == "IN_PROGRESS"
    assert h3[3]["to_status"] == "COMPLETED"
    assert h3[3]["new_status"] == "COMPLETED"
    assert h3[3]["notes"] == "Testing and sign-off complete"


def test_invalid_transitions_create_no_history_record(client, db_session):
    wo_data = _create_open_work_order(client, db_session)
    wo_id = wo_data["id"]

    initial_h = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(initial_h) == 1

    # Forbidden jump: OPEN -> COMPLETED (cannot skip ASSIGNED and IN_PROGRESS)
    res_invalid1 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "Attempting illegal jump"
    })
    assert res_invalid1.status_code in [400, 422]
    assert "Invalid transition" in res_invalid1.json()["detail"] or "Rule" in res_invalid1.json()["detail"]

    h_after_fail1 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h_after_fail1) == 1

    # Forbidden jump: OPEN -> IN_PROGRESS (cannot skip ASSIGNED)
    res_invalid2 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "IN_PROGRESS"
    })
    assert res_invalid2.status_code in [400, 422]

    h_after_fail2 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h_after_fail2) == 1

    # Transition to CANCELLED (valid: OPEN -> CANCELLED)
    res_cancel = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "CANCELLED",
        "cancellation_reason": "No longer needed"
    })
    assert res_cancel.status_code == 200
    h_cancelled = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h_cancelled) == 2

    # Forbidden jump: CANCELLED -> OPEN or IN_PROGRESS (terminal state)
    res_invalid3 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "OPEN"
    })
    assert res_invalid3.status_code in [400, 422]
    assert "terminal state" in res_invalid3.json()["detail"].lower()

    res_invalid4 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "IN_PROGRESS"
    })
    assert res_invalid4.status_code in [400, 422]

    h_after_fail3 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h_after_fail3) == 2


def test_repeating_same_status_creates_no_duplicate_transition_event(client, db_session):
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()
    wo_data = _create_open_work_order(client, db_session)
    wo_id = wo_data["id"]

    # History has 1 initial record
    h0 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h0) == 1

    # Transition to OPEN again (no-op)
    res_same1 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "OPEN",
        "notes": "Redundant transition call"
    })
    assert res_same1.status_code == 200
    assert res_same1.json()["status"] == "OPEN"

    # History should still only have 1 record
    h1 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h1) == 1

    # Advance to ASSIGNED
    res_assign = client.patch(f"/api/work-orders/{wo_id}", json={
        "assigned_technician_id": tech.id
    })
    assert res_assign.status_code == 200
    assert res_assign.json()["status"] == "ASSIGNED"

    h2 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h2) == 2

    # Transition to ASSIGNED again (repeating same status)
    res_same2 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "ASSIGNED",
        "notes": "Repeated transition call"
    })
    assert res_same2.status_code == 200
    assert res_same2.json()["status"] == "ASSIGNED"

    h3 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert len(h3) == 2


def test_database_rollback_prevents_partial_updates(db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    
    wo = WorkOrder(
        work_order_number="WO-TEST-ATOMIC-01",
        title="Atomic Test Order",
        description="Testing atomic rollback on failure",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="OPEN",
        scheduled_date=datetime.now(timezone.utc) + timedelta(days=2),
        estimated_hours=1.0
    )
    db_session.add(wo)
    db_session.commit()
    db_session.refresh(wo)

    # Initial history record
    init_hist = WorkOrderStatusHistory(
        work_order_id=wo.id,
        from_status=None,
        to_status="OPEN",
        notes="Initial creation"
    )
    db_session.add(init_hist)
    db_session.commit()

    req = WorkOrderTransitionRequest(
        to_status=WorkOrderStatus.CANCELLED,
        cancellation_reason="Attempting transition that will fail during commit"
    )

    # Simulate an unexpected database error during db.commit() within transition_work_order_status
    with patch.object(db_session, "commit", side_effect=RuntimeError("Simulated DB connection drop")):
        with pytest.raises(RuntimeError, match="Simulated DB connection drop"):
            transition_work_order_status(db_session, wo.id, req)

    # Refresh work order from database; ensure status was rolled back and is still OPEN
    db_session.expire_all()
    reloaded_wo = db_session.query(WorkOrder).filter(WorkOrder.id == wo.id).first()
    assert reloaded_wo.status == "OPEN"

    # Ensure no partial history records were persisted
    history_records = db_session.query(WorkOrderStatusHistory).filter(
        WorkOrderStatusHistory.work_order_id == wo.id
    ).all()
    assert len(history_records) == 1
    assert history_records[0].to_status == "OPEN"


def test_history_is_returned_in_correct_order(client, db_session):
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()
    wo_data = _create_open_work_order(client, db_session)
    wo_id = wo_data["id"]

    # OPEN -> ASSIGNED
    client.patch(f"/api/work-orders/{wo_id}", json={"assigned_technician_id": tech.id})
    # ASSIGNED -> IN_PROGRESS
    client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "IN_PROGRESS"})
    # IN_PROGRESS -> COMPLETED
    client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "All checks passed"
    })

    # Default sort (or order=asc): chronological (oldest to newest)
    res_asc = client.get(f"/api/work-orders/{wo_id}/history?order=asc")
    assert res_asc.status_code == 200
    asc_records = res_asc.json()
    assert len(asc_records) == 4
    assert asc_records[0]["to_status"] == "OPEN"
    assert asc_records[1]["to_status"] == "ASSIGNED"
    assert asc_records[2]["to_status"] == "IN_PROGRESS"
    assert asc_records[3]["to_status"] == "COMPLETED"

    # Default without param should also be chronological (ascending)
    res_default = client.get(f"/api/work-orders/{wo_id}/history")
    assert res_default.status_code == 200
    default_records = res_default.json()
    assert [r["to_status"] for r in default_records] == ["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED"]

    # Reverse sort (order=desc): reverse chronological (newest to oldest)
    res_desc = client.get(f"/api/work-orders/{wo_id}/history?order=desc")
    assert res_desc.status_code == 200
    desc_records = res_desc.json()
    assert len(desc_records) == 4
    assert desc_records[0]["to_status"] == "COMPLETED"
    assert desc_records[1]["to_status"] == "IN_PROGRESS"
    assert desc_records[2]["to_status"] == "ASSIGNED"
    assert desc_records[3]["to_status"] == "OPEN"


def test_actor_information_handling_when_auth_absent_vs_provided(client, db_session):
    wo_data = _create_open_work_order(client, db_session)
    wo_id = wo_data["id"]

    # Initial record created without auth: changed_by and actor_id must be None (no fake identities!)
    res_init = client.get(f"/api/work-orders/{wo_id}/history")
    init_hist = res_init.json()[0]
    assert init_hist["changed_by"] is None
    assert init_hist["actor_id"] is None

    # Transition without changed_by: actor info remains None
    res_trans1 = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "CANCELLED",
        "cancellation_reason": "Cancellation without specifying actor"
    })
    assert res_trans1.status_code == 200

    h1 = client.get(f"/api/work-orders/{wo_id}/history").json()
    assert h1[1]["changed_by"] is None
    assert h1[1]["actor_id"] is None

    # Another work order with explicit actor info: actor info preserved genuinely
    wo2_data = _create_open_work_order(client, db_session)
    wo2_id = wo2_data["id"]

    res_trans2 = client.post(f"/api/work-orders/{wo2_id}/transition", json={
        "to_status": "CANCELLED",
        "changed_by": "Dispatcher Sarah Connor",
        "cancellation_reason": "Facility power shutdown"
    })
    assert res_trans2.status_code == 200

    h2 = client.get(f"/api/work-orders/{wo2_id}/history").json()
    assert h2[1]["changed_by"] == "Dispatcher Sarah Connor"
    assert h2[1]["actor_id"] == "Dispatcher Sarah Connor"


def test_history_for_nonexistent_work_order_returns_404(client):
    res = client.get("/api/work-orders/999999/history")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_history_immutability_endpoints(client, db_session):
    wo_data = _create_open_work_order(client, db_session)
    wo_id = wo_data["id"]

    # Ensure ordinary workflows cannot update or delete history records
    res_put = client.put(f"/api/work-orders/{wo_id}/history", json={"notes": "Tampered"})
    assert res_put.status_code in [404, 405]

    res_patch = client.patch(f"/api/work-orders/{wo_id}/history", json={"notes": "Tampered"})
    assert res_patch.status_code in [404, 405]

    res_delete = client.delete(f"/api/work-orders/{wo_id}/history")
    assert res_delete.status_code in [404, 405]
