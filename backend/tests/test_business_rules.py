import concurrent.futures
from datetime import datetime, timezone, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder


# ============================================================================
# RULE 1: Unique Work-Order Numbers & Duplicate-Key Handling
# ============================================================================

def test_rule_1_valid_work_order_creation_auto_number(client, db_session):
    """Valid work order creation with auto-generated sequential number."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    payload = {
        "title": "Standard Inspection",
        "description": "Routine quarterly preventive inspection",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.5
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["work_order_number"].startswith("WO-")
    assert data["status"] == "OPEN"
    assert data["priority"] == "MEDIUM"


def test_rule_1_valid_work_order_creation_explicit_number(client, db_session):
    """Valid work order creation with custom work order number."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    payload = {
        "work_order_number": "WO-EXPLICIT-1001",
        "title": "Explicit Number Order",
        "description": "Testing custom unique work order numbering",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "estimated_hours": 2.0
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 201
    assert res.json()["work_order_number"] == "WO-EXPLICIT-1001"


def test_rule_1_duplicate_work_order_number_rejected_409(client, db_session):
    """Submitting duplicate work-order numbers must trigger HTTP 409 Conflict."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    payload1 = {
        "work_order_number": "WO-DUP-TEST-001",
        "title": "First Work Order",
        "description": "Initial registration",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    }
    res1 = client.post("/api/work-orders", json=payload1)
    assert res1.status_code == 201

    # Attempt to submit duplicate
    payload2 = {
        "work_order_number": "WO-DUP-TEST-001",
        "title": "Second Work Order Collision",
        "description": "Duplicate key violation attempt",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 2.0
    }
    res2 = client.post("/api/work-orders", json=payload2)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_rule_1_unique_work_order_numbers_concurrent(client, db_session):
    """Parallel requests auto-generating work orders must all receive unique numbers."""
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
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    }

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


def test_rule_1_concurrent_duplicate_explicit_number(client, db_session):
    """Concurrent attempts to create the same explicit number must yield 1 success and 1 conflict."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    payload = {
        "work_order_number": "WO-RACE-EXPLICIT-999",
        "title": "Concurrent Race Creation",
        "description": "Testing duplicate resolution under parallel thread execution",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    }

    def create_race_wo():
        return client.post("/api/work-orders", json=payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(create_race_wo)
        f2 = executor.submit(create_race_wo)
        results = [f1.result(), f2.result()]

    codes = [r.status_code for r in results]
    assert 201 in codes, f"Expected one 201, got {codes}"
    assert 409 in codes, f"Expected one 409 Conflict, got {codes}"


# ============================================================================
# RULE 2: CRITICAL Work Orders Must Have An Assigned Technician
# ============================================================================

def test_rule_2_critical_without_technician_rejected_on_create(client, db_session):
    """Creating a CRITICAL work order without a technician must return 422."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()

    payload = {
        "title": "Critical Breakdown - No Tech",
        "description": "Should fail because technician is missing",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "CRITICAL",
        "assigned_technician_id": None,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 3.0
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 422
    assert "CRITICAL work order must have an assigned technician" in res.json()["detail"]


def test_rule_2_critical_with_technician_succeeds_on_create(client, db_session):
    """Creating a CRITICAL work order with an assigned technician succeeds with status ASSIGNED."""
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
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 3.0
    }

    res = client.post("/api/work-orders", json=payload)
    assert res.status_code == 201
    assert res.json()["priority"] == "CRITICAL"
    assert res.json()["assigned_technician_id"] == tech.id
    assert res.json()["status"] == "ASSIGNED"


def test_rule_2_updating_to_critical_without_technician_rejected(client, db_session):
    """Updating priority to CRITICAL without providing a technician must return 422."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    res_create = client.post("/api/work-orders", json={
        "title": "Standard Medium Order",
        "description": "Routine check",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "assigned_technician_id": None,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.0
    })
    assert res_create.status_code == 201
    wo_id = res_create.json()["id"]

    res_update = client.patch(f"/api/work-orders/{wo_id}", json={
        "priority": "CRITICAL"
    })
    assert res_update.status_code == 422
    assert "CRITICAL work order must have an assigned technician" in res_update.json()["detail"]


def test_rule_2_updating_to_critical_with_technician_succeeds(client, db_session):
    """Updating priority to CRITICAL while supplying an active technician succeeds."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    res_create = client.post("/api/work-orders", json={
        "title": "Escalation Candidate",
        "description": "Routine check pending escalation",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "assigned_technician_id": None,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_id = res_create.json()["id"]

    res_update = client.patch(f"/api/work-orders/{wo_id}", json={
        "priority": "CRITICAL",
        "assigned_technician_id": tech.id
    })
    assert res_update.status_code == 200
    assert res_update.json()["priority"] == "CRITICAL"
    assert res_update.json()["assigned_technician_id"] == tech.id
    assert res_update.json()["status"] == "ASSIGNED"


def test_rule_2_unassigning_technician_from_critical_rejected(client, db_session):
    """Attempting to unassign technician from a CRITICAL work order must be rejected."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    res_create = client.post("/api/work-orders", json={
        "title": "Critical Order With Tech",
        "description": "Critical order setup",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "CRITICAL",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    wo_id = res_create.json()["id"]

    # Attempt to unassign technician
    res_unassign = client.patch(f"/api/work-orders/{wo_id}", json={
        "assigned_technician_id": None
    })
    assert res_unassign.status_code == 422
    assert "CRITICAL work order must have an assigned technician" in res_unassign.json()["detail"]


# ============================================================================
# RULES 3 & 4 & COMPLETE STATUS TRANSITION GRAPH
# Allowed transitions:
#   OPEN → ASSIGNED → IN_PROGRESS → COMPLETED
#   OPEN → CANCELLED
#   ASSIGNED → CANCELLED
# ============================================================================

def test_transition_complete_allowed_lifecycle(client, db_session):
    """Valid complete lifecycle: OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    # 1. Create OPEN order
    res = client.post("/api/work-orders", json={
        "title": "Complete Flow Order",
        "description": "Testing full allowed path",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "HIGH",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res.status_code == 201
    wo_id = res.json()["id"]
    assert res.json()["status"] == "OPEN"

    # 2. Assign technician via update: moves OPEN -> ASSIGNED
    res_assign = client.patch(f"/api/work-orders/{wo_id}", json={"assigned_technician_id": tech.id})
    assert res_assign.status_code == 200
    assert res_assign.json()["status"] == "ASSIGNED"

    # 3. Transition ASSIGNED -> IN_PROGRESS
    res_ip = client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "IN_PROGRESS"})
    assert res_ip.status_code == 200
    assert res_ip.json()["status"] == "IN_PROGRESS"

    # 4. Transition IN_PROGRESS -> COMPLETED
    res_comp = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "Replaced worn seals and tested pressure.",
        "actual_hours": 1.8
    })
    assert res_comp.status_code == 200
    assert res_comp.json()["status"] == "COMPLETED"


def test_transition_open_to_cancelled_allowed(client, db_session):
    """Allowed transition: OPEN -> CANCELLED."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    res = client.post("/api/work-orders", json={
        "title": "To Cancel From Open",
        "description": "Order created in OPEN status",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_id = res.json()["id"]
    assert res.json()["status"] == "OPEN"

    res_cancel = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "CANCELLED",
        "cancellation_reason": "Maintenance postponed indefinitely."
    })
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"


def test_transition_assigned_to_cancelled_allowed(client, db_session):
    """Allowed transition: ASSIGNED -> CANCELLED."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    res = client.post("/api/work-orders", json={
        "title": "To Cancel From Assigned",
        "description": "Assigned order to cancel",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    wo_id = res.json()["id"]
    assert res.json()["status"] == "ASSIGNED"

    res_cancel = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "CANCELLED",
        "cancellation_reason": "Asset taken offline for refactoring."
    })
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"


def test_rule_3_completed_is_terminal(client, db_session):
    """Rule 3: COMPLETED work orders cannot transition to OPEN or any other state."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    # Create and advance to COMPLETED
    res = client.post("/api/work-orders", json={
        "title": "Terminal Completed Test",
        "description": "Progressing to COMPLETED",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_id = res.json()["id"]
    client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "IN_PROGRESS"})
    client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "COMPLETED"})

    # Check forbidden transitions from COMPLETED
    for forbidden_target in ["OPEN", "ASSIGNED", "IN_PROGRESS", "CANCELLED", "COMPLETED"]:
        res_try = client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": forbidden_target})
        assert res_try.status_code == 422
        assert "COMPLETED is a terminal state" in res_try.json()["detail"]


def test_rule_4_cancelled_is_terminal(client, db_session):
    """Rule 4: CANCELLED work orders cannot transition to IN_PROGRESS or any other state."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    res = client.post("/api/work-orders", json={
        "title": "Terminal Cancelled Test",
        "description": "Progressing to CANCELLED",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_id = res.json()["id"]
    client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "CANCELLED"})

    # Check forbidden transitions from CANCELLED
    for forbidden_target in ["IN_PROGRESS", "OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"]:
        res_try = client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": forbidden_target})
        assert res_try.status_code == 422
        assert "CANCELLED is a terminal state" in res_try.json()["detail"]


def test_forbidden_transitions_skipping_states(client, db_session):
    """Forbidden transitions that attempt to skip states in the lifecycle graph."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    # 1. OPEN cannot jump directly to IN_PROGRESS or COMPLETED
    res_open = client.post("/api/work-orders", json={
        "title": "Skip Check Open",
        "description": "Trying invalid jumps from OPEN",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_open_id = res_open.json()["id"]

    res_open_to_ip = client.post(f"/api/work-orders/{wo_open_id}/transition", json={"to_status": "IN_PROGRESS"})
    assert res_open_to_ip.status_code == 422
    assert "Invalid transition from OPEN to IN_PROGRESS" in res_open_to_ip.json()["detail"]

    res_open_to_comp = client.post(f"/api/work-orders/{wo_open_id}/transition", json={"to_status": "COMPLETED"})
    assert res_open_to_comp.status_code == 422
    assert "Invalid transition from OPEN to COMPLETED" in res_open_to_comp.json()["detail"]

    # 2. ASSIGNED cannot jump directly to COMPLETED or backward to OPEN
    res_assigned = client.post("/api/work-orders", json={
        "title": "Skip Check Assigned",
        "description": "Trying invalid jumps from ASSIGNED",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_assigned_id = res_assigned.json()["id"]

    res_as_to_comp = client.post(f"/api/work-orders/{wo_assigned_id}/transition", json={"to_status": "COMPLETED"})
    assert res_as_to_comp.status_code == 422
    assert "Invalid transition from ASSIGNED to COMPLETED" in res_as_to_comp.json()["detail"]

    res_as_to_open = client.post(f"/api/work-orders/{wo_assigned_id}/transition", json={"to_status": "OPEN"})
    assert res_as_to_open.status_code == 422
    assert "Invalid transition from ASSIGNED to OPEN" in res_as_to_open.json()["detail"]

    # 3. IN_PROGRESS cannot transition to CANCELLED or backward to OPEN/ASSIGNED
    client.post(f"/api/work-orders/{wo_assigned_id}/transition", json={"to_status": "IN_PROGRESS"})
    res_ip_to_cancel = client.post(f"/api/work-orders/{wo_assigned_id}/transition", json={"to_status": "CANCELLED"})
    assert res_ip_to_cancel.status_code == 422
    assert "Invalid transition from IN_PROGRESS to CANCELLED" in res_ip_to_cancel.json()["detail"]

    res_ip_to_open = client.post(f"/api/work-orders/{wo_assigned_id}/transition", json={"to_status": "OPEN"})
    assert res_ip_to_open.status_code == 422
    assert "Invalid transition from IN_PROGRESS to OPEN" in res_ip_to_open.json()["detail"]


# ============================================================================
# RULE 5: Scheduled Date Handling (Past, Current, Future & Timezones)
# ============================================================================

def test_rule_5_reject_past_date_naive(client, db_session):
    """Scheduled date in the past (naive string) must return 422."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    past_date = datetime.utcnow() - timedelta(days=2)
    res = client.post("/api/work-orders", json={
        "title": "Past Date Naive",
        "description": "Attempting past scheduling",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": past_date.strftime("%Y-%m-%dT%H:%M:%S"),
        "estimated_hours": 1.0
    })
    assert res.status_code == 422
    assert "scheduled dates in the past" in res.json()["detail"]


def test_rule_5_reject_past_date_timezone_aware(client, db_session):
    """Scheduled date in the past with timezone offset (+05:30 / Z) must return 422."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    past_aware = (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
    res = client.post("/api/work-orders", json={
        "title": "Past Date Aware",
        "description": "Attempting past scheduling with timezone",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": past_aware,
        "estimated_hours": 1.0
    })
    assert res.status_code == 422
    assert "scheduled dates in the past" in res.json()["detail"]


def test_rule_5_accept_current_scheduled_date(client, db_session):
    """Scheduled date set to current time (within 120s tolerance) must succeed."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    now_iso = datetime.now(timezone.utc).isoformat()
    res = client.post("/api/work-orders", json={
        "title": "Current Scheduled Time",
        "description": "Immediate maintenance dispatch",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": now_iso,
        "estimated_hours": 1.0
    })
    assert res.status_code == 201


def test_rule_5_accept_future_scheduled_date_aware_and_naive(client, db_session):
    """Future dates with aware and naive ISO strings must both succeed without TypeError."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    # 1. Aware future date
    future_aware = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    res1 = client.post("/api/work-orders", json={
        "title": "Future Aware Order",
        "description": "Aware date test",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": future_aware,
        "estimated_hours": 1.0
    })
    assert res1.status_code == 201

    # 2. Naive future date
    future_naive = (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%dT14:00:00")
    res2 = client.post("/api/work-orders", json={
        "title": "Future Naive Order",
        "description": "Naive date test",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": future_naive,
        "estimated_hours": 1.0
    })
    assert res2.status_code == 201


def test_rule_5_reject_updating_scheduled_date_to_past(client, db_session):
    """Updating scheduled_date on an active work order to the past must return 422."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    res = client.post("/api/work-orders", json={
        "title": "Active Order for Date Edit",
        "description": "Will attempt to set past date via PATCH",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_id = res.json()["id"]

    past_date = (datetime.now(timezone.utc) - timedelta(days=4)).isoformat()
    res_update = client.patch(f"/api/work-orders/{wo_id}", json={
        "scheduled_date": past_date
    })
    assert res_update.status_code == 422
    assert "date in the past" in res_update.json()["detail"]


# ============================================================================
# RULE 6: OUT_OF_SERVICE Assets & Strict Boolean Maintenance Type Check
# ============================================================================

def test_rule_6_out_of_service_rejects_preventative_order(client, db_session):
    """OUT_OF_SERVICE asset rejects non-emergency preventative work order."""
    asset_oos = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-02").first()
    assert asset_oos.status == "OUT_OF_SERVICE"
    maint_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    res = client.post("/api/work-orders", json={
        "title": "Routine Oil Flush",
        "description": "Trying routine maintenance on out of service asset",
        "asset_id": asset_oos.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "MEDIUM",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res.status_code == 422
    assert "OUT_OF_SERVICE and cannot receive new non-emergency work orders" in res.json()["detail"]


def test_rule_6_out_of_service_rejects_decoy_keyword_emergency(client, db_session):
    """Emergency eligibility must strictly come from is_emergency=True, not keyword matching on code/name."""
    asset_oos = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-02").first()
    maint_decoy = db_session.query(MaintenanceType).filter(MaintenanceType.code == "EMERGENCY_DECOY").first()
    assert maint_decoy.is_emergency is False

    res = client.post("/api/work-orders", json={
        "title": "Decoy Emergency Order",
        "description": "Code has EMERGENCY but is_emergency boolean is False",
        "asset_id": asset_oos.id,
        "maintenance_type_id": maint_decoy.id,
        "priority": "HIGH",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res.status_code == 422
    assert "Emergency eligibility requires a maintenance type with is_emergency=True" in res.json()["detail"]


def test_rule_6_out_of_service_rejects_critical_priority_without_emergency_type(client, db_session):
    """Setting priority=CRITICAL does not bypass Rule 6 if maintenance_type.is_emergency is False."""
    asset_oos = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-02").first()
    maint_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    res = client.post("/api/work-orders", json={
        "title": "Critical Priority Non-Emergency Type",
        "description": "Attempting to bypass Rule 6 with CRITICAL priority",
        "asset_id": asset_oos.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "CRITICAL",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res.status_code == 422
    assert "OUT_OF_SERVICE and cannot receive new non-emergency work orders" in res.json()["detail"]


def test_rule_6_out_of_service_accepts_emergency_type(client, db_session):
    """OUT_OF_SERVICE asset successfully accepts work orders with is_emergency=True."""
    asset_oos = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-02").first()
    maint_emerg = db_session.query(MaintenanceType).filter(MaintenanceType.code == "EMERGENCY").first()
    assert maint_emerg.is_emergency is True
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    res = client.post("/api/work-orders", json={
        "title": "Emergency Compressor Rebuild",
        "description": "Emergency service with explicit is_emergency=True maintenance type",
        "asset_id": asset_oos.id,
        "maintenance_type_id": maint_emerg.id,
        "priority": "CRITICAL",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        "estimated_hours": 5.0
    })
    assert res.status_code == 201
    assert res.json()["status"] == "ASSIGNED"


# ============================================================================
# NONEXISTENT IDS & TECHNICIAN STATUS VALIDATION
# ============================================================================

def test_nonexistent_ids_return_404(client, db_session):
    """Nonexistent asset_id, maintenance_type_id, or technician_id must return 404."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    future_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    # Nonexistent asset
    res_asset = client.post("/api/work-orders", json={
        "title": "Bad Asset",
        "description": "Valid payload",
        "asset_id": 99999,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    assert res_asset.status_code == 404
    assert "Asset with ID 99999 does not exist" in res_asset.json()["detail"]

    # Nonexistent maintenance type
    res_mt = client.post("/api/work-orders", json={
        "title": "Bad Maint Type",
        "description": "Valid payload",
        "asset_id": asset.id,
        "maintenance_type_id": 99999,
        "priority": "LOW",
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    assert res_mt.status_code == 404
    assert "Maintenance type with ID 99999 does not exist" in res_mt.json()["detail"]

    # Nonexistent technician on create
    res_tech = client.post("/api/work-orders", json={
        "title": "Bad Tech Create",
        "description": "Valid payload",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "assigned_technician_id": 99999,
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    assert res_tech.status_code == 404
    assert "Technician with ID 99999 does not exist" in res_tech.json()["detail"]


def test_nonexistent_technician_on_update_returns_404(client, db_session):
    """Updating with a nonexistent technician ID must return 404."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    res = client.post("/api/work-orders", json={
        "title": "Tech Update Test",
        "description": "Valid payload",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_id = res.json()["id"]

    res_patch = client.patch(f"/api/work-orders/{wo_id}", json={
        "assigned_technician_id": 99999
    })
    assert res_patch.status_code == 404
    assert "Technician with ID 99999 does not exist" in res_patch.json()["detail"]


def test_inactive_and_on_leave_technician_rejected(client, db_session):
    """Assigning INACTIVE or ON_LEAVE technicians on create or update must return 422."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    tech_inactive = db_session.query(Technician).filter(Technician.employee_id == "TECH-T2").first()
    tech_leave = db_session.query(Technician).filter(Technician.employee_id == "TECH-T3").first()
    future_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    # Inactive technician on create
    res1 = client.post("/api/work-orders", json={
        "title": "Inactive Tech Order",
        "description": "Should fail",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "assigned_technician_id": tech_inactive.id,
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    assert res1.status_code == 422
    assert "INACTIVE and cannot be assigned" in res1.json()["detail"]

    # On leave technician on create
    res2 = client.post("/api/work-orders", json={
        "title": "On Leave Tech Order",
        "description": "Should fail",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "assigned_technician_id": tech_leave.id,
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    assert res2.status_code == 422
    assert "ON_LEAVE and cannot be assigned" in res2.json()["detail"]

    # Inactive technician on update
    res_ok = client.post("/api/work-orders", json={
        "title": "Order for Inactive Update",
        "description": "Valid initial order",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    wo_id = res_ok.json()["id"]

    res_patch = client.patch(f"/api/work-orders/{wo_id}", json={
        "assigned_technician_id": tech_inactive.id
    })
    assert res_patch.status_code == 422
    assert "INACTIVE and cannot be assigned" in res_patch.json()["detail"]


# ============================================================================
# INVALID ENUM VALUES
# ============================================================================

def test_invalid_enums_rejected_with_422(client, db_session):
    """Invalid enum values across priority, status, and entity schemas must return 422."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    future_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    # 1. Invalid work order priority on create
    res_prio = client.post("/api/work-orders", json={
        "title": "Invalid Priority Order",
        "description": "Testing invalid enum",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "SUPER_URGENT",
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    assert res_prio.status_code == 422

    # 2. Invalid status in transition request
    res_wo = client.post("/api/work-orders", json={
        "title": "Valid Order For Bad Transition",
        "description": "Testing invalid status transition",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    wo_id = res_wo.json()["id"]

    res_bad_status = client.post(f"/api/work-orders/{wo_id}/transition", json={
        "to_status": "SUSPENDED"
    })
    assert res_bad_status.status_code == 422

    # 3. Invalid asset status on asset create
    res_asset_status = client.post("/api/assets", json={
        "asset_tag": "AST-INVALID-01",
        "name": "Invalid Asset",
        "category": "Mechanical",
        "location": "Warehouse",
        "status": "NON_EXISTENT_STATUS"
    })
    assert res_asset_status.status_code == 422

    # 4. Invalid technician status on technician create
    res_tech_status = client.post("/api/technicians", json={
        "employee_id": "TECH-INV-01",
        "name": "Invalid Technician",
        "email": "invalid@test.internal",
        "specialization": "General",
        "status": "TERMINATED"
    })
    assert res_tech_status.status_code == 422


# ============================================================================
# BYPASS ATTEMPTS & EDGE CASE VALIDATIONS
# ============================================================================

def test_bypass_attempt_updating_terminal_work_order_rejected(client, db_session):
    """Updates attempting to modify work orders in COMPLETED or CANCELLED status must be rejected."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()

    # Create and cancel order
    res = client.post("/api/work-orders", json={
        "title": "To Be Cancelled",
        "description": "Will be cancelled",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "LOW",
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 1.0
    })
    wo_id = res.json()["id"]
    client.post(f"/api/work-orders/{wo_id}/transition", json={"to_status": "CANCELLED"})

    # Attempt to edit title, description, or scheduled_date
    res_edit = client.patch(f"/api/work-orders/{wo_id}", json={
        "title": "Updated Title Attempt"
    })
    assert res_edit.status_code == 422
    assert "Cannot edit work order in terminal state CANCELLED" in res_edit.json()["detail"]


def test_decommissioned_asset_rejects_work_order_creation(client, db_session):
    """DECOMMISSIONED assets cannot receive any work orders under any priority."""
    asset_decom = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-03").first()
    assert asset_decom.status == "DECOMMISSIONED"
    maint_emerg = db_session.query(MaintenanceType).filter(MaintenanceType.code == "EMERGENCY").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    res = client.post("/api/work-orders", json={
        "title": "Emergency Attempt On Decommissioned",
        "description": "Should fail unconditionally",
        "asset_id": asset_decom.id,
        "maintenance_type_id": maint_emerg.id,
        "priority": "CRITICAL",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res.status_code == 422
    assert "is DECOMMISSIONED and cannot receive any work orders" in res.json()["detail"]
