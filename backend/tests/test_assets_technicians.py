import pytest
from datetime import datetime, timedelta
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType

def test_asset_lifecycle_and_history(client, db_session):
    # Register new asset
    res_asset = client.post("/api/assets", json={
        "asset_tag": "AST-NEW-99",
        "name": "Robotic Laser Cutter",
        "category": "Laser & Optics",
        "location": "Cleanroom 3",
        "status": "OPERATIONAL",
        "criticality": "HIGH",
        "notes": "Installed Q3 2026"
    })
    assert res_asset.status_code == 201
    asset_id = res_asset.json()["id"]

    # Prevent duplicate asset tag
    res_dup = client.post("/api/assets", json={
        "asset_tag": "AST-NEW-99",
        "name": "Duplicate Asset",
        "category": "Laser",
        "location": "Bay 1",
        "criticality": "LOW"
    })
    assert res_dup.status_code == 409

    # Edit asset
    res_edit = client.put(f"/api/assets/{asset_id}", json={
        "location": "Cleanroom 3 - Bay B",
        "status": "UNDER_MAINTENANCE"
    })
    assert res_edit.status_code == 200
    assert res_edit.json()["location"] == "Cleanroom 3 - Bay B"
    assert res_edit.json()["status"] == "UNDER_MAINTENANCE"

    # View asset detail
    res_detail = client.get(f"/api/assets/{asset_id}")
    assert res_detail.status_code == 200
    assert res_detail.json()["asset_tag"] == "AST-NEW-99"


def test_technician_registration_and_validation(client, db_session):
    # Register technician
    res_tech = client.post("/api/technicians", json={
        "employee_id": "TECH-NEW-01",
        "name": "Jordan Lee",
        "email": "jordan.lee@maintainiq.internal",
        "specialization": "Robotics & Vision",
        "status": "ACTIVE",
        "hourly_rate": 85.0
    })
    assert res_tech.status_code == 201
    tech_id = res_tech.json()["id"]

    # Reject duplicate email or employee ID
    res_dup = client.post("/api/technicians", json={
        "employee_id": "TECH-NEW-01",
        "name": "Duplicate Jordan",
        "email": "different@maintainiq.internal",
        "specialization": "Robotics"
    })
    assert res_dup.status_code == 409

    # Get technician detail with workload count
    res_get = client.get(f"/api/technicians/{tech_id}")
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "Jordan Lee"
    assert "assigned_work_orders_count" in res_get.json()
