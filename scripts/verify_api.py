import os
import sys
import io
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath("."))
import httpx

BASE_URL = os.environ.get("VERIFY_BASE_URL", "http://localhost:3001")

def get_client():
    try:
        c = httpx.Client(base_url=BASE_URL, timeout=5.0)
        res = c.get("/api/health")
        if res.status_code == 200:
            return c
    except Exception:
        pass
    # Fallback to TestClient directly targeting live MySQL database
    from backend.main import app
    from fastapi.testclient import TestClient
    print("[INFO] Live HTTP server not listening on 3001; testing directly against live MySQL via FastAPI TestClient.")
    return TestClient(app)

def test_live_api():
    print("=== MaintainIQ Live API & Business Rule Verification Suite ===")
    client = get_client()

    # 1. Health Check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] [1/22] Health check passed:", res.json())

    # 2. Register Asset
    asset_data = {
        "asset_tag": f"AST-VERIFY-{datetime.utcnow().strftime('%H%M%S')}",
        "name": "High-Pressure Hydraulic Press 50T",
        "category": "Hydraulics",
        "location": "Stamping Unit 4",
        "status": "OPERATIONAL",
        "criticality": "HIGH"
    }
    res = client.post("/api/assets", json=asset_data)
    assert res.status_code == 201, f"Asset registration failed: {res.text}"
    new_asset = res.json()
    print("[PASS] [2/12] Registered asset:", new_asset["asset_tag"], "(ID:", new_asset["id"], ")")

    # 3. Register Technician
    tech_data = {
        "employee_id": f"TECH-VERIFY-{datetime.utcnow().strftime('%H%M%S')}",
        "name": "David Miller",
        "email": f"d.miller.{datetime.utcnow().strftime('%H%M%S')}@maintainiq.internal",
        "specialization": "Hydraulics",
        "status": "ACTIVE",
        "hourly_rate": 75.0
    }
    res = client.post("/api/technicians", json=tech_data)
    assert res.status_code == 201, f"Technician registration failed: {res.text}"
    new_tech = res.json()
    print("[PASS] [3/12] Registered technician:", new_tech["name"], "(ID:", new_tech["id"], ")")

    # 4. Rule 5 Rejection: Reject past scheduled date
    past_date = (datetime.utcnow() - timedelta(days=2)).isoformat()
    res = client.post("/api/work-orders", json={
        "title": "Past Scheduled Order",
        "description": "Should be rejected by Rule 5",
        "asset_id": new_asset["id"],
        "maintenance_type_id": 1,
        "priority": "MEDIUM",
        "scheduled_date": past_date,
        "estimated_hours": 2.0
    })
    assert res.status_code == 422, f"Expected 422 for past scheduled date, got {res.status_code}"
    assert "Rule 5 Violation" in res.json().get("detail", ""), f"Unexpected detail: {res.text}"
    print("[PASS] [4/12] Rule 5 enforced: Past scheduled date correctly rejected (422)")

    # 5. Rule 2 Rejection: Require technician for CRITICAL work order
    future_date = (datetime.utcnow() + timedelta(days=2)).isoformat()
    res = client.post("/api/work-orders", json={
        "title": "Critical Hydraulic Seal Leak",
        "description": "Should fail because technician is missing",
        "asset_id": new_asset["id"],
        "maintenance_type_id": 1,
        "priority": "CRITICAL",
        "assigned_technician_id": None,
        "scheduled_date": future_date,
        "estimated_hours": 3.0
    })
    assert res.status_code == 422, f"Expected 422 for CRITICAL without tech, got {res.status_code}"
    assert "Rule 2 Violation" in res.json().get("detail", ""), f"Unexpected detail: {res.text}"
    print("[PASS] [5/12] Rule 2 enforced: CRITICAL work order without technician rejected (422)")

    # 6. Rule 6: Reject non-emergency work order on OUT_OF_SERVICE asset
    # First create an OUT_OF_SERVICE asset
    oos_asset_data = {
        "asset_tag": f"AST-OOS-{datetime.utcnow().strftime('%H%M%S')}",
        "name": "Broken Conveyor Belt Motor",
        "category": "Conveyors",
        "location": "Assembly Line 2",
        "status": "OUT_OF_SERVICE",
        "criticality": "HIGH"
    }
    res_oos = client.post("/api/assets", json=oos_asset_data)
    oos_asset = res_oos.json()

    # Try creating PREVENTATIVE (maintenance_type_id=1, is_emergency=False) on OUT_OF_SERVICE asset with MEDIUM priority
    res = client.post("/api/work-orders", json={
        "title": "Routine Inspection on Broken Motor",
        "description": "Should fail by Rule 6",
        "asset_id": oos_asset["id"],
        "maintenance_type_id": 1, # Preventative
        "priority": "MEDIUM",
        "scheduled_date": future_date,
        "estimated_hours": 2.0
    })
    assert res.status_code == 422, f"Expected 422 for Rule 6, got {res.status_code}"
    assert "Rule 6 Violation" in res.json().get("detail", ""), f"Unexpected detail: {res.text}"
    print("[PASS] [6/12] Rule 6 enforced: Non-emergency work order on OUT_OF_SERVICE asset rejected (422)")

    # 7. Create valid Work Order (Rule 1 unique numbering test)
    res = client.post("/api/work-orders", json={
        "title": "Scheduled Valve Inspection & Lubrication",
        "description": "Regular lubrication cycle for hydraulic unit",
        "asset_id": new_asset["id"],
        "maintenance_type_id": 1,
        "priority": "MEDIUM",
        "assigned_technician_id": new_tech["id"],
        "scheduled_date": future_date,
        "estimated_hours": 2.5
    })
    assert res.status_code == 201, f"Failed to create valid work order: {res.text}"
    wo = res.json()
    assert wo["work_order_number"].startswith("WO-"), f"Invalid WO number: {wo['work_order_number']}"
    assert wo["status"] == "ASSIGNED", f"Expected ASSIGNED status with tech, got {wo['status']}"
    print("[PASS] [7/12] Work order created successfully:", wo["work_order_number"], "(Status:", wo["status"], ")")

    # 8. Assign/Update Technician & Priority validation (Rule 2 on update)
    # Updating to CRITICAL without technician must fail
    res_unassign = client.patch(f"/api/work-orders/{wo['id']}", json={
        "priority": "CRITICAL",
        "assigned_technician_id": None
    })
    assert res_unassign.status_code == 422, f"Expected 422 when updating to CRITICAL without tech, got {res_unassign.status_code}"
    print("[PASS] [8/12] Rule 2 enforced on update: Updating to CRITICAL without technician rejected (422)")

    # 9. Valid Status Transition: ASSIGNED -> IN_PROGRESS
    res_trans = client.post(f"/api/work-orders/{wo['id']}/transition", json={
        "to_status": "IN_PROGRESS",
        "changed_by": new_tech["name"],
        "notes": "Commenced hydraulic calibration."
    })
    assert res_trans.status_code == 200, f"Failed transition to IN_PROGRESS: {res_trans.text}"
    wo = res_trans.json()
    assert wo["status"] == "IN_PROGRESS"
    print("[PASS] [9/12] Valid status transition: ASSIGNED -> IN_PROGRESS succeeded")

    # 10. Valid Status Transition: IN_PROGRESS -> COMPLETED
    res_comp = client.post(f"/api/work-orders/{wo['id']}/transition", json={
        "to_status": "COMPLETED",
        "changed_by": new_tech["name"],
        "notes": "Lubrication and testing complete. System restored to full operation.",
        "actual_hours": 2.25,
        "resolution_summary": "Replaced valve seals and replenished hydraulic fluid."
    })
    assert res_comp.status_code == 200, f"Failed transition to COMPLETED: {res_comp.text}"
    wo = res_comp.json()
    assert wo["status"] == "COMPLETED"
    print("[PASS] [10/12] Valid status transition: IN_PROGRESS -> COMPLETED succeeded")

    # 11. Rule 3 Terminal State: COMPLETED cannot return to OPEN or any other state
    res_reopen = client.post(f"/api/work-orders/{wo['id']}/transition", json={
        "to_status": "OPEN",
        "changed_by": "Operator",
        "notes": "Attempting illegal reopening."
    })
    assert res_reopen.status_code == 422, f"Expected 422 for Rule 3 terminal reopen, got {res_reopen.status_code}"
    assert "Rule 3 Violation" in res_reopen.json().get("detail", "")
    print("[PASS] [11/12] Rule 3 enforced: COMPLETED is terminal; cannot transition to OPEN (422)")

    # Rule 4 Terminal State: CANCELLED cannot move to IN_PROGRESS
    res_cancel_order = client.post("/api/work-orders", json={
        "title": "Order to Cancel",
        "description": "Validating Rule 4 cancellation terminal state",
        "asset_id": new_asset["id"],
        "maintenance_type_id": 1,
        "priority": "LOW",
        "scheduled_date": future_date,
        "estimated_hours": 1.0
    })
    cancel_wo = res_cancel_order.json()
    res_cancel_trans = client.post(f"/api/work-orders/{cancel_wo['id']}/transition", json={
        "to_status": "CANCELLED",
        "changed_by": "Dispatcher",
        "notes": "Cancelled by operator request."
    })
    assert res_cancel_trans.status_code == 200
    res_illegal_move = client.post(f"/api/work-orders/{cancel_wo['id']}/transition", json={
        "to_status": "IN_PROGRESS",
        "changed_by": "Operator",
        "notes": "Attempting illegal move from CANCELLED to IN_PROGRESS."
    })
    assert res_illegal_move.status_code == 422
    assert "Rule 4 Violation" in res_illegal_move.json().get("detail", "")
    print("[PASS] Rule 4 enforced: CANCELLED is terminal; cannot transition to IN_PROGRESS (422)")

    # 12. Search, Filter, and Maintenance History Audit Trail
    res_detail = client.get(f"/api/work-orders/{wo['id']}")
    assert res_detail.status_code == 200
    wo_full = res_detail.json()
    assert len(wo_full["status_history"]) >= 3, f"Expected at least 3 history items, got {len(wo_full['status_history'])}"
    print(f"[PASS] [12/12] Maintenance history audit trail verified ({len(wo_full['status_history'])} status entries).")

    # 13. Asset Maintenance History Endpoint (Phase 2)
    res_maint_hist = client.get(f"/api/assets/{new_asset['id']}/maintenance-history")
    assert res_maint_hist.status_code == 200, f"Failed asset maintenance history query: {res_maint_hist.text}"
    maint_records = res_maint_hist.json()
    assert len(maint_records) == 2, f"Expected 2 maintenance records, got {len(maint_records)}"
    
    # Verify newest first ordering: cancel_wo was created after wo
    assert maint_records[0]["work_order_number"] == cancel_wo["work_order_number"]
    assert maint_records[1]["work_order_number"] == wo["work_order_number"]
    
    # Verify completed record fields
    completed_rec = maint_records[1]
    assert completed_rec["status"] == "COMPLETED"
    assert completed_rec["completed_date"] is not None
    assert "maintenance_type" in completed_rec
    assert "technician" in completed_rec
    assert "description" in completed_rec
    print(f"[PASS] [13/14] Phase 2 Asset Maintenance History endpoint verified ({len(maint_records)} records, newest-first ordering, completed date present).")

    # 15. Work Order Status History Endpoint (Phase 3)
    res_wo_hist_asc = client.get(f"/api/work-orders/{wo['id']}/history?order=asc")
    assert res_wo_hist_asc.status_code == 200, f"Failed work order history query: {res_wo_hist_asc.text}"
    hist_asc = res_wo_hist_asc.json()
    assert len(hist_asc) == 3, f"Expected 3 history items, got {len(hist_asc)}"
    assert hist_asc[0]["to_status"] == "ASSIGNED"
    assert hist_asc[0]["new_status"] == "ASSIGNED"
    assert hist_asc[1]["to_status"] == "IN_PROGRESS"
    assert hist_asc[1]["previous_status"] == "ASSIGNED"
    assert hist_asc[2]["to_status"] == "COMPLETED"
    assert hist_asc[2]["previous_status"] == "IN_PROGRESS"
    assert "changed_at" in hist_asc[0]
    print(f"[PASS] [15/17] Phase 3 Work-Order Status History endpoint verified ({len(hist_asc)} records in ascending chronological order).")

    # 16. Work Order Status History Reverse Chronological
    res_wo_hist_desc = client.get(f"/api/work-orders/{wo['id']}/history?order=desc")
    assert res_wo_hist_desc.status_code == 200
    hist_desc = res_wo_hist_desc.json()
    assert hist_desc[0]["to_status"] == "COMPLETED"
    assert hist_desc[2]["to_status"] == "ASSIGNED"
    print("[PASS] [16/17] Phase 3 Reverse-chronological history sorting verified.")

    # 17. Nonexistent Work Order History Returns 404
    res_bad_wo_hist = client.get("/api/work-orders/999999/history")
    assert res_bad_wo_hist.status_code == 404
    print("[PASS] [17/20] Nonexistent work order history returns 404 as expected.")

    # 18. Smart Technician Recommendations for Existing Work Order (Phase 4)
    res_wo_recs = client.get(f"/api/work-orders/{wo['id']}/technician-recommendations")
    assert res_wo_recs.status_code == 200, f"Failed WO recommendations: {res_wo_recs.text}"
    wo_recs = res_wo_recs.json()
    assert len(wo_recs) >= 1
    top_wo_rec = wo_recs[0]
    assert "composite_score" in top_wo_rec
    assert "explanation" in top_wo_rec
    assert "active_work_orders_count" in top_wo_rec
    print(f"[PASS] [18/20] Phase 4 Work-Order Technician Recommendations verified (Top match: {top_wo_rec['name']}, Score: {top_wo_rec['composite_score']}).")

    # 19. Smart Technician Recommendations for Prospective Work Order (Phase 4)
    res_tech_recs = client.get(f"/api/technicians/recommendations?asset_id={new_asset['id']}&priority=CRITICAL&limit=3")
    assert res_tech_recs.status_code == 200, f"Failed tech recommendations: {res_tech_recs.text}"
    tech_recs = res_tech_recs.json()
    assert len(tech_recs) >= 1
    assert all(r["status"] == "ACTIVE" for r in tech_recs)
    print(f"[PASS] [19/20] Phase 4 Prospective Technician Recommendations verified ({len(tech_recs)} eligible active candidates).")

    # 20. Deterministic Ranking Consistency (Phase 4)
    res_tech_recs_repeat = client.get(f"/api/technicians/recommendations?asset_id={new_asset['id']}&priority=CRITICAL&limit=3")
    assert res_tech_recs_repeat.status_code == 200
    tech_recs_repeat = res_tech_recs_repeat.json()
    assert [r["technician_id"] for r in tech_recs] == [r["technician_id"] for r in tech_recs_repeat]
    assert [r["composite_score"] for r in tech_recs] == [r["composite_score"] for r in tech_recs_repeat]
    print("[PASS] [20/21] Phase 4 Deterministic ranking consistency verified.")

    # 21. Maintenance Operations Analytics (Phase 5)
    res_analytics = client.get("/api/dashboard/analytics?top_assets_limit=5")
    assert res_analytics.status_code == 200, f"Failed analytics query: {res_analytics.text}"
    analytics = res_analytics.json()
    assert "summary" in analytics
    assert "status_distribution" in analytics
    assert "priority_distribution" in analytics
    assert "monthly_completion_trend" in analytics
    assert "technician_workloads" in analytics
    assert "frequently_maintained_assets" in analytics
    assert "overdue_metrics" in analytics

    summary = analytics["summary"]
    assert summary["total_work_orders"] >= 2
    assert summary["completed_work_orders"] >= 1
    assert "completion_rate_percentage" in summary

    # Status distribution totals should equal total work orders
    status_sum = sum(item["count"] for item in analytics["status_distribution"])
    assert status_sum == summary["total_work_orders"]

    # Monthly completion trend
    assert len(analytics["monthly_completion_trend"]) >= 1
    assert any(m["completed_count"] >= 1 for m in analytics["monthly_completion_trend"])

    # Overdue rule documentation
    assert len(analytics["overdue_metrics"]["rule_description"]) > 20
    assert "OPEN" in analytics["overdue_metrics"]["rule_description"]

    # Frequently maintained assets
    assert len(analytics["frequently_maintained_assets"]) >= 1
    top_asset = analytics["frequently_maintained_assets"][0]
    assert top_asset["total_work_orders"] >= 1
    assert "asset_tag" in top_asset

    # Technician workloads
    assert len(analytics["technician_workloads"]) >= 1
    print(f"[PASS] [21/22] Phase 5 Maintenance Analytics endpoint verified (Total WOs: {summary['total_work_orders']}, Completion Rate: {summary['completion_rate_percentage']:.1f}%, Overdue: {analytics['overdue_metrics']['overdue_count']}).")

    # 22. Asset Health & Risk Monitoring (Asset Health Module)
    res_health_fleet = client.get("/api/assets/health")
    assert res_health_fleet.status_code == 200, f"Failed fleet health endpoint: {res_health_fleet.text}"
    health_fleet = res_health_fleet.json()
    assert "summary" in health_fleet
    assert "items" in health_fleet
    assert "formula_documentation" in health_fleet
    assert len(health_fleet["formula_documentation"]) > 50

    fleet_summary = health_fleet["summary"]
    assert fleet_summary["total_assets"] >= 1
    assert "critical_risk_count" in fleet_summary
    assert "high_risk_count" in fleet_summary
    assert "moderate_risk_count" in fleet_summary
    assert "low_risk_count" in fleet_summary
    assert "insufficient_data_count" in fleet_summary

    # Verify individual asset health endpoint
    target_asset_id = health_fleet["items"][0]["asset_id"]
    res_asset_health = client.get(f"/api/assets/{target_asset_id}/health")
    assert res_asset_health.status_code == 200, f"Failed single asset health: {res_asset_health.text}"
    asset_health = res_asset_health.json()
    assert asset_health["asset_id"] == target_asset_id
    assert "risk_level" in asset_health
    assert "contributing_factors" in asset_health
    assert "summary_explanation" in asset_health
    assert "usage_metrics" in asset_health
    assert "maintenance_metrics" in asset_health
    assert isinstance(asset_health["contributing_factors"], list)

    # Verify 404 for invalid asset ID
    res_invalid_asset = client.get("/api/assets/999999/health")
    assert res_invalid_asset.status_code == 404

    print(f"[PASS] [22/23] Asset Health & Risk Monitoring verified (Fleet assets evaluated: {fleet_summary['total_assets']}, Sample asset: {asset_health['asset_tag']}, Risk: {asset_health['risk_level']}).")

    # 23. Digital Inspection Checklists
    # List templates
    res_templates = client.get("/api/checklists/templates")
    assert res_templates.status_code == 200, f"Failed listing templates: {res_templates.text}"
    templates = res_templates.json()
    assert len(templates) >= 1, "Expected at least 1 checklist template seeded"
    sample_template = templates[0]

    # Initialize checklist on the created work order
    res_cl_init = client.post(f"/api/work-orders/{wo['id']}/checklist", json={"template_id": sample_template["id"]})
    assert res_cl_init.status_code == 201, f"Failed initializing checklist: {res_cl_init.text}"
    checklist = res_cl_init.json()
    assert checklist["work_order_id"] == wo["id"]
    assert checklist["total_items"] == len(sample_template["items"])
    assert checklist["completed_at"] is None

    # Update first item to PASS
    first_item = checklist["items"][0]
    res_up_item = client.put(
        f"/api/work-orders/{wo['id']}/checklist/items/{first_item['id']}",
        json={"status": "PASS", "notes": "Verified operational within manufacturer parameters", "inspected_by": "Senior Technician"}
    )
    assert res_up_item.status_code == 200, f"Failed updating item: {res_up_item.text}"
    updated_item = res_up_item.json()
    assert updated_item["status"] == "PASS"
    assert updated_item["inspected_by"] == "Senior Technician"

    # Upload test evidence attachment
    sample_img = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRtest_attachment")
    res_upload = client.post(
        f"/api/work-orders/{wo['id']}/checklist/items/{first_item['id']}/attachment",
        files={"file": ("gauge_reading.png", sample_img, "image/png")}
    )
    assert res_upload.status_code == 200, f"Failed uploading attachment: {res_upload.text}"
    assert res_upload.json()["has_attachment"] is True

    # Retrieve attachment
    res_download = client.get(f"/api/work-orders/{wo['id']}/checklist/items/{first_item['id']}/attachment")
    assert res_download.status_code == 200

    # Clean up attachment
    res_del_att = client.delete(f"/api/work-orders/{wo['id']}/checklist/items/{first_item['id']}/attachment")
    assert res_del_att.status_code == 200
    assert res_del_att.json()["has_attachment"] is False

    # Mark remaining required items as PASS to test completion
    res_cl_current = client.get(f"/api/work-orders/{wo['id']}/checklist")
    current_cl = res_cl_current.json()
    for item in current_cl["items"]:
        if item["is_required"] and item["status"] == "PENDING":
            client.put(
                f"/api/work-orders/{wo['id']}/checklist/items/{item['id']}",
                json={"status": "PASS", "notes": "Automated verification pass", "inspected_by": "Senior Technician"}
            )

    # Complete checklist
    res_complete = client.post(
        f"/api/work-orders/{wo['id']}/checklist/complete",
        json={"summary_notes": "All critical inspection gates completed successfully.", "completed_by": "Senior Technician"}
    )
    assert res_complete.status_code == 200, f"Failed completing checklist: {res_complete.text}"
    completed_cl = res_complete.json()
    assert completed_cl["completed_at"] is not None
    assert completed_cl["can_complete"] is True

    # Verify maintenance history shows checklist data
    res_hist = client.get(f"/api/assets/{new_asset['id']}/maintenance-history")
    assert res_hist.status_code == 200
    hist_items = res_hist.json()
    assert len(hist_items) >= 1
    target_hist = next(h for h in hist_items if h["id"] == wo["id"])
    assert target_hist["has_checklist"] is True
    assert target_hist["checklist_status"] in ["COMPLETED", "PASSED", "IN_PROGRESS", "FAILED_ITEMS"]

    print(f"[PASS] [23/27] Digital Inspection Checklists verified (Template: '{sample_template['title']}', Items: {checklist['total_items']}, Completion: 100%, History linked).")

    # 24. Technician Lifecycle Management & Guardrails
    ts = datetime.utcnow().strftime('%H%M%S')
    res_tech_lc = client.post("/api/technicians", json={
        "employee_id": f"TECH-LC-{ts}",
        "name": "Jordan Hayes",
        "email": f"j.hayes.{ts}@maintainiq.internal",
        "specialization": "Automation",
        "status": "ACTIVE",
        "hourly_rate": 82.0
    })
    assert res_tech_lc.status_code == 201
    tech_lc = res_tech_lc.json()

    # A: Deactivate available technician
    res_deact = client.put(f"/api/technicians/{tech_lc['id']}", json={"status": "INACTIVE"})
    assert res_deact.status_code == 200
    assert res_deact.json()["status"] == "INACTIVE"

    # B: Reactivate technician
    res_react = client.put(f"/api/technicians/{tech_lc['id']}", json={"status": "ACTIVE"})
    assert res_react.status_code == 200
    assert res_react.json()["status"] == "ACTIVE"

    # C: Create active work order assigned to technician
    res_wo_active = client.post("/api/work-orders", json={
        "title": "Active Automation Work Order",
        "description": "Lifecycle guardrail test",
        "asset_id": new_asset["id"],
        "maintenance_type_id": 1,
        "priority": "HIGH",
        "assigned_technician_id": tech_lc["id"],
        "scheduled_date": (datetime.utcnow() + timedelta(days=3)).isoformat(),
        "estimated_hours": 3.0
    })
    assert res_wo_active.status_code == 201
    wo_active = res_wo_active.json()

    # D: Attempt deactivation with active assignment (must return 409 Conflict)
    res_block_deact = client.put(f"/api/technicians/{tech_lc['id']}", json={"status": "INACTIVE"})
    assert res_block_deact.status_code == 409
    assert "active work order assignment" in res_block_deact.json()["detail"]

    # E: Attempt permanent deletion with work order history (must return 409 Conflict)
    res_block_del = client.delete(f"/api/technicians/{tech_lc['id']}")
    assert res_block_del.status_code == 409
    assert "associated with" in res_block_del.json()["detail"]

    # F: Permanent deletion of technician without dependencies
    res_zero_tech = client.post("/api/technicians", json={
        "employee_id": f"TECH-DEL-{ts}",
        "name": "Temporary Contractor",
        "email": f"temp.del.{ts}@maintainiq.internal",
        "specialization": "General",
        "status": "ACTIVE"
    })
    assert res_zero_tech.status_code == 201
    zero_tech = res_zero_tech.json()

    res_del_ok = client.delete(f"/api/technicians/{zero_tech['id']}")
    assert res_del_ok.status_code == 200
    assert res_del_ok.json()["success"] is True

    # G: Deletion of nonexistent technician returns 404
    res_del_404 = client.delete("/api/technicians/999999")
    assert res_del_404.status_code == 404
    print("[PASS] [24/27] Technician Lifecycle Management verified (Deactivation, Reactivation, Active Order 409, History 409, Clean Deletion 200, Invalid 404).")

    # 25. Work Order Bulk Assignment
    res_bulk = client.post("/api/work-orders/bulk-assign-technician", json={
        "work_order_ids": [wo_active["id"]],
        "technician_id": new_tech["id"]
    })
    assert res_bulk.status_code == 200
    bulk_data = res_bulk.json()
    assert bulk_data["success_count"] >= 1
    print(f"[PASS] [25/27] Bulk Technician Assignment verified ({bulk_data['success_count']} orders reassigned).")

    # 26. Work Order Duplication
    res_dup = client.post(f"/api/work-orders/{wo['id']}/duplicate", json={
        "title": "Duplicated Inspection Order",
        "scheduled_date": (datetime.utcnow() + timedelta(days=5)).isoformat()
    })
    assert res_dup.status_code == 201
    dup_wo = res_dup.json()
    assert dup_wo["work_order_number"] != wo["work_order_number"]
    assert dup_wo["status"] == "ASSIGNED" or dup_wo["status"] == "OPEN"
    print(f"[PASS] [26/27] Work Order Duplication verified (Original: {wo['work_order_number']} -> Cloned: {dup_wo['work_order_number']}).")

    # 27. Work Order CSV Export
    res_export = client.get("/api/work-orders/export")
    assert res_export.status_code == 200
    assert "text/csv" in res_export.headers.get("content-type", "")
    assert "Work Order Number" in res_export.text
    print("[PASS] [27/27] Work Order CSV Export verified (CSV headers and records present).")

    print("\nALL 27 END-TO-END VALIDATION CHECKS PASSED AGAINST LIVE DATABASE!")

if __name__ == "__main__":
    test_live_api()


