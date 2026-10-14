import os
import sys
from datetime import datetime, timezone, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory
from backend.app.services.analytics_service import compute_maintenance_analytics

def test_maintenance_analytics_empty_database(client, db_session):
    """When no work orders, assets or technicians exist, analytics returns safe zeroed metrics."""
    # Clear all data
    db_session.query(WorkOrderStatusHistory).delete()
    db_session.query(WorkOrder).delete()
    db_session.query(Asset).delete()
    db_session.query(Technician).delete()
    db_session.commit()

    res = client.get("/api/dashboard/analytics")
    assert res.status_code == 200
    data = res.json()

    assert data["summary"]["total_work_orders"] == 0
    assert data["summary"]["active_work_orders"] == 0
    assert data["summary"]["completed_work_orders"] == 0
    assert data["summary"]["cancelled_work_orders"] == 0
    assert data["summary"]["overdue_work_orders"] == 0
    assert data["summary"]["completion_rate_percentage"] == 0.0

    # Distributions should list statuses with 0 counts
    assert len(data["status_distribution"]) == 5
    assert all(item["count"] == 0 for item in data["status_distribution"])
    assert len(data["priority_distribution"]) == 4
    assert all(item["count"] == 0 for item in data["priority_distribution"])

    # Lists should be empty
    assert data["monthly_completion_trend"] == []
    assert data["technician_workloads"] == []
    assert data["frequently_maintained_assets"] == []
    assert data["overdue_metrics"]["overdue_count"] == 0


def test_maintenance_analytics_correct_counts_by_status_and_priority(client, db_session):
    """Accurately groups work order counts across statuses and priority tiers."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Create 1 OPEN Low
    wo_open = WorkOrder(
        work_order_number="WO-TEST-STAT-01",
        title="Open Low Task",
        description="Routine inspection",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="OPEN",
        scheduled_date=now + timedelta(days=2),
        estimated_hours=1.0
    )
    # Create 1 ASSIGNED Medium
    wo_assigned = WorkOrder(
        work_order_number="WO-TEST-STAT-02",
        title="Assigned Med Task",
        description="Assigned task",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="ASSIGNED",
        assigned_technician_id=tech.id,
        scheduled_date=now + timedelta(days=3),
        estimated_hours=2.0
    )
    # Create 1 IN_PROGRESS High
    wo_ip = WorkOrder(
        work_order_number="WO-TEST-STAT-03",
        title="In Progress High Task",
        description="Underway",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="IN_PROGRESS",
        assigned_technician_id=tech.id,
        scheduled_date=now + timedelta(days=1),
        estimated_hours=3.0
    )
    # Create 1 COMPLETED Critical
    wo_completed = WorkOrder(
        work_order_number="WO-TEST-STAT-04",
        title="Completed Critical Task",
        description="Finished emergency",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="CRITICAL",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=5),
        estimated_hours=4.0
    )
    # Create 1 CANCELLED Medium
    wo_cancelled = WorkOrder(
        work_order_number="WO-TEST-STAT-05",
        title="Cancelled Task",
        description="Not needed",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="CANCELLED",
        scheduled_date=now + timedelta(days=4),
        estimated_hours=1.5
    )

    db_session.add_all([wo_open, wo_assigned, wo_ip, wo_completed, wo_cancelled])
    db_session.commit()

    res = client.get("/api/dashboard/analytics")
    assert res.status_code == 200
    data = res.json()

    assert data["summary"]["total_work_orders"] == 5
    assert data["summary"]["active_work_orders"] == 3
    assert data["summary"]["completed_work_orders"] == 1
    assert data["summary"]["cancelled_work_orders"] == 1

    status_map = {item["status"]: item["count"] for item in data["status_distribution"]}
    assert status_map["OPEN"] == 1
    assert status_map["ASSIGNED"] == 1
    assert status_map["IN_PROGRESS"] == 1
    assert status_map["COMPLETED"] == 1
    assert status_map["CANCELLED"] == 1

    priority_map = {item["priority"]: item["count"] for item in data["priority_distribution"]}
    assert priority_map["LOW"] == 1
    assert priority_map["MEDIUM"] == 2
    assert priority_map["HIGH"] == 1
    assert priority_map["CRITICAL"] == 1


def test_maintenance_analytics_completed_versus_cancelled_orders(client, db_session):
    """Cancelled work orders are strictly distinguished from completed orders in trends and summary."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1 Completed
    wo_comp = WorkOrder(
        work_order_number="WO-COMP-ONLY-01",
        title="Completed",
        description="Done",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="COMPLETED",
        scheduled_date=now - timedelta(days=2),
        estimated_hours=2.0
    )
    # 2 Cancelled
    wo_canc1 = WorkOrder(
        work_order_number="WO-CANC-ONLY-01",
        title="Cancelled 1",
        description="Discarded",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="CANCELLED",
        scheduled_date=now - timedelta(days=3),
        estimated_hours=1.0
    )
    wo_canc2 = WorkOrder(
        work_order_number="WO-CANC-ONLY-02",
        title="Cancelled 2",
        description="Duplicate",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="CANCELLED",
        scheduled_date=now + timedelta(days=1),
        estimated_hours=1.0
    )
    db_session.add_all([wo_comp, wo_canc1, wo_canc2])
    db_session.commit()

    # Add completion history record for wo_comp only
    hist_comp = WorkOrderStatusHistory(
        work_order_id=wo_comp.id,
        from_status="IN_PROGRESS",
        to_status="COMPLETED",
        created_at=now
    )
    # Add cancellation history for wo_canc1
    hist_canc = WorkOrderStatusHistory(
        work_order_id=wo_canc1.id,
        from_status="OPEN",
        to_status="CANCELLED",
        created_at=now
    )
    db_session.add_all([hist_comp, hist_canc])
    db_session.commit()

    res = client.get("/api/dashboard/analytics")
    data = res.json()

    assert data["summary"]["completed_work_orders"] == 1
    assert data["summary"]["cancelled_work_orders"] == 2

    # Monthly completion trend must ONLY contain the completed order (count 1)
    trend = data["monthly_completion_trend"]
    total_trend_completed = sum(item["completed_count"] for item in trend)
    assert total_trend_completed == 1


def test_maintenance_analytics_correct_overdue_calculation(client, db_session):
    """
    Overdue is calculated strictly for nonterminal statuses (OPEN, ASSIGNED, IN_PROGRESS)
    whose scheduled_date is in the past (< now UTC).
    Completed and Cancelled orders with past scheduled dates must NOT be counted as overdue.
    """
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Past scheduled date + OPEN -> OVERDUE
    wo1 = WorkOrder(
        work_order_number="WO-OD-01",
        title="Overdue Open",
        description="Late",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="CRITICAL",
        status="OPEN",
        scheduled_date=now - timedelta(days=2),
        estimated_hours=1.0
    )
    # 2. Past scheduled date + ASSIGNED -> OVERDUE
    wo2 = WorkOrder(
        work_order_number="WO-OD-02",
        title="Overdue Assigned",
        description="Late",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="ASSIGNED",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=1),
        estimated_hours=2.0
    )
    # 3. Past scheduled date + IN_PROGRESS -> OVERDUE
    wo3 = WorkOrder(
        work_order_number="WO-OD-03",
        title="Overdue In Progress",
        description="Late",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="IN_PROGRESS",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(hours=4),
        estimated_hours=1.5
    )
    # 4. Past scheduled date + COMPLETED -> NOT OVERDUE (resolved!)
    wo4 = WorkOrder(
        work_order_number="WO-OD-04",
        title="Completed in past",
        description="Resolved on time or late",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="CRITICAL",
        status="COMPLETED",
        scheduled_date=now - timedelta(days=5),
        estimated_hours=2.0
    )
    # 5. Past scheduled date + CANCELLED -> NOT OVERDUE (terminal!)
    wo5 = WorkOrder(
        work_order_number="WO-OD-05",
        title="Cancelled in past",
        description="Voided",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="CANCELLED",
        scheduled_date=now - timedelta(days=3),
        estimated_hours=1.0
    )
    # 6. Future scheduled date + OPEN -> NOT OVERDUE (on schedule)
    wo6 = WorkOrder(
        work_order_number="WO-OD-06",
        title="Future open",
        description="Upcoming",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="OPEN",
        scheduled_date=now + timedelta(days=5),
        estimated_hours=1.0
    )

    db_session.add_all([wo1, wo2, wo3, wo4, wo5, wo6])
    db_session.commit()

    res = client.get("/api/dashboard/analytics")
    data = res.json()

    # Exactly 3 orders are overdue: wo1, wo2, wo3
    assert data["overdue_metrics"]["overdue_count"] == 3
    assert data["summary"]["overdue_work_orders"] == 3
    assert data["overdue_metrics"]["critical_overdue_count"] == 1  # wo1
    assert data["overdue_metrics"]["high_overdue_count"] == 1      # wo2


def test_maintenance_analytics_month_boundaries_trend(client, db_session):
    """
    Orders completed across month boundaries are accurately bucketed into their
    respective month without cross-contamination.
    """
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()

    # Create order 1: completed on 2026-08-31 23:55:00
    wo_aug = WorkOrder(
        work_order_number="WO-MO-AUG",
        title="Aug Completed",
        description="August wrap up",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="COMPLETED",
        scheduled_date=datetime(2026, 8, 30, 10, 0, 0),
        estimated_hours=1.0,
        updated_at=datetime(2026, 8, 31, 23, 55, 0)
    )
    # Create order 2: completed on 2026-09-01 00:05:00
    wo_sep = WorkOrder(
        work_order_number="WO-MO-SEP",
        title="Sep Completed",
        description="September start",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="COMPLETED",
        scheduled_date=datetime(2026, 9, 1, 9, 0, 0),
        estimated_hours=2.0,
        updated_at=datetime(2026, 9, 1, 0, 5, 0)
    )
    # Create order 3: completed on 2026-09-15 14:00:00
    wo_sep2 = WorkOrder(
        work_order_number="WO-MO-SEP2",
        title="Sep Mid Completed",
        description="September mid",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="COMPLETED",
        scheduled_date=datetime(2026, 9, 15, 10, 0, 0),
        estimated_hours=1.5,
        updated_at=datetime(2026, 9, 15, 14, 0, 0)
    )
    db_session.add_all([wo_aug, wo_sep, wo_sep2])
    db_session.commit()

    # Explicit completion history records with precise timestamps
    h_aug = WorkOrderStatusHistory(
        work_order_id=wo_aug.id,
        to_status="COMPLETED",
        created_at=datetime(2026, 8, 31, 23, 55, 0)
    )
    h_sep1 = WorkOrderStatusHistory(
        work_order_id=wo_sep.id,
        to_status="COMPLETED",
        created_at=datetime(2026, 9, 1, 0, 5, 0)
    )
    h_sep2 = WorkOrderStatusHistory(
        work_order_id=wo_sep2.id,
        to_status="COMPLETED",
        created_at=datetime(2026, 9, 15, 14, 0, 0)
    )
    db_session.add_all([h_aug, h_sep1, h_sep2])
    db_session.commit()

    res = client.get("/api/dashboard/analytics")
    data = res.json()
    trend = data["monthly_completion_trend"]

    month_counts = {item["month_key"]: item["completed_count"] for item in trend}
    assert month_counts.get("2026-08") == 1
    assert month_counts.get("2026-09") == 2


def test_maintenance_analytics_technician_workload_totals(client, db_session):
    """
    Accurately calculates active orders (ASSIGNED + IN_PROGRESS), completed orders,
    total assigned, and active estimated hours per technician.
    """
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()

    # Active tech
    tech = Technician(
        employee_id="TECH-METRIC-01",
        name="Samantha Sparks",
        email="samantha@maintainiq.test",
        specialization="Electrical",
        status="ACTIVE"
    )
    db_session.add(tech)
    db_session.commit()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1 ASSIGNED (2.5h)
    wo1 = WorkOrder(
        work_order_number="WO-TECH-01",
        title="Assigned Task",
        description="Assigned",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="ASSIGNED",
        assigned_technician_id=tech.id,
        scheduled_date=now + timedelta(days=2),
        estimated_hours=2.5
    )
    # 1 IN_PROGRESS (3.5h)
    wo2 = WorkOrder(
        work_order_number="WO-TECH-02",
        title="In Progress Task",
        description="Underway",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="IN_PROGRESS",
        assigned_technician_id=tech.id,
        scheduled_date=now + timedelta(days=1),
        estimated_hours=3.5
    )
    # 1 COMPLETED (1.0h)
    wo3 = WorkOrder(
        work_order_number="WO-TECH-03",
        title="Completed Task",
        description="Finished",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="LOW",
        status="COMPLETED",
        assigned_technician_id=tech.id,
        scheduled_date=now - timedelta(days=2),
        estimated_hours=1.0
    )
    db_session.add_all([wo1, wo2, wo3])
    db_session.commit()

    res = client.get("/api/dashboard/analytics")
    data = res.json()

    samantha = next((t for t in data["technician_workloads"] if t["technician_id"] == tech.id), None)
    assert samantha is not None
    assert samantha["active_work_orders_count"] == 2       # wo1 + wo2
    assert samantha["completed_work_orders_count"] == 1    # wo3
    assert samantha["total_assigned_count"] == 3           # wo1 + wo2 + wo3
    assert samantha["active_estimated_hours"] == 6.0       # 2.5 + 3.5
