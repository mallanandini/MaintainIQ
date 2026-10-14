from datetime import datetime, timezone, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory

def test_asset_with_multiple_maintenance_records(client, db_session):
    """
    Test that an asset with multiple maintenance records returns all records
    with full details: work_order_number, maintenance_type, description, priority,
    technician, status, scheduled_date, created_date, and completed_date.
    """
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    m_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    m_corr = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Create completed work order
    wo_completed = WorkOrder(
        work_order_number="WO-HIST-COMP-01",
        title="Completed Pump Overhaul",
        description="Full mechanical teardown and rotor replacement",
        asset_id=asset.id,
        maintenance_type_id=m_corr.id,
        priority="HIGH",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=5),
        actual_hours=4.5,
        resolution_summary="Successfully rebuilt hydraulic seals and tested flow rate.",
        created_at=now - timedelta(days=7),
        updated_at=now - timedelta(days=5)
    )
    db_session.add(wo_completed)
    db_session.flush()

    db_session.add(WorkOrderStatusHistory(
        work_order_id=wo_completed.id,
        from_status="IN_PROGRESS",
        to_status="COMPLETED",
        changed_by="Lead Tech",
        notes="Work fully verified.",
        created_at=now - timedelta(days=5)
    ))

    # 2. Create in-progress work order
    wo_progress = WorkOrder(
        work_order_number="WO-HIST-PROG-02",
        title="Active Sensor Recalibration",
        description="Pressure transducer sensor output alignment",
        asset_id=asset.id,
        maintenance_type_id=m_prev.id,
        priority="MEDIUM",
        status="IN_PROGRESS",
        assigned_technician_id=tech.id,
        scheduled_date=now + timedelta(days=1),
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(hours=1)
    )
    db_session.add(wo_progress)

    # 3. Create open unassigned work order
    wo_open = WorkOrder(
        work_order_number="WO-HIST-OPEN-03",
        title="Upcoming Quarterly Lubrication",
        description="Apply synthetic grease to motor bearings",
        asset_id=asset.id,
        maintenance_type_id=m_prev.id,
        priority="LOW",
        status="OPEN",
        assigned_technician_id=None,
        scheduled_date=now + timedelta(days=4),
        created_at=now - timedelta(hours=3),
        updated_at=now - timedelta(hours=3)
    )
    db_session.add(wo_open)
    db_session.commit()

    # Request maintenance history
    res = client.get(f"/api/assets/{asset.id}/maintenance-history")
    assert res.status_code == 200
    records = res.json()
    assert len(records) == 3

    # Check required fields exist across records
    for rec in records:
        assert "work_order_number" in rec
        assert "maintenance_type" in rec and rec["maintenance_type"] is not None
        assert "description" in rec
        assert "priority" in rec
        assert "status" in rec
        assert "scheduled_date" in rec
        assert "created_date" in rec
        assert "completed_date" in rec

    # Find the completed record and verify completed_date is populated
    comp_rec = next(r for r in records if r["work_order_number"] == "WO-HIST-COMP-01")
    assert comp_rec["status"] == "COMPLETED"
    assert comp_rec["completed_date"] is not None
    assert comp_rec["resolution_summary"] == "Successfully rebuilt hydraulic seals and tested flow rate."
    assert comp_rec["technician"]["name"] == tech.name

    # Check non-completed records have completed_date as None
    open_rec = next(r for r in records if r["work_order_number"] == "WO-HIST-OPEN-03")
    assert open_rec["status"] == "OPEN"
    assert open_rec["completed_date"] is None
    assert open_rec["technician"] is None


def test_asset_with_no_maintenance_records(client, db_session):
    """An asset with zero maintenance records returns an empty list and 200 OK."""
    # Create brand new asset with no work orders
    new_asset = Asset(
        asset_tag="AST-PRISTINE-01",
        name="Brand New Unused CNC Mill",
        category="Machinery",
        location="Shop Floor Bay 7",
        status="OPERATIONAL",
        criticality="LOW"
    )
    db_session.add(new_asset)
    db_session.commit()

    res = client.get(f"/api/assets/{new_asset.id}/maintenance-history")
    assert res.status_code == 200
    assert res.json() == []
    assert res.headers.get("X-Total-Count") == "0"


def test_invalid_asset_id_returns_404(client, db_session):
    """Querying maintenance history for a nonexistent asset ID must return 404."""
    res = client.get("/api/assets/99999/maintenance-history")
    assert res.status_code == 404
    assert "Asset with ID 99999 does not exist" in res.json()["detail"]


def test_correct_chronological_ordering_newest_first(client, db_session):
    """Records must be returned strictly in newest-first chronological order."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Insert three work orders with distinct created_at dates
    dates = [
        now - timedelta(days=10), # Oldest
        now - timedelta(days=5),  # Middle
        now - timedelta(hours=2), # Newest
    ]

    for idx, dt in enumerate(dates):
        wo = WorkOrder(
            work_order_number=f"WO-CHRONO-{idx}",
            title=f"Chrono Task {idx}",
            description="Ordering verification",
            asset_id=asset.id,
            maintenance_type_id=maint_type.id,
            priority="LOW",
            status="OPEN",
            scheduled_date=now + timedelta(days=idx + 1),
            created_at=dt,
            updated_at=dt
        )
        db_session.add(wo)
    db_session.commit()

    res = client.get(f"/api/assets/{asset.id}/maintenance-history")
    assert res.status_code == 200
    records = res.json()
    assert len(records) >= 3

    # Ensure the first record is the newest (WO-CHRONO-2) and last is oldest (WO-CHRONO-0)
    numbers = [r["work_order_number"] for r in records if r["work_order_number"].startswith("WO-CHRONO-")]
    assert numbers == ["WO-CHRONO-2", "WO-CHRONO-1", "WO-CHRONO-0"]

    # Verify timestamp monotonicity
    created_timestamps = [datetime.fromisoformat(r["created_date"].replace("Z", "+00:00")) for r in records]
    for i in range(len(created_timestamps) - 1):
        assert created_timestamps[i] >= created_timestamps[i + 1]


def test_correct_association_between_assets_and_work_orders(client, db_session):
    """Work orders returned for Asset A must not include work orders for Asset B."""
    asset_a = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    asset_b = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-02").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    maint_emerg = db_session.query(MaintenanceType).filter(MaintenanceType.code == "EMERGENCY").first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 2 work orders for Asset A
    wo_a1 = WorkOrder(
        work_order_number="WO-ASSET-A-1",
        title="Asset A Inspection 1",
        description="Targeting Asset A exclusively",
        asset_id=asset_a.id,
        maintenance_type_id=maint_type.id,
        priority="LOW",
        status="OPEN",
        scheduled_date=now + timedelta(days=1),
        created_at=now - timedelta(days=2),
    )
    wo_a2 = WorkOrder(
        work_order_number="WO-ASSET-A-2",
        title="Asset A Inspection 2",
        description="Targeting Asset A exclusively",
        asset_id=asset_a.id,
        maintenance_type_id=maint_type.id,
        priority="MEDIUM",
        status="OPEN",
        scheduled_date=now + timedelta(days=2),
        created_at=now - timedelta(days=1),
    )

    # 2 work orders for Asset B
    wo_b1 = WorkOrder(
        work_order_number="WO-ASSET-B-1",
        title="Asset B Emergency Fix 1",
        description="Targeting Asset B exclusively",
        asset_id=asset_b.id,
        maintenance_type_id=maint_emerg.id,
        priority="CRITICAL",
        status="OPEN",
        scheduled_date=now + timedelta(hours=3),
        created_at=now - timedelta(hours=5),
    )
    wo_b2 = WorkOrder(
        work_order_number="WO-ASSET-B-2",
        title="Asset B Emergency Fix 2",
        description="Targeting Asset B exclusively",
        asset_id=asset_b.id,
        maintenance_type_id=maint_emerg.id,
        priority="HIGH",
        status="OPEN",
        scheduled_date=now + timedelta(hours=4),
        created_at=now - timedelta(hours=2),
    )

    db_session.add_all([wo_a1, wo_a2, wo_b1, wo_b2])
    db_session.commit()

    # Query Asset A history
    res_a = client.get(f"/api/assets/{asset_a.id}/maintenance-history")
    records_a = res_a.json()
    numbers_a = [r["work_order_number"] for r in records_a]
    assert "WO-ASSET-A-1" in numbers_a
    assert "WO-ASSET-A-2" in numbers_a
    assert "WO-ASSET-B-1" not in numbers_a
    assert "WO-ASSET-B-2" not in numbers_a

    # Query Asset B history
    res_b = client.get(f"/api/assets/{asset_b.id}/maintenance-history")
    records_b = res_b.json()
    numbers_b = [r["work_order_number"] for r in records_b]
    assert "WO-ASSET-B-1" in numbers_b
    assert "WO-ASSET-B-2" in numbers_b
    assert "WO-ASSET-A-1" not in numbers_b
    assert "WO-ASSET-A-2" not in numbers_b


def test_asset_maintenance_history_pagination(client, db_session):
    """Pagination query params (page and page_size) correctly partition the history result set."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_type = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Insert 5 work orders
    for i in range(5):
        wo = WorkOrder(
            work_order_number=f"WO-PAGE-{i}",
            title=f"Page Test Order {i}",
            description="Testing pagination",
            asset_id=asset.id,
            maintenance_type_id=maint_type.id,
            priority="LOW",
            status="OPEN",
            scheduled_date=now + timedelta(days=i + 1),
            created_at=now - timedelta(hours=10 - i),
        )
        db_session.add(wo)
    db_session.commit()

    # Page 1, size 2 -> should return first 2
    res_p1 = client.get(f"/api/assets/{asset.id}/maintenance-history?page=1&page_size=2")
    assert res_p1.status_code == 200
    p1_items = res_p1.json()
    assert len(p1_items) == 2
    assert res_p1.headers.get("X-Total-Count") == "5"

    # Page 2, size 2 -> should return next 2
    res_p2 = client.get(f"/api/assets/{asset.id}/maintenance-history?page=2&page_size=2")
    assert res_p2.status_code == 200
    p2_items = res_p2.json()
    assert len(p2_items) == 2
    assert res_p2.headers.get("X-Total-Count") == "5"

    # Ensure no overlap between page 1 and page 2
    p1_ids = {r["id"] for r in p1_items}
    p2_ids = {r["id"] for r in p2_items}
    assert p1_ids.isdisjoint(p2_ids)

    # Page 3, size 2 -> should return remaining 1
    res_p3 = client.get(f"/api/assets/{asset.id}/maintenance-history?page=3&page_size=2")
    assert res_p3.status_code == 200
    p3_items = res_p3.json()
    assert len(p3_items) == 1
