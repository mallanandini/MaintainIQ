from datetime import datetime, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder
from backend.app.models.checklist import ChecklistTemplate, ChecklistTemplateItem, WorkOrderChecklist, WorkOrderChecklistItem

def test_advanced_filtering_sorting_and_pagination(client, db_session):
    asset1 = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    maint_corr = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech1 = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.utcnow()
    # Create 3 work orders with different scheduled dates and types
    wo1_res = client.post("/api/work-orders", json={
        "title": "Alpha Calibration",
        "description": "Routine calibration service",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "LOW",
        "assigned_technician_id": tech1.id,
        "scheduled_date": (now + timedelta(days=2)).isoformat(),
        "estimated_hours": 2.0
    })
    assert wo1_res.status_code == 201

    wo2_res = client.post("/api/work-orders", json={
        "title": "Beta Overhaul",
        "description": "Corrective overhaul on pump",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_corr.id,
        "priority": "HIGH",
        "assigned_technician_id": tech1.id,
        "scheduled_date": (now + timedelta(days=5)).isoformat(),
        "estimated_hours": 4.0
    })
    assert wo2_res.status_code == 201

    wo3_res = client.post("/api/work-orders", json={
        "title": "Gamma Inspection",
        "description": "General mechanical inspection",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "MEDIUM",
        "assigned_technician_id": None,
        "scheduled_date": (now + timedelta(days=10)).isoformat(),
        "estimated_hours": 1.5
    })
    assert wo3_res.status_code == 201

    # Filter by maintenance_type_id
    res_maint = client.get(f"/api/work-orders?maintenance_type_id={maint_corr.id}")
    assert res_maint.status_code == 200
    items = res_maint.json()
    assert len(items) == 1
    assert items[0]["title"] == "Beta Overhaul"

    # Filter by scheduled date range
    start_str = (now + timedelta(days=1)).isoformat()
    end_str = (now + timedelta(days=4)).isoformat()
    res_date = client.get(f"/api/work-orders?scheduled_start_date={start_str}&scheduled_end_date={end_str}")
    assert res_date.status_code == 200
    items = res_date.json()
    assert len(items) == 1
    assert items[0]["title"] == "Alpha Calibration"

    # Test sorting by scheduled_date asc
    res_sort = client.get("/api/work-orders?sort_by=scheduled_date&sort_order=asc")
    assert res_sort.status_code == 200
    titles = [item["title"] for item in res_sort.json()]
    assert titles == ["Alpha Calibration", "Beta Overhaul", "Gamma Inspection"]

    # Test sorting by scheduled_date desc
    res_sort_desc = client.get("/api/work-orders?sort_by=scheduled_date&sort_order=desc")
    assert res_sort_desc.status_code == 200
    titles_desc = [item["title"] for item in res_sort_desc.json()]
    assert titles_desc == ["Gamma Inspection", "Beta Overhaul", "Alpha Calibration"]

    # Test server-side pagination
    res_page1 = client.get("/api/work-orders?page=1&page_size=2&sort_by=scheduled_date&sort_order=asc")
    assert res_page1.status_code == 200
    assert len(res_page1.json()) == 2
    assert res_page1.headers.get("X-Total-Count") == "3"

    res_page2 = client.get("/api/work-orders?page=2&page_size=2&sort_by=scheduled_date&sort_order=asc")
    assert res_page2.status_code == 200
    assert len(res_page2.json()) == 1
    assert res_page2.json()[0]["title"] == "Gamma Inspection"


def test_bulk_technician_assignment_with_partial_failure(client, db_session):
    asset1 = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    tech1 = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()
    # Create an active second technician for reassignment
    tech2 = Technician(
        employee_id="TECH-ACTIVE-02",
        name="Morgan Freeman",
        email="morgan@test.com",
        specialization="Mechanical",
        status="ACTIVE"
    )
    db_session.add(tech2)
    db_session.commit()

    now = datetime.utcnow()
    # Create WO1 (OPEN)
    wo1 = client.post("/api/work-orders", json={
        "title": "Unassigned Order 1",
        "description": "Needs technician dispatch",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "MEDIUM",
        "assigned_technician_id": None,
        "scheduled_date": (now + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.0
    }).json()

    # Create WO2 (ASSIGNED to tech1)
    wo2 = client.post("/api/work-orders", json={
        "title": "Assigned Order 2",
        "description": "Reassign to tech2",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "LOW",
        "assigned_technician_id": tech1.id,
        "scheduled_date": (now + timedelta(days=3)).isoformat(),
        "estimated_hours": 1.0
    }).json()

    # Create WO3 and cancel it (Terminal state)
    wo3 = client.post("/api/work-orders", json={
        "title": "Terminal Order 3",
        "description": "Will be cancelled",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "LOW",
        "assigned_technician_id": None,
        "scheduled_date": (now + timedelta(days=4)).isoformat(),
        "estimated_hours": 1.0
    }).json()

    client.post(f"/api/work-orders/{wo3['id']}/transition", json={
        "to_status": "CANCELLED",
        "cancellation_reason": "Not required anymore"
    })

    # Perform bulk assignment to tech2: [wo1, wo2, wo3, non_existent (99999)]
    bulk_res = client.post("/api/work-orders/bulk-assign-technician", json={
        "work_order_ids": [wo1["id"], wo2["id"], wo3["id"], 99999],
        "technician_id": tech2.id
    })
    assert bulk_res.status_code == 200
    data = bulk_res.json()

    assert data["total_requested"] == 4
    assert data["success_count"] == 2
    assert data["failure_count"] == 2

    results_by_id = {r["work_order_id"]: r for r in data["results"]}
    # WO1 should succeed and move from OPEN to ASSIGNED
    assert results_by_id[wo1["id"]]["success"] is True

    # WO2 should succeed
    assert results_by_id[wo2["id"]]["success"] is True

    # WO3 should fail because it's cancelled (terminal)
    assert results_by_id[wo3["id"]]["success"] is False
    assert "terminal" in results_by_id[wo3["id"]]["error"].lower()

    # 99999 should fail because not found
    assert results_by_id[99999]["success"] is False
    assert "not found" in results_by_id[99999]["error"].lower()

    # Verify wo1 status updated to ASSIGNED in database
    wo1_updated = client.get(f"/api/work-orders/{wo1['id']}").json()
    assert wo1_updated["status"] == "ASSIGNED"
    assert wo1_updated["assigned_technician_id"] == tech2.id


def test_state_transitions_and_completion_conditions(client, db_session):
    asset1 = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    tech1 = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.utcnow()
    # Create OPEN order
    wo = client.post("/api/work-orders", json={
        "title": "Strict Flow Order",
        "description": "Lifecycle transition test",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "MEDIUM",
        "assigned_technician_id": None,
        "scheduled_date": (now + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.0
    }).json()

    # 1. Attempt invalid transition: OPEN -> COMPLETED (State skipping forbidden)
    skip_res = client.post(f"/api/work-orders/{wo['id']}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "Skipped everything"
    })
    assert skip_res.status_code == 422
    assert "Invalid transition from OPEN to COMPLETED" in skip_res.json()["detail"]

    # 2. Transition OPEN -> ASSIGNED
    client.patch(f"/api/work-orders/{wo['id']}", json={"assigned_technician_id": tech1.id})
    t1 = client.post(f"/api/work-orders/{wo['id']}/transition", json={"to_status": "ASSIGNED"})
    assert t1.status_code == 200
    assert t1.json()["status"] == "ASSIGNED"

    # 3. Attempt invalid transition: ASSIGNED -> COMPLETED (Must go to IN_PROGRESS first)
    skip_res2 = client.post(f"/api/work-orders/{wo['id']}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "Skipped IN_PROGRESS"
    })
    assert skip_res2.status_code == 422
    assert "Invalid transition from ASSIGNED to COMPLETED" in skip_res2.json()["detail"]

    # 4. Transition ASSIGNED -> IN_PROGRESS
    t2 = client.post(f"/api/work-orders/{wo['id']}/transition", json={"to_status": "IN_PROGRESS"})
    assert t2.status_code == 200
    assert t2.json()["status"] == "IN_PROGRESS"

    # 5. Initialize a digital inspection checklist with a required item
    init_cl = client.post(f"/api/work-orders/{wo['id']}/checklist", json={
        "title": "Pre-Operation Check"
    }).json()

    # Add item to checklist directly in db
    cl_record = db_session.query(WorkOrderChecklist).filter(WorkOrderChecklist.id == init_cl["id"]).first()
    item = WorkOrderChecklistItem(
        checklist_id=cl_record.id,
        order_index=1,
        item_text="Verify safety guard in place",
        is_required=True,
        status="PENDING"
    )
    db_session.add(item)
    db_session.commit()

    # 6. Attempt to transition to COMPLETED while required checklist item is PENDING -> Must be rejected!
    blocked_comp = client.post(f"/api/work-orders/{wo['id']}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "Attempting completion without checklist"
    })
    assert blocked_comp.status_code == 422
    assert "pending verification" in blocked_comp.json()["detail"].lower()

    # 7. Update checklist item to FAIL -> Transition to COMPLETED must still be rejected!
    for it in cl_record.items:
        it.status = "PASS"
    item.status = "FAIL"
    db_session.commit()

    blocked_fail = client.post(f"/api/work-orders/{wo['id']}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "Attempting completion with failed item"
    })
    assert blocked_fail.status_code == 422
    assert "failed inspection" in blocked_fail.json()["detail"].lower()

    # 8. Update checklist item to PASS -> Transition to COMPLETED should now succeed!
    item.status = "PASS"
    for it in cl_record.items:
        it.status = "PASS"
    db_session.commit()

    complete_res = client.post(f"/api/work-orders/{wo['id']}/transition", json={
        "to_status": "COMPLETED",
        "resolution_summary": "All checklist items verified and maintenance complete.",
        "actual_hours": 1.2
    })
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "COMPLETED"


def test_work_order_duplication_rules(client, db_session):
    asset1 = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    tech1 = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.utcnow()
    # Create original work order
    orig = client.post("/api/work-orders", json={
        "title": "HVAC Filter Replacement",
        "description": "Standard recurring filter service",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "MEDIUM",
        "assigned_technician_id": tech1.id,
        "scheduled_date": (now + timedelta(days=3)).isoformat(),
        "estimated_hours": 2.5
    }).json()

    # Duplicate work order with defaults
    dup_res = client.post(f"/api/work-orders/{orig['id']}/duplicate")
    assert dup_res.status_code == 201
    dup_data = dup_res.json()

    # Must generate a new unique work order number
    assert dup_data["id"] != orig["id"]
    assert dup_data["work_order_number"] != orig["work_order_number"]
    assert dup_data["title"] == "HVAC Filter Replacement (Copy)"
    assert dup_data["asset_id"] == orig["asset_id"]
    assert dup_data["maintenance_type_id"] == orig["maintenance_type_id"]
    assert dup_data["priority"] == "MEDIUM"
    assert dup_data["assigned_technician_id"] == tech1.id
    assert dup_data["status"] == "ASSIGNED"

    # Verify history records duplication provenance
    hist = client.get(f"/api/work-orders/{dup_data['id']}/history").json()
    assert any("Duplicated from work order" in (h.get("notes") or "") for h in hist)

    # Test Rule 2 revalidation on duplicate: if override priority to CRITICAL without technician -> Must fail!
    fail_crit = client.post(f"/api/work-orders/{orig['id']}/duplicate", json={
        "priority": "CRITICAL",
        "assigned_technician_id": None
    })
    assert fail_crit.status_code == 422
    assert "Rule 2 Violation" in fail_crit.json()["detail"]

    # Test Rule 5 revalidation on duplicate: if scheduled date in past -> Must fail!
    fail_past = client.post(f"/api/work-orders/{orig['id']}/duplicate", json={
        "scheduled_date": (now - timedelta(days=2)).isoformat()
    })
    assert fail_past.status_code == 422
    assert "Rule 5 Violation" in fail_past.json()["detail"]
