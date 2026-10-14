from datetime import datetime, timezone, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder

def test_deactivating_available_technician(client, db_session):
    """Deactivating an ACTIVE technician with zero active work orders succeeds."""
    tech = Technician(
        employee_id="TECH-DEACT-01",
        name="Alex Mercer",
        email="alex.mercer@maintainiq.internal",
        specialization="Hydraulics",
        status="ACTIVE",
        hourly_rate=75.0
    )
    db_session.add(tech)
    db_session.commit()
    db_session.refresh(tech)

    res = client.put(f"/api/technicians/{tech.id}", json={"status": "INACTIVE"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "INACTIVE"
    assert data["employee_id"] == "TECH-DEACT-01"

    # Verify in DB
    db_session.expire_all()
    refreshed = db_session.query(Technician).filter(Technician.id == tech.id).first()
    assert refreshed.status == "INACTIVE"


def test_deactivating_technician_with_active_assignments_blocked(client, db_session):
    """Attempting to deactivate a technician who has active work orders is blocked with 409 Conflict."""
    tech = Technician(
        employee_id="TECH-BUSY-01",
        name="Elena Rostova",
        email="elena.rostova@maintainiq.internal",
        specialization="Electrical",
        status="ACTIVE",
        hourly_rate=80.0
    )
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    db_session.add(tech)
    db_session.commit()
    db_session.refresh(tech)

    # Create active work order assigned to this technician
    wo = WorkOrder(
        work_order_number="WO-BUSY-9901",
        title="Active Transformer Inspection",
        description="Inspect main transformer feeder lines",
        asset_id=asset.id,
        maintenance_type_id=maint_type.id,
        priority="HIGH",
        status="ASSIGNED",
        assigned_technician_id=tech.id,
        scheduled_date=datetime.now(timezone.utc) + timedelta(days=2),
        estimated_hours=3.0
    )
    db_session.add(wo)
    db_session.commit()

    # Attempt deactivation
    res = client.put(f"/api/technicians/{tech.id}", json={"status": "INACTIVE"})
    assert res.status_code == 409
    detail = res.json()["detail"]
    assert "active work order assignment" in detail
    assert "WO-BUSY-9901" in detail

    # Verify technician remains ACTIVE
    db_session.refresh(tech)
    assert tech.status == "ACTIVE"


def test_preventing_new_assignments_to_inactive_technicians(client, db_session):
    """Inactive technicians must be rejected from receiving new work orders or assignments."""
    tech = Technician(
        employee_id="TECH-INACT-02",
        name="Retired Tech",
        email="retired@maintainiq.internal",
        specialization="Pumps",
        status="INACTIVE"
    )
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    db_session.add(tech)
    db_session.commit()
    db_session.refresh(tech)

    # 1. Creation assignment rejected
    res_create = client.post("/api/work-orders", json={
        "title": "Preventative Filter Change",
        "description": "Routine filter maintenance",
        "asset_id": asset.id,
        "maintenance_type_id": maint_type.id,
        "priority": "MEDIUM",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "estimated_hours": 1.0
    })
    assert res_create.status_code == 422
    assert "INACTIVE" in res_create.json()["detail"]

    # 2. Update assignment to existing open order rejected
    wo_open = WorkOrder(
        work_order_number="WO-OPEN-7711",
        title="Unassigned Open Task",
        description="Awaiting technician",
        asset_id=asset.id,
        maintenance_type_id=maint_type.id,
        priority="LOW",
        status="OPEN",
        scheduled_date=datetime.now(timezone.utc) + timedelta(days=4),
        estimated_hours=2.0
    )
    db_session.add(wo_open)
    db_session.commit()

    res_update = client.put(f"/api/work-orders/{wo_open.id}", json={
        "assigned_technician_id": tech.id
    })
    assert res_update.status_code == 422
    assert "INACTIVE" in res_update.json()["detail"]

    # 3. Bulk assignment rejected
    res_bulk = client.post("/api/work-orders/bulk-assign", json={
        "work_order_ids": [wo_open.id],
        "technician_id": tech.id
    })
    assert res_bulk.status_code == 422
    assert "INACTIVE" in res_bulk.json()["detail"]

    # 4. Inactive technician excluded from recommendations
    res_recs = client.get(f"/api/technicians/recommendations?asset_id={asset.id}&priority=MEDIUM")
    assert res_recs.status_code == 200
    rec_tech_ids = [r["technician_id"] for r in res_recs.json()]
    assert tech.id not in rec_tech_ids


def test_reactivating_technician(client, db_session):
    """An INACTIVE technician can be reactivated to ACTIVE status."""
    tech = Technician(
        employee_id="TECH-REACT-01",
        name="Claire Vance",
        email="claire.vance@maintainiq.internal",
        specialization="Robotics",
        status="INACTIVE"
    )
    db_session.add(tech)
    db_session.commit()
    db_session.refresh(tech)

    res = client.put(f"/api/technicians/{tech.id}", json={"status": "ACTIVE"})
    assert res.status_code == 200
    assert res.json()["status"] == "ACTIVE"

    # Verify technician is active in DB
    db_session.refresh(tech)
    assert tech.status == "ACTIVE"


def test_blocking_deletion_when_work_order_history_exists(client, db_session):
    """Deleting a technician with work-order history is blocked with HTTP 409 Conflict."""
    tech = Technician(
        employee_id="TECH-HIST-01",
        name="Historical Specialist",
        email="hist.spec@maintainiq.internal",
        specialization="Sensors",
        status="ACTIVE"
    )
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    db_session.add(tech)
    db_session.commit()
    db_session.refresh(tech)

    # Completed historical work order
    wo_completed = WorkOrder(
        work_order_number="WO-HIST-5501",
        title="Completed Calibration",
        description="Sensor calibrated and signed off",
        asset_id=asset.id,
        maintenance_type_id=maint_type.id,
        priority="LOW",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=datetime.now(timezone.utc) - timedelta(days=5),
        estimated_hours=1.5,
        actual_hours=1.5,
        resolution_summary="Successfully calibrated"
    )
    db_session.add(wo_completed)
    db_session.commit()

    # Attempt permanent deletion
    res_del = client.delete(f"/api/technicians/{tech.id}")
    assert res_del.status_code == 409
    assert "Cannot permanently delete technician" in res_del.json()["detail"]
    assert "preserve maintenance audit history" in res_del.json()["detail"]

    # Verify technician still exists
    db_session.refresh(tech)
    assert tech is not None


def test_deleting_technician_without_dependencies(client, db_session):
    """Deleting a technician with zero associated work orders succeeds."""
    tech = Technician(
        employee_id="TECH-TEMP-99",
        name="Temporary Contractor",
        email="contractor.temp@maintainiq.internal",
        specialization="HVAC",
        status="INACTIVE"
    )
    db_session.add(tech)
    db_session.commit()
    db_session.refresh(tech)
    tech_id = tech.id

    res_del = client.delete(f"/api/technicians/{tech_id}")
    assert res_del.status_code == 200
    assert res_del.json()["success"] is True

    # Verify technician is permanently deleted from DB
    deleted = db_session.query(Technician).filter(Technician.id == tech_id).first()
    assert deleted is None


def test_handling_invalid_technician_ids(client, db_session):
    """Operations on nonexistent technician IDs return HTTP 404 Not Found."""
    nonexistent_id = 999999

    res_get = client.get(f"/api/technicians/{nonexistent_id}")
    assert res_get.status_code == 404

    res_put = client.put(f"/api/technicians/{nonexistent_id}", json={"status": "INACTIVE"})
    assert res_put.status_code == 404

    res_del = client.delete(f"/api/technicians/{nonexistent_id}")
    assert res_del.status_code == 404


def test_preserving_historical_work_orders(client, db_session):
    """Deactivating a technician retains all links to existing historical work orders."""
    tech = Technician(
        employee_id="TECH-AUDIT-01",
        name="Senior Inspector",
        email="senior.insp@maintainiq.internal",
        specialization="Quality",
        status="ACTIVE"
    )
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    db_session.add(tech)
    db_session.commit()
    db_session.refresh(tech)

    wo = WorkOrder(
        work_order_number="WO-AUDIT-3301",
        title="Completed Quality Audit",
        description="Comprehensive audit of manufacturing line",
        asset_id=asset.id,
        maintenance_type_id=maint_type.id,
        priority="MEDIUM",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=datetime.now(timezone.utc) - timedelta(days=1),
        estimated_hours=2.0,
        actual_hours=2.0,
        resolution_summary="Passed all safety checks"
    )
    db_session.add(wo)
    db_session.commit()

    # Deactivate technician
    res_deact = client.put(f"/api/technicians/{tech.id}", json={"status": "INACTIVE"})
    assert res_deact.status_code == 200

    # Verify work order still points to technician
    db_session.expire_all()
    db_session.refresh(wo)
    assert wo.assigned_technician_id == tech.id
    assert wo.technician.name == "Senior Inspector"
    assert wo.technician.status == "INACTIVE"


def test_preventing_unauthorized_deletion_when_authentication_exists(client, db_session):
    """When administrative authentication is configured, unauthorized deletion is rejected with 403 Forbidden."""
    from backend.app.config import settings
    orig_key = settings.ADMIN_API_KEY
    settings.ADMIN_API_KEY = "super-secret-admin-token"

    try:
        tech = Technician(
            employee_id="TECH-AUTH-01",
            name="Security Candidate",
            email="security.cand@maintainiq.internal",
            specialization="Security",
            status="ACTIVE"
        )
        db_session.add(tech)
        db_session.commit()
        db_session.refresh(tech)

        # 1. Attempt delete without auth header -> 403 Forbidden
        res_no_auth = client.delete(f"/api/technicians/{tech.id}")
        assert res_no_auth.status_code == 403
        assert "Administrative authorization required" in res_no_auth.json()["detail"]

        # 2. Attempt delete with invalid token -> 403 Forbidden
        res_bad_auth = client.delete(
            f"/api/technicians/{tech.id}",
            headers={"X-Admin-Key": "wrong-token"}
        )
        assert res_bad_auth.status_code == 403

        # 3. Attempt delete with valid admin key -> 200 OK
        res_ok = client.delete(
            f"/api/technicians/{tech.id}",
            headers={"X-Admin-Key": "super-secret-admin-token"}
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["success"] is True

        # Verify deleted
        deleted = db_session.query(Technician).filter(Technician.id == tech.id).first()
        assert deleted is None
    finally:
        settings.ADMIN_API_KEY = orig_key

