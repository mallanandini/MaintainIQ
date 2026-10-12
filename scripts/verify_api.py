import os
import sys
from datetime import datetime, timedelta
import httpx

BASE_URL = "http://localhost:3001"

def test_live_api():
    print("=== MaintainIQ Live API & Business Rule Verification Suite ===")
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Health Check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] [1/12] Health check passed:", res.json())

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

    # Search and Filter
    res_search = client.get("/api/work-orders", params={"status": "COMPLETED", "priority": "MEDIUM"})
    assert res_search.status_code == 200
    search_results = res_search.json()
    assert any(w["id"] == wo["id"] for w in search_results)
    print(f"[PASS] Work order search and filters verified ({len(search_results)} matching orders found).")

    print("\nALL 12 END-TO-END VALIDATION CHECKS PASSED AGAINST LIVE MYSQL DATABASE!")

if __name__ == "__main__":
    test_live_api()
