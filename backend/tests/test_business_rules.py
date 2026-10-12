import concurrent.futures
from datetime import datetime, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder

# --- Rule 1: Unique WO Numbers Under Concurrent Requests ---
def test_rule_1_unique_work_order_numbers_concurrent(client, db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    payload = {
        "title": "Concurrent Creation Test",
        "description": "Validating unique work order numbering under concurrency",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    }

    # Execute parallel creation requests
    def create_wo():
        return client.post("/api/work-orders", json=payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(create_wo) for _ in range(8)]
        results = [f.result() for f in futures]

    statuses = [r.status_code for r in results]
    assert all(s == 201 for s in statuses), f"Failed status codes: {statuses}"

    wo_numbers = [r.json()["work_order_number"] for r in results]
    assert len(wo_numbers) == len(set(wo_numbers)), f"Duplicate WO numbers found: {wo_numbers}"
    for num in wo_numbers:
        assert num.startswith("WO-"), f"Invalid format: {num}"


# --- Rule 2: CRITICAL Work Orders Must Have An Assigned Technician ---
def test_rule_2_critical_without_technician_rejected_on_create(client, db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()

    payload = {
        "title": "Critical Breakdown - No Tech",
        "description": "Should fail because technician is missing",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "CRITICAL",
        "assigned_technician_id": None,
        "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "estimated_hours": 3.0
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 422
    assert "CRITICAL work orders must have an assigned technician" in res.json()["detail"]


def test_rule_2_critical_with_technician_succeeds_on_create(client, db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    payload = {
        "title": "Critical Breakdown - With Tech",
        "description": "Should succeed because technician is assigned",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "CRITICAL",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "estimated_hours": 3.0
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 201
    assert res.json()["priority"] == "CRITICAL"
    assert res.json()["assigned_technician_id"] == tech.id


def test_rule_2_updating_to_critical_without_technician_rejected(client, db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    # Create unassigned MEDIUM order
    res_create = client.post("/api/work-orders", json={
        "title": "Standard Medium Order",
        "description": "Routine check",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "assigned_technician_id": None,
        "scheduled_date": (datetime.utcnow() + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.0
    })
    assert res_create.status_code == 201
    wo_id = res_create.json()["id"]

    # Attempt to elevate priority to CRITICAL without providing a technician
    res_update = client.patch(f"/api/work-orders/{wo_id}", json={
        "priority": "CRITICAL"
    })
    assert res_update.status_code == 422
    assert "CRITICAL work orders must have an assigned technician" in res_update.json()["detail"]


# --- Rule 3: COMPLETED Work Orders Cannot Return to OPEN ---
def test_rule_3_completed_cannot_return_to_open(client, db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    # Create order (starts ASSIGNED because tech provided)
    res_create = client.post("/api/work-orders", json={
        "title": "Order to Complete",
        "description": "Progressing to COMPLETED state",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "HIGH",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    wo_id = res_create.json()["id"]

    # Transition ASSIGNED -> IN_PROGRESS
    res_prog = client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "IN_PROGRESS"})
    assert res_prog.status_code == 200

    # Transition IN_PROGRESS -> COMPLETED
    res_comp = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "Task fully resolved.",
        "actual_hours": 2.2
    })
    assert res_comp.status_code == 200
    assert res_comp.json()["status"] == "COMPLETED"

    # Attempt to transition back to OPEN (Rule 3)
    res_back = client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "OPEN"})
    assert res_back.status_code == 422
    assert "COMPLETED work orders cannot return to OPEN" in res_back.json()["detail"]


# --- Rule 4: CANCELLED Work Orders Cannot Move to IN_PROGRESS ---
def test_rule_4_cancelled_cannot_move_to_in_progress(client, db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    # Create unassigned OPEN order
    res_create = client.post("/api/work-orders", json={
        "title": "Order to Cancel",
        "description": "Will be cancelled immediately",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_id = res_create.json()["id"]

    # Transition OPEN -> CANCELLED
    res_cancel = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "CANCELLED",
        "cancellation_reason": "No longer required by plant manager"
    })
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"

    # Attempt to move to IN_PROGRESS (Rule 4)
    res_reopen = client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "IN_PROGRESS"})
    assert res_reopen.status_code == 422
    assert "CANCELLED work orders cannot move to IN_PROGRESS" in res_reopen.json()["detail"]


# --- Rule 5: New Work Orders Cannot Be Scheduled in the Past ---
def test_rule_5_cannot_schedule_in_past(client, db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    past_date = datetime.utcnow() - timedelta(days=2)
    payload = {
        "title": "Past Date Order",
        "description": "Attempting past scheduling",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": past_date.isoformat(),
        "estimated_hours": 1.0
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 422
    assert "New work orders cannot be scheduled in the past" in res.json()["detail"]


# --- Rule 6: OUT_OF_SERVICE Assets Cannot Receive New Non-Emergency Work Orders ---
def test_rule_6_out_of_service_asset_rejects_routine_work_order(client, db_session):
    asset_oos = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-02").first()
    assert asset_oos.status == "OUT_OF_SERVICE"

    maint_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    payload = {
        "title": "Routine Oil Flush",
        "description": "Trying routine maintenance on out of service asset",
        "asset_id": asset_oos.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "MEDIUM",
        "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 422
    assert "OUT_OF_SERVICE and cannot receive new non-emergency work orders" in res.json()["detail"]


def test_rule_6_out_of_service_asset_accepts_emergency_work_order(client, db_session):
    asset_oos = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-02").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()
    maint_emerg = db_session.query(MaintenanceType).filter(MaintenanceType.code == "EMERGENCY").first()

    payload = {
        "title": "Emergency Main Shaft Alignment",
        "description": "Emergency service to restore out of service compressor",
        "asset_id": asset_oos.id,
        "maintenance_type_id": maint_emerg.id,
        "priority": "CRITICAL",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
        "estimated_hours": 6.0
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 201
    assert res.json()["priority"] == "CRITICAL"


# --- State Machine Valid Transitions Enforcement ---
def test_valid_transitions_lifecycle(client, db_session):
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    # 1. Create OPEN order (unassigned)
    res = client.post("/api/work-orders", json={
        "title": "Full Cycle Order",
        "description": "Lifecycle transition test",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "HIGH",
        "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res.status_code == 201
    wo_id = res.json()["id"]
    assert res.json()["status"] == "OPEN"

    # Forbidden jump: OPEN -> COMPLETED (must go OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED)
    res_jump = client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "COMPLETED"})
    assert res_jump.status_code == 422
    assert "Invalid transition" in res_jump.json()["detail"]

    # Assign technician via update: moves OPEN -> ASSIGNED
    res_upd = client.patch(f"/api/work-orders/{wo_id}", json={"assigned_technician_id": tech.id})
    assert res_upd.status_code == 200
    assert res_upd.json()["status"] == "ASSIGNED"

    # ASSIGNED -> IN_PROGRESS
    res_ip = client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "IN_PROGRESS"})
    assert res_ip.status_code == 200
    assert res_ip.json()["status"] == "IN_PROGRESS"

    # IN_PROGRESS -> COMPLETED
    res_done = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "Done smoothly.",
        "actual_hours": 2.0
    })
    assert res_done.status_code == 200
    assert res_done.json()["status"] == "COMPLETED"

    # Check status history was logged at each step
    res_detail = client.get(f"/api/work-orders/{wo_id}")
    history = res_detail.json()["status_history"]
    assert len(history) >= 4
