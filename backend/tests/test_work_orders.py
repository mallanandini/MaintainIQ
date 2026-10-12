from datetime import datetime, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType

def test_work_order_search_and_combined_filters(client, db_session):
    asset1 = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_prev = db_session.query(MaintenanceType).filter(MaintenanceType.code == "PREVENTATIVE").first()
    maint_corr = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    tech1 = db_session.query(Technician).filter(Technician.employee_id == "TECH-T1").first()

    # Create Order A
    res_a = client.post("/api/work-orders", json={
        "title": "Chiller Compressor Vibration Anomaly",
        "description": "Excess vibration detected on motor housing",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_corr.id,
        "priority": "HIGH",
        "assigned_technician_id": tech1.id,
        "scheduled_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "estimated_hours": 3.0
    })
    assert res_a.status_code == 201

    # Create Order B
    res_b = client.post("/api/work-orders", json={
        "title": "Quarterly Filter Cleaning",
        "description": "Routine filter dust purge",
        "asset_id": asset1.id,
        "maintenance_type_id": maint_prev.id,
        "priority": "LOW",
        "assigned_technician_id": None,
        "scheduled_date": (datetime.utcnow() + timedelta(days=3)).isoformat(),
        "estimated_hours": 1.0
    })
    assert res_b.status_code == 201

    # Test search query 'Vibration'
    res_search = client.get("/api/work-orders?q=Vibration")
    assert res_search.status_code == 200
    items = res_search.json()
    assert len(items) == 1
    assert "Vibration" in items[0]["title"]

    # Test search query by Work Order Number
    wo_num = res_b.json()["work_order_number"]
    res_wo_search = client.get(f"/api/work-orders?q={wo_num}")
    assert res_wo_search.status_code == 200
    assert len(res_wo_search.json()) == 1
    assert res_wo_search.json()[0]["work_order_number"] == wo_num

    # Test combined filter: priority=HIGH and status=ASSIGNED and technician_id=tech1.id
    res_filter = client.get(f"/api/work-orders?priority=HIGH&status=ASSIGNED&technician_id={tech1.id}")
    assert res_filter.status_code == 200
    assert len(res_filter.json()) == 1
    assert res_filter.json()[0]["title"] == "Chiller Compressor Vibration Anomaly"

    # Test conflicting combined filter: priority=LOW and technician_id=tech1.id (Order B is unassigned)
    res_empty = client.get(f"/api/work-orders?priority=LOW&technician_id={tech1.id}")
    assert res_empty.status_code == 200
    assert len(res_empty.json()) == 0
