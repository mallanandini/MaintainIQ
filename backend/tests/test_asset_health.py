import pytest
from datetime import datetime, timedelta
from backend.app.models.asset import Asset
from backend.app.models.work_order import WorkOrder
from backend.app.models.maintenance_type import MaintenanceType

def test_asset_health_missing_data_returns_insufficient_data(client, db_session):
    """
    If an asset lacks both operating metrics (hours/cycles) and maintenance logs,
    the system must return INSUFFICIENT_DATA rather than a misleading zero or arbitrary score.
    """
    empty_asset = Asset(
        asset_tag="AST-TEST-NODATA",
        name="Telemetry-Free Hydraulic Pump",
        category="Hydraulics",
        location="Depot Room 1",
        status="OPERATIONAL",
        criticality="MEDIUM",
        operating_hours=None,
        operating_cycles=None,
        service_threshold_hours=None,
        service_threshold_cycles=None
    )
    db_session.add(empty_asset)
    db_session.commit()

    res = client.get(f"/api/assets/{empty_asset.id}/health")
    assert res.status_code == 200
    data = res.json()

    assert data["has_sufficient_data"] is False
    assert data["risk_score"] is None
    assert data["risk_level"] == "INSUFFICIENT_DATA"
    assert data["status_label"] == "Insufficient Data"
    assert "Insufficient" in data["summary_explanation"]
    assert "does not predict mechanical equipment failure" in data["disclaimer"].lower()


def test_asset_health_scoring_boundaries(client, db_session):
    """
    Verify risk scoring boundaries:
    LOW: 0 - 24.9
    MODERATE: 25.0 - 49.9
    HIGH: 50.0 - 74.9
    CRITICAL: 75.0 - 100.0 (clamped at 100)
    """
    # 1. Low Risk Asset (Low usage 20%, no open issues)
    low_asset = Asset(
        asset_tag="AST-TEST-LOW",
        name="Low Risk Machine",
        category="Machinery",
        location="Bay 1",
        status="OPERATIONAL",
        criticality="LOW",
        operating_hours=1000.0,
        service_threshold_hours=5000.0  # 20%
    )
    # 2. Moderate Risk Asset (High usage 90% -> +15, 1 routine open order -> +5 = 20-35)
    mod_asset = Asset(
        asset_tag="AST-TEST-MOD",
        name="Moderate Risk Machine",
        category="Machinery",
        location="Bay 2",
        status="OPERATIONAL",
        criticality="MEDIUM",
        operating_hours=4500.0,
        service_threshold_hours=5000.0  # 90% -> +15
    )
    # 3. High Risk Asset (Threshold exceeded -> +25, 1 high open -> +10, 1 recent corrective -> +10 = 45-65)
    high_asset = Asset(
        asset_tag="AST-TEST-HIGH",
        name="High Risk Machine",
        category="Machinery",
        location="Bay 3",
        status="OPERATIONAL",
        criticality="HIGH",
        operating_hours=5500.0,
        service_threshold_hours=5000.0  # 110% -> +25
    )
    # 4. Critical Risk Asset (Threshold exceeded +25, critical open +25, overdue +25 = 75+)
    crit_asset = Asset(
        asset_tag="AST-TEST-CRIT",
        name="Critical Risk Machine",
        category="Machinery",
        location="Bay 4",
        status="OPERATIONAL",
        criticality="CRITICAL",
        operating_hours=6000.0,
        service_threshold_hours=5000.0  # +25
    )
    db_session.add_all([low_asset, mod_asset, high_asset, crit_asset])
    db_session.commit()

    maint = db_session.query(MaintenanceType).first()
    m_corr = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    now = datetime.utcnow()

    # Add 1 high open order to mod_asset (90% threshold = +15, high open = +10 -> 25 = MODERATE)
    wo_mod = WorkOrder(
        work_order_number="WO-MOD-01",
        title="Belt inspection",
        description="Routine check",
        asset_id=mod_asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="OPEN",
        scheduled_date=now + timedelta(days=3),
        estimated_hours=2.0
    )
    # Add high open (+10), corrective completed (+10), overdue (+15), threshold (+25) -> 60 = HIGH
    wo_high1 = WorkOrder(
        work_order_number="WO-HIGH-01",
        title="Vibration check",
        description="High vibration",
        asset_id=high_asset.id,
        maintenance_type_id=maint.id,
        priority="HIGH",
        status="IN_PROGRESS",
        scheduled_date=now + timedelta(days=2),
        estimated_hours=3.0
    )
    wo_high2 = WorkOrder(
        work_order_number="WO-HIGH-02",
        title="Previous bearing replacement",
        description="Bearing replaced",
        asset_id=high_asset.id,
        maintenance_type_id=m_corr.id if m_corr else maint.id,
        priority="HIGH",
        status="COMPLETED",
        scheduled_date=now - timedelta(days=20),
        estimated_hours=3.0
    )
    wo_high3 = WorkOrder(
        work_order_number="WO-HIGH-03",
        title="Overdue high asset task",
        description="Overdue",
        asset_id=high_asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="OPEN",
        scheduled_date=now - timedelta(days=2),
        estimated_hours=1.0
    )
    # Add critical open, 2 overdue orders to crit_asset
    wo_crit1 = WorkOrder(
        work_order_number="WO-CRIT-01",
        title="Critical Hydraulic Failure",
        description="Pressure zero",
        asset_id=crit_asset.id,
        maintenance_type_id=maint.id,
        priority="CRITICAL",
        status="OPEN",
        scheduled_date=now - timedelta(days=2),  # Overdue & Critical open!
        estimated_hours=5.0
    )
    wo_crit2 = WorkOrder(
        work_order_number="WO-CRIT-02",
        title="Overdue Valve Service",
        description="Past scheduled date",
        asset_id=crit_asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="ASSIGNED",
        scheduled_date=now - timedelta(days=5),  # Overdue!
        estimated_hours=2.0
    )
    db_session.add_all([wo_mod, wo_high1, wo_high2, wo_high3, wo_crit1, wo_crit2])
    db_session.commit()

    # Check LOW
    res_low = client.get(f"/api/assets/{low_asset.id}/health")
    data_low = res_low.json()
    assert data_low["risk_level"] == "LOW"
    assert data_low["risk_score"] < 25.0

    # Check MODERATE
    res_mod = client.get(f"/api/assets/{mod_asset.id}/health")
    data_mod = res_mod.json()
    assert data_mod["risk_level"] == "MODERATE"
    assert 25.0 <= data_mod["risk_score"] < 50.0

    # Check HIGH
    res_high = client.get(f"/api/assets/{high_asset.id}/health")
    data_high = res_high.json()
    assert data_high["risk_level"] == "HIGH"
    assert 50.0 <= data_high["risk_score"] < 75.0

    # Check CRITICAL
    res_crit = client.get(f"/api/assets/{crit_asset.id}/health")
    data_crit = res_crit.json()
    assert data_crit["risk_level"] == "CRITICAL"
    assert data_crit["risk_score"] >= 75.0
    assert data_crit["risk_score"] <= 100.0


def test_asset_health_overdue_work_orders_impact(client, db_session):
    """
    Overdue non-terminal work orders (scheduled_date < now_utc)
    increment overdue score points and set needs_maintenance_attention = True.
    """
    asset = Asset(
        asset_tag="AST-TEST-OVERDUE",
        name="Overdue Pump",
        category="Pumps",
        location="Basement",
        status="OPERATIONAL",
        criticality="MEDIUM",
        operating_hours=2000.0,
        service_threshold_hours=5000.0
    )
    db_session.add(asset)
    db_session.commit()

    maint = db_session.query(MaintenanceType).first()
    now = datetime.utcnow()

    # Create 1 overdue order
    wo_overdue = WorkOrder(
        work_order_number="WO-OD-01",
        title="Delayed Calibration",
        description="Overdue check",
        asset_id=asset.id,
        maintenance_type_id=maint.id,
        priority="MEDIUM",
        status="OPEN",
        scheduled_date=now - timedelta(days=3),
        estimated_hours=2.0
    )
    db_session.add(wo_overdue)
    db_session.commit()

    res = client.get(f"/api/assets/{asset.id}/health")
    data = res.json()

    assert data["maintenance_metrics"]["overdue_work_orders_count"] == 1
    assert data["needs_maintenance_attention"] is True
    overdue_factors = [f for f in data["contributing_factors"] if f["category"] == "OVERDUE_MAINTENANCE"]
    assert len(overdue_factors) == 1
    assert overdue_factors[0]["impact_points"] == 15.0


def test_asset_health_out_of_service_status_floor(client, db_session):
    """
    An OUT_OF_SERVICE asset represents an inoperable machine and
    must receive a critical risk floor (>= 75.0).
    """
    oos_asset = Asset(
        asset_tag="AST-TEST-OOS",
        name="Broken Stamping Press",
        category="Hydraulics",
        location="Shop Floor 2",
        status="OUT_OF_SERVICE",
        criticality="CRITICAL",
        operating_hours=1000.0,
        service_threshold_hours=5000.0
    )
    db_session.add(oos_asset)
    db_session.commit()

    res = client.get(f"/api/assets/{oos_asset.id}/health")
    data = res.json()

    assert data["risk_level"] == "CRITICAL"
    assert data["risk_score"] >= 75.0
    status_factors = [f for f in data["contributing_factors"] if f["category"] == "STATUS_OVERRIDE"]
    assert len(status_factors) == 1
    assert "OUT_OF_SERVICE" in status_factors[0]["description"]


def test_fleet_asset_health_endpoint_and_filters(client, db_session):
    """
    Test GET /api/assets/health overview endpoint with summary and category/status/risk filtering.
    """
    res = client.get("/api/assets/health")
    assert res.status_code == 200
    data = res.json()

    assert "summary" in data
    assert "formula_documentation" in data
    assert "disclaimer" in data
    assert "items" in data

    summary = data["summary"]
    assert summary["total_assets"] >= 1
    assert summary["critical_risk_count"] >= 0
    assert summary["insufficient_data_count"] >= 0

    # Test filtering by risk_level
    res_crit = client.get("/api/assets/health?risk_level=CRITICAL")
    assert res_crit.status_code == 200
    crit_items = res_crit.json()["items"]
    assert all(item["risk_level"] == "CRITICAL" for item in crit_items)

    # Test non-existent asset 404
    res_404 = client.get("/api/assets/999999/health")
    assert res_404.status_code == 404
