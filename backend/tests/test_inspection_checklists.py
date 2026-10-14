import os
import io
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder
from backend.app.models.checklist import ChecklistTemplate, ChecklistTemplateItem, WorkOrderChecklist, WorkOrderChecklistItem

def test_checklist_template_creation_and_listing(client: TestClient, db_session):
    """Test creating inspection checklist templates and listing them with filters."""
    # Create template
    payload = {
        "title": "Hydraulic Power Unit Daily Checklist",
        "description": "Daily inspection for high-pressure hydraulic skids.",
        "asset_category": "Hydraulics",
        "maintenance_type_id": None,
        "items": [
            {
                "order_index": 1,
                "item_text": "Check reservoir fluid level and sight glass",
                "description": "Level must be in green operating band.",
                "is_required": True
            },
            {
                "order_index": 2,
                "item_text": "Inspect supply and return line connections",
                "description": "Ensure no oil seepage or hose weeping.",
                "is_required": True
            },
            {
                "order_index": 3,
                "item_text": "Check acoustic vibration signature",
                "description": "Listen for pump cavitation or erratic harmonics.",
                "is_required": False
            }
        ]
    }
    res = client.post("/api/checklists/templates", json=payload)
    assert res.status_code == 201
    created = res.json()
    assert created["title"] == payload["title"]
    assert len(created["items"]) == 3
    template_id = created["id"]

    # Fetch template by ID
    get_res = client.get(f"/api/checklists/templates/{template_id}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == payload["title"]

    # Filter templates by category
    filter_res = client.get("/api/checklists/templates", params={"asset_category": "Hydraulics"})
    assert filter_res.status_code == 200
    templates = filter_res.json()
    assert any(t["id"] == template_id for t in templates)


def test_checklist_initialization_and_snapshot_isolation(client: TestClient, db_session):
    """
    Test checklist initialization snapshots items from template.
    Modifying the original template afterwards must NOT alter the work order's historical checklist.
    """
    # 1. Create asset, maintenance type, and work order
    asset = Asset(asset_tag="TEST-CK-01", name="Test CNC", category="CNC Machinery", location="Bay 1", status="OPERATIONAL")
    db_session.add(asset)
    mt = MaintenanceType(code="TEST_PM", name="Preventative", is_emergency=False)
    db_session.add(mt)
    db_session.commit()

    wo = WorkOrder(
        work_order_number="WO-TEST-CK-01",
        title="Check Spindle Alignment",
        description="Inspect spindle runout and lubrication lines",
        asset_id=asset.id,
        maintenance_type_id=mt.id,
        priority="MEDIUM",
        status="OPEN",
        scheduled_date=datetime.utcnow() + timedelta(days=1)
    )
    db_session.add(wo)
    db_session.commit()

    # 2. Create template
    tmpl = ChecklistTemplate(
        title="CNC Precision Alignment Template",
        asset_category="CNC Machinery",
        is_active=True
    )
    db_session.add(tmpl)
    db_session.flush()
    db_session.add(ChecklistTemplateItem(template_id=tmpl.id, order_index=1, item_text="Measure runout", is_required=True))
    db_session.add(ChecklistTemplateItem(template_id=tmpl.id, order_index=2, item_text="Check lube pump", is_required=True))
    db_session.commit()

    # 3. Initialize checklist for work order using template
    init_res = client.post(f"/api/work-orders/{wo.id}/checklist", json={"template_id": tmpl.id})
    assert init_res.status_code == 201
    checklist_data = init_res.json()
    assert checklist_data["total_items"] == 2
    assert checklist_data["pending_items"] == 2
    assert checklist_data["incomplete_required_count"] == 2

    # 4. Modify original template (add an item and edit existing item)
    db_session.add(ChecklistTemplateItem(template_id=tmpl.id, order_index=3, item_text="NEW ITEM AFTER SNAPSHOT", is_required=True))
    db_session.commit()

    # 5. Fetch work order checklist again - MUST PRESERVE ORIGINAL SNAPSHOT
    cl_res = client.get(f"/api/work-orders/{wo.id}/checklist")
    assert cl_res.status_code == 200
    cl_data = cl_res.json()
    assert cl_data["total_items"] == 2  # Remains 2, unaffected by template change
    item_texts = [it["item_text"] for it in cl_data["items"]]
    assert "NEW ITEM AFTER SNAPSHOT" not in item_texts


def test_checklist_item_response_updates(client: TestClient, db_session):
    """Test marking checklist items PASS, FAIL, NOT_APPLICABLE and updating notes."""
    asset = Asset(asset_tag="TEST-CK-02", name="Chiller Unit", category="HVAC", location="Roof Deck", status="OPERATIONAL")
    db_session.add(asset)
    mt = MaintenanceType(code="TEST_CORR", name="Corrective", is_emergency=False)
    db_session.add(mt)
    db_session.commit()

    wo = WorkOrder(
        work_order_number="WO-TEST-CK-02",
        title="Chiller leak inspection",
        description="Inspect secondary refrigerant circuit and check for tracer gas leak",
        asset_id=asset.id,
        maintenance_type_id=mt.id,
        priority="HIGH",
        status="OPEN",
        scheduled_date=datetime.utcnow() + timedelta(days=1)
    )
    db_session.add(wo)
    db_session.commit()

    # Initialize checklist
    init_res = client.post(f"/api/work-orders/{wo.id}/checklist", json={})
    assert init_res.status_code == 201
    checklist_data = init_res.json()
    first_item = checklist_data["items"][0]
    second_item = checklist_data["items"][1]

    # Update first item to PASS
    up1 = client.put(
        f"/api/work-orders/{wo.id}/checklist/items/{first_item['id']}",
        json={"status": "PASS", "notes": "Suction pressure is within normal range.", "inspected_by": "Tech John"}
    )
    assert up1.status_code == 200
    assert up1.json()["status"] == "PASS"
    assert up1.json()["notes"] == "Suction pressure is within normal range."
    assert up1.json()["inspected_by"] == "Tech John"
    assert up1.json()["inspected_at"] is not None

    # Update second item to FAIL
    up2 = client.put(
        f"/api/work-orders/{wo.id}/checklist/items/{second_item['id']}",
        json={"status": "FAIL", "notes": "Micro-crack detected on flange gasket.", "inspected_by": "Tech John"}
    )
    assert up2.status_code == 200
    assert up2.json()["status"] == "FAIL"

    # Reject invalid status
    invalid_up = client.put(
        f"/api/work-orders/{wo.id}/checklist/items/{first_item['id']}",
        json={"status": "INVALID_STATUS"}
    )
    assert invalid_up.status_code in {422, 400}

    # Fetch checklist and verify computed metrics
    cl_res = client.get(f"/api/work-orders/{wo.id}/checklist")
    assert cl_res.status_code == 200
    data = cl_res.json()
    assert data["passed_items"] == 1
    assert data["failed_items"] == 1
    assert data["has_failed_items"] is True


def test_checklist_evidence_attachment_lifecycle_and_validation(client: TestClient, db_session):
    """Test attachment upload validation (file size, extension, safe retrieval, deletion)."""
    asset = Asset(asset_tag="TEST-CK-03", name="Air Compressor", category="Pneumatics", location="Utility Room", status="OPERATIONAL")
    db_session.add(asset)
    mt = MaintenanceType(code="TEST_INS", name="Inspection", is_emergency=False)
    db_session.add(mt)
    db_session.commit()

    wo = WorkOrder(
        work_order_number="WO-TEST-CK-03",
        title="Air compressor valve check",
        description="Inspect pilot valves and desiccant tank pressures",
        asset_id=asset.id,
        maintenance_type_id=mt.id,
        priority="LOW",
        status="OPEN",
        scheduled_date=datetime.utcnow() + timedelta(days=1)
    )
    db_session.add(wo)
    db_session.commit()

    init_res = client.post(f"/api/work-orders/{wo.id}/checklist", json={})
    checklist_data = init_res.json()
    item_id = checklist_data["items"][0]["id"]

    # 1. Reject disallowed extension (e.g. .exe)
    exe_file = io.BytesIO(b"malicious executable payload")
    res_exe = client.post(
        f"/api/work-orders/{wo.id}/checklist/items/{item_id}/attachment",
        files={"file": ("malware.exe", exe_file, "application/octet-stream")}
    )
    assert res_exe.status_code == 400
    assert "Disallowed file extension" in res_exe.json()["detail"]

    # 2. Reject file exceeding 5 MB limit
    big_file = io.BytesIO(b"0" * (5 * 1024 * 1024 + 1024))  # 5 MB + 1 KB
    res_big = client.post(
        f"/api/work-orders/{wo.id}/checklist/items/{item_id}/attachment",
        files={"file": ("huge_photo.jpg", big_file, "image/jpeg")}
    )
    assert res_big.status_code == 413

    # 3. Accept valid PNG attachment
    valid_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRtest_valid_png_data")
    res_png = client.post(
        f"/api/work-orders/{wo.id}/checklist/items/{item_id}/attachment",
        files={"file": ("pressure_gauge.png", valid_png, "image/png")}
    )
    assert res_png.status_code == 200
    res_png_data = res_png.json()
    assert res_png_data["has_attachment"] is True
    assert res_png_data["attachment_filename"] == "pressure_gauge.png"

    # 4. Download attachment
    download_res = client.get(f"/api/work-orders/{wo.id}/checklist/items/{item_id}/attachment")
    assert download_res.status_code == 200
    assert download_res.headers["content-type"] == "image/png"
    assert download_res.content == b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRtest_valid_png_data"

    # 5. Delete attachment
    del_res = client.delete(f"/api/work-orders/{wo.id}/checklist/items/{item_id}/attachment")
    assert del_res.status_code == 200
    assert del_res.json()["has_attachment"] is False

    # Download after delete should return 404
    get_after_del = client.get(f"/api/work-orders/{wo.id}/checklist/items/{item_id}/attachment")
    assert get_after_del.status_code == 404


def test_checklist_completion_validation(client: TestClient, db_session):
    """
    Test completion requires all required items to be answered.
    Fails with 422 if required items are pending, succeeds once all are addressed.
    """
    asset = Asset(asset_tag="TEST-CK-04", name="Conveyor", category="Material Handling", location="Warehouse B", status="OPERATIONAL")
    db_session.add(asset)
    mt = MaintenanceType(code="TEST_GEN", name="General", is_emergency=False)
    db_session.add(mt)
    db_session.commit()

    wo = WorkOrder(
        work_order_number="WO-TEST-CK-04",
        title="Conveyor belt alignment",
        description="Inspect belt tracking, tension, and drive roller bearings",
        asset_id=asset.id,
        maintenance_type_id=mt.id,
        priority="LOW",
        status="OPEN",
        scheduled_date=datetime.utcnow() + timedelta(days=1)
    )
    db_session.add(wo)
    db_session.commit()

    # Create template with 2 required and 1 optional items
    tmpl = ChecklistTemplate(title="Conveyor Inspection", is_active=True)
    db_session.add(tmpl)
    db_session.flush()
    db_session.add(ChecklistTemplateItem(template_id=tmpl.id, order_index=1, item_text="Belt tension", is_required=True))
    db_session.add(ChecklistTemplateItem(template_id=tmpl.id, order_index=2, item_text="Roller bearings", is_required=True))
    db_session.add(ChecklistTemplateItem(template_id=tmpl.id, order_index=3, item_text="Debris cleanup", is_required=False))
    db_session.commit()

    # Initialize
    init_res = client.post(f"/api/work-orders/{wo.id}/checklist", json={"template_id": tmpl.id})
    checklist_data = init_res.json()
    items = checklist_data["items"]
    assert len(items) == 3

    # Attempt to complete immediately -> must return 422
    fail_comp = client.post(f"/api/work-orders/{wo.id}/checklist/complete", json={"completed_by": "Inspector Alice"})
    assert fail_comp.status_code == 422
    assert "Cannot complete checklist" in fail_comp.json()["detail"]

    # Mark first required item as PASS
    client.put(f"/api/work-orders/{wo.id}/checklist/items/{items[0]['id']}", json={"status": "PASS"})

    # Still 1 required item pending -> must return 422
    fail_comp2 = client.post(f"/api/work-orders/{wo.id}/checklist/complete", json={"completed_by": "Inspector Alice"})
    assert fail_comp2.status_code == 422

    # Mark second required item as NOT_APPLICABLE
    client.put(f"/api/work-orders/{wo.id}/checklist/items/{items[1]['id']}", json={"status": "NOT_APPLICABLE"})

    # Optional item (items[2]) is still PENDING, but all REQUIRED are answered -> completion succeeds!
    succ_comp = client.post(
        f"/api/work-orders/{wo.id}/checklist/complete",
        json={"summary_notes": "All checks verified and passed.", "completed_by": "Inspector Alice"}
    )
    assert succ_comp.status_code == 200
    completed_data = succ_comp.json()
    assert completed_data["completed_at"] is not None
    assert completed_data["completed_by"] == "Inspector Alice"
    assert completed_data["can_complete"] is True


def test_asset_maintenance_history_includes_checklist_summary(client: TestClient, db_session):
    """Test asset maintenance history returns accurate checklist summary information."""
    asset = Asset(asset_tag="TEST-CK-05", name="Precision Lathe", category="CNC Machinery", location="Bay 3", status="OPERATIONAL")
    db_session.add(asset)
    mt = MaintenanceType(code="TEST_LATHE", name="Inspection", is_emergency=False)
    db_session.add(mt)
    db_session.commit()

    wo = WorkOrder(
        work_order_number="WO-TEST-CK-05",
        title="Lathe Chuck Concentricity Test",
        description="Verify runout of 3-jaw scroll chuck",
        asset_id=asset.id,
        maintenance_type_id=mt.id,
        priority="MEDIUM",
        status="IN_PROGRESS",
        scheduled_date=datetime.utcnow() + timedelta(days=1)
    )
    db_session.add(wo)
    db_session.commit()

    # Initialize and mark one item FAIL
    init_res = client.post(f"/api/work-orders/{wo.id}/checklist", json={})
    checklist_data = init_res.json()
    fail_item = checklist_data["items"][0]
    client.put(f"/api/work-orders/{wo.id}/checklist/items/{fail_item['id']}", json={"status": "FAIL", "notes": "Runout 0.05mm exceeds threshold."})

    # Query asset maintenance history
    hist_res = client.get(f"/api/assets/{asset.id}/maintenance-history")
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert isinstance(hist_data, list)
    assert len(hist_data) >= 1
    record = next(r for r in hist_data if r["id"] == wo.id)
    assert record["has_checklist"] is True
    assert record["checklist_status"] == "FAILED_ITEMS"
    assert "failed" in record["checklist_summary"]
