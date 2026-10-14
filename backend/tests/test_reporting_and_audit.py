import io
import csv
from datetime import datetime, timezone, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory

def test_work_orders_export_csv_with_filters_and_empty(client, db_session):
    """Test CSV export endpoint with various filters and empty results."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Create work orders
    wo1 = WorkOrder(
        work_order_number="WO-EXP-001",
        title="Pump Bearing Inspection",
        description="Check mechanical wear",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="OPEN",
        scheduled_date=now + timedelta(days=2),
        created_at=now - timedelta(days=5),
        estimated_hours=4.0
    )
    wo2 = WorkOrder(
        work_order_number="WO-EXP-002",
        title="Conveyor Lubrication",
        description="Routine lube",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=1),
        created_at=now - timedelta(days=4),
        actual_hours=2.5,
        estimated_hours=2.0
    )
    db_session.add_all([wo1, wo2])
    db_session.commit()

    # Add a completion history record for wo2
    hist2 = WorkOrderStatusHistory(
        work_order_id=wo2.id,
        from_status="IN_PROGRESS",
        to_status="COMPLETED",
        created_at=now - timedelta(days=1)
    )
    db_session.add(hist2)
    db_session.commit()

    # 1. Export all work orders
    res = client.get("/api/work-orders/export")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=" in res.headers["content-disposition"]
    assert ".csv" in res.headers["content-disposition"]
    reader = list(csv.reader(io.StringIO(res.text)))
    assert len(reader) == 3 # Header + 2 rows
    assert reader[0][0] == "Work Order Number"

    # 2. Filter by status=COMPLETED
    res_completed = client.get("/api/work-orders/export?status=COMPLETED")
    assert res_completed.status_code == 200
    reader_completed = list(csv.reader(io.StringIO(res_completed.text)))
    assert len(reader_completed) == 2 # Header + 1 row
    assert reader_completed[1][0] == "WO-EXP-002"
    assert reader_completed[1][2] == "COMPLETED"

    # 3. Filter with no matching records (empty)
    res_empty = client.get("/api/work-orders/export?priority=CRITICAL")
    assert res_empty.status_code == 200
    reader_empty = list(csv.reader(io.StringIO(res_empty.text)))
    assert len(reader_empty) == 1 # Only header
    assert reader_empty[0][0] == "Work Order Number"

    # 4. Filter by search query 'q'
    res_search = client.get("/api/work-orders/export?q=Bearing")
    assert res_search.status_code == 200
    reader_search = list(csv.reader(io.StringIO(res_search.text)))
    assert len(reader_search) == 2
    assert reader_search[1][0] == "WO-EXP-001"


def test_asset_maintenance_history_filtering_and_export(client, db_session):
    """Test asset maintenance history filtering by date, status, and CSV export."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    wo1 = WorkOrder(
        work_order_number="WO-HIST-01",
        title="Seal Replacement",
        description="Replace worn mechanical seals",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=now + timedelta(days=1),
        created_at=now - timedelta(days=10),
        actual_hours=3.0
    )
    wo2 = WorkOrder(
        work_order_number="WO-HIST-02",
        title="Motor Calibration",
        description="Calibrate rotor velocity",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="OPEN",
        scheduled_date=now + timedelta(days=2),
        created_at=now - timedelta(days=2),
        actual_hours=None
    )
    db_session.add_all([wo1, wo2])
    db_session.commit()

    hist1 = WorkOrderStatusHistory(
        work_order_id=wo1.id,
        from_status="IN_PROGRESS",
        to_status="COMPLETED",
        created_at=now - timedelta(days=9)
    )
    db_session.add(hist1)
    db_session.commit()

    # Query with date filter
    start_filter = (now - timedelta(days=5)).isoformat()
    res_filtered = client.get(f"/api/assets/{asset.id}/maintenance-history?start_date={start_filter}")
    assert res_filtered.status_code == 200
    items = res_filtered.json()
    assert len(items) == 1
    assert items[0]["work_order_number"] == "WO-HIST-02"

    # Query with status filter
    res_status = client.get(f"/api/assets/{asset.id}/maintenance-history?status=COMPLETED")
    assert res_status.status_code == 200
    assert len(res_status.json()) == 1
    assert res_status.json()[0]["work_order_number"] == "WO-HIST-01"

    # Export CSV
    res_csv = client.get(f"/api/assets/{asset.id}/maintenance-history/export")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    reader = list(csv.reader(io.StringIO(res_csv.text)))
    assert len(reader) == 3 # Header + 2 records
    assert reader[0][0] == "Work Order Number"

    # Export with filter
    res_csv_filtered = client.get(f"/api/assets/{asset.id}/maintenance-history/export?status=COMPLETED")
    assert res_csv_filtered.status_code == 200
    reader_f = list(csv.reader(io.StringIO(res_csv_filtered.text)))
    assert len(reader_f) == 2


def test_reporting_date_range_filters_and_statistics(client, db_session):
    """Test date-range filtering, completion & cancellation statistics on analytics endpoint."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Old completed order (30 days ago)
    wo_old = WorkOrder(
        work_order_number="WO-RPT-OLD",
        title="Old Completed Job",
        description="Previous month maintenance overhaul",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=29),
        created_at=now - timedelta(days=30),
        actual_hours=5.0
    )

    # 2. Recent completed order (2 days ago, took 10 hours)
    wo_recent_comp = WorkOrder(
        work_order_number="WO-RPT-RECENT-COMP",
        title="Recent Completed Job",
        description="Recent completed task inspection",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=1),
        created_at=now - timedelta(days=2),
        actual_hours=8.0
    )

    # 3. Recent cancelled order (1 day ago)
    wo_recent_canc = WorkOrder(
        work_order_number="WO-RPT-RECENT-CANC",
        title="Recent Cancelled Job",
        description="Duplicate entry for maintenance task",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="CANCELLED",
        scheduled_date=now + timedelta(days=1),
        cancellation_reason="Parts obsolete or duplicated",
        created_at=now - timedelta(days=1)
    )

    # 4. Open order (today)
    wo_open = WorkOrder(
        work_order_number="WO-RPT-OPEN",
        title="Open Job Today",
        description="Currently pending review",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="OPEN",
        scheduled_date=now + timedelta(days=3),
        created_at=now
    )

    db_session.add_all([wo_old, wo_recent_comp, wo_recent_canc, wo_open])
    db_session.commit()

    # Add history for completed orders
    hist_old = WorkOrderStatusHistory(
        work_order_id=wo_old.id,
        from_status="IN_PROGRESS",
        to_status="COMPLETED",
        created_at=now - timedelta(days=29)
    )
    hist_recent = WorkOrderStatusHistory(
        work_order_id=wo_recent_comp.id,
        from_status="IN_PROGRESS",
        to_status="COMPLETED",
        created_at=now - timedelta(days=1)
    )
    db_session.add_all([hist_old, hist_recent])
    db_session.commit()

    # Unfiltered analytics
    res_all = client.get("/api/dashboard/analytics")
    assert res_all.status_code == 200
    all_data = res_all.json()
    assert all_data["summary"]["total_work_orders"] == 4
    assert all_data["summary"]["completed_work_orders"] == 2
    assert all_data["summary"]["cancelled_work_orders"] == 1
    assert all_data["summary"]["completion_rate_percentage"] == 50.0
    assert all_data["summary"]["cancellation_rate_percentage"] == 25.0

    # Filtered by date range: last 7 days only
    start_7d = (now - timedelta(days=7)).isoformat()
    res_filtered = client.get(f"/api/dashboard/analytics?start_date={start_7d}")
    assert res_filtered.status_code == 200
    f_data = res_filtered.json()
    assert f_data["summary"]["total_work_orders"] == 3 # excludes wo_old
    assert f_data["summary"]["completed_work_orders"] == 1
    assert f_data["summary"]["cancelled_work_orders"] == 1
    # 1/3 = 33.3%
    assert round(f_data["summary"]["completion_rate_percentage"], 1) == 33.3
    assert round(f_data["summary"]["cancellation_rate_percentage"], 1) == 33.3
    # Check cancellation reason breakdown
    assert len(f_data["summary"]["cancellation_reasons_breakdown"]) == 1
    assert f_data["summary"]["cancellation_reasons_breakdown"][0]["reason"] == "Parts obsolete or duplicated"


def test_overdue_work_orders_report_and_export(client, db_session):
    """Test overdue work orders report endpoint and CSV export."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Overdue open order (scheduled 3 days ago)
    wo_overdue = WorkOrder(
        work_order_number="WO-OD-01",
        title="Overdue Hydraulics Fix",
        description="Urgent hydraulics check overdue",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="IN_PROGRESS",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=3),
        created_at=now - timedelta(days=5)
    )

    # 2. Not overdue (scheduled 2 days in future)
    wo_future = WorkOrder(
        work_order_number="WO-OD-02",
        title="Future Check",
        description="Planned preventative scheduled ahead",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="OPEN",
        scheduled_date=now + timedelta(days=2),
        created_at=now
    )

    # 3. Scheduled in past but COMPLETED (should NOT be overdue)
    wo_completed = WorkOrder(
        work_order_number="WO-OD-03",
        title="Past Finished Check",
        description="Past order already finished",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="COMPLETED",
        scheduled_date=now - timedelta(days=4),
        created_at=now - timedelta(days=5)
    )

    db_session.add_all([wo_overdue, wo_future, wo_completed])
    db_session.commit()

    hist_completed = WorkOrderStatusHistory(
        work_order_id=wo_completed.id,
        from_status="IN_PROGRESS",
        to_status="COMPLETED",
        created_at=now - timedelta(days=3)
    )
    db_session.add(hist_completed)
    db_session.commit()

    # Test JSON endpoint
    res = client.get("/api/dashboard/reports/overdue")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["work_order_number"] == "WO-OD-01"
    assert data[0]["days_overdue"] >= 2
    assert data[0]["technician_name"] == tech.name

    # Test CSV export
    res_csv = client.get("/api/dashboard/reports/overdue/export")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    reader = list(csv.reader(io.StringIO(res_csv.text)))
    assert len(reader) == 2 # Header + 1 overdue order
    assert reader[0][0] == "Work Order Number"
    assert reader[1][0] == "WO-OD-01"


def test_technician_workload_report_and_export(client, db_session):
    """Test technician workload report endpoint and CSV export."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Add active work orders to tech
    wo1 = WorkOrder(
        work_order_number="WO-WL-01",
        title="Critical Pump Repair",
        description="Immediate repair of failed cooling pump",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="CRITICAL",
        status="IN_PROGRESS",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=1), # overdue
        created_at=now - timedelta(days=2)
    )
    wo2 = WorkOrder(
        work_order_number="WO-WL-02",
        title="High Valve Inspection",
        description="Inspect high pressure relief valve",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="ASSIGNED",
        assigned_technician_id=tech.id,
        scheduled_date=now + timedelta(days=1),
        created_at=now
    )
    db_session.add_all([wo1, wo2])
    db_session.commit()

    # Test JSON endpoint
    res = client.get("/api/dashboard/reports/technician-workload")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    tech_data = next((item for item in data if item["employee_id"] == "TECH-T1"), None)
    assert tech_data is not None
    assert tech_data["active_work_orders_count"] >= 2

    # Test CSV export
    res_csv = client.get("/api/dashboard/reports/technician-workload/export")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    reader = list(csv.reader(io.StringIO(res_csv.text)))
    assert len(reader) >= 2 # Header + technicians
    assert reader[0][0] == "Employee ID"
