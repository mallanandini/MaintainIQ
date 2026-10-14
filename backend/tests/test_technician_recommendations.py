import os
import sys
from datetime import datetime, timezone, timedelta
import pytest
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder

def test_technician_recommendations_matching_skill_ranks_first(client, db_session):
    """Technicians with direct specialization match rank highest."""
    # Ensure baseline assets: AST-TEST-01 is category 'Hydraulics'
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    assert asset.category == "Hydraulics"

    # Seed two active technicians: one Hydraulics specialist, one HVAC specialist
    t_hydraulics = Technician(
        employee_id="TECH-REC-01",
        name="Henry Hydraulics",
        email="henry@test.com",
        specialization="Hydraulics & Mechanical",
        status="ACTIVE",
        hourly_rate=70.0
    )
    t_hvac = Technician(
        employee_id="TECH-REC-02",
        name="Harry HVAC",
        email="harry@test.com",
        specialization="HVAC",
        status="ACTIVE",
        hourly_rate=70.0
    )
    db_session.add_all([t_hydraulics, t_hvac])
    db_session.commit()

    res = client.get(f"/api/technicians/recommendations?asset_id={asset.id}&limit=3")
    assert res.status_code == 200
    recs = res.json()
    assert len(recs) >= 2

    # Henry Hydraulics must be #1
    top_rec = recs[0]
    assert top_rec["technician_id"] == t_hydraulics.id
    assert top_rec["skill_match_level"] == "DIRECT"
    assert top_rec["skill_score"] == 50.0
    assert "Direct" in top_rec["explanation"] or "specialist" in top_rec["explanation"]

    # Harry HVAC must have lower skill score
    hvac_rec = next(r for r in recs if r["technician_id"] == t_hvac.id)
    assert hvac_rec["skill_score"] < top_rec["skill_score"]
    assert top_rec["composite_score"] > hvac_rec["composite_score"]


def test_technician_recommendations_excludes_unavailable_technicians(client, db_session):
    """Technicians on leave or inactive are 100% excluded even if skills match perfectly."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()

    # Create ON_LEAVE and INACTIVE specialists
    t_leave = Technician(
        employee_id="TECH-LEAVE-99",
        name="Laura Leave",
        email="laura@test.com",
        specialization="Hydraulics & Mechanical",
        status="ON_LEAVE",
        hourly_rate=80.0
    )
    t_inactive = Technician(
        employee_id="TECH-INACT-99",
        name="Ian Inactive",
        email="ian@test.com",
        specialization="Hydraulics",
        status="INACTIVE",
        hourly_rate=80.0
    )
    db_session.add_all([t_leave, t_inactive])
    db_session.commit()

    res = client.get(f"/api/technicians/recommendations?asset_id={asset.id}")
    assert res.status_code == 200
    recs = res.json()

    rec_ids = [r["technician_id"] for r in recs]
    assert t_leave.id not in rec_ids, "Technician on leave must not be recommended"
    assert t_inactive.id not in rec_ids, "Inactive technician must not be recommended"


def test_technician_recommendations_workload_penalty_ranks_freer_tech_higher(client, db_session):
    """Between two matching technicians, the one with fewer active orders ranks higher."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()

    # Two active Electrical technicians
    t_busy = Technician(
        employee_id="TECH-BUSY-01",
        name="Busy Bob",
        email="busy@test.com",
        specialization="Electrical",
        status="ACTIVE",
        hourly_rate=75.0
    )
    t_free = Technician(
        employee_id="TECH-FREE-01",
        name="Free Frank",
        email="free@test.com",
        specialization="Electrical",
        status="ACTIVE",
        hourly_rate=75.0
    )
    db_session.add_all([t_busy, t_free])
    db_session.commit()

    # Assign 2 active work orders to Bob
    for i in range(2):
        wo = WorkOrder(
            work_order_number=f"WO-BUSY-TEST-0{i}",
            title=f"Electrical Maintenance Task {i}",
            description="Testing workload penalty",
            asset_id=asset.id,
            maintenance_type_id=maint.id,
            priority="MEDIUM",
            status="IN_PROGRESS" if i == 0 else "ASSIGNED",
            assigned_technician_id=t_busy.id,
            scheduled_date=datetime.now(timezone.utc) + timedelta(days=2),
            estimated_hours=2.0
        )
        db_session.add(wo)
    db_session.commit()

    # Asset with category 'Electrical'
    asset_elec = Asset(
        asset_tag="AST-TEST-ELEC-01",
        name="Main Transformer",
        category="Electrical",
        location="Substation B",
        status="OPERATIONAL",
        criticality="HIGH"
    )
    db_session.add(asset_elec)
    db_session.commit()

    res = client.get(f"/api/technicians/recommendations?asset_id={asset_elec.id}")
    assert res.status_code == 200
    recs = res.json()

    rec_free = next(r for r in recs if r["technician_id"] == t_free.id)
    rec_busy = next(r for r in recs if r["technician_id"] == t_busy.id)

    assert rec_free["active_work_orders_count"] == 0
    assert rec_busy["active_work_orders_count"] == 2
    assert rec_free["availability_score"] > rec_busy["availability_score"]
    assert rec_free["composite_score"] > rec_busy["composite_score"]

    # Free Frank must appear higher than Busy Bob in the returned list
    free_index = next(idx for idx, r in enumerate(recs) if r["technician_id"] == t_free.id)
    busy_index = next(idx for idx, r in enumerate(recs) if r["technician_id"] == t_busy.id)
    assert free_index < busy_index


def test_no_eligible_technicians_returns_empty_safely(client, db_session):
    """When all technicians are on leave or inactive, returns empty list without error."""
    # Set all technicians in DB to ON_LEAVE
    db_session.query(Technician).update({"status": "ON_LEAVE"})
    db_session.commit()

    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    res = client.get(f"/api/technicians/recommendations?asset_id={asset.id}")
    assert res.status_code == 200
    assert res.json() == []


def test_deterministic_ranking_produces_identical_results(client, db_session):
    """Multiple requests with identical parameters return exactly identical ranking and scores."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()

    # Query 5 consecutive times
    results = [client.get(f"/api/technicians/recommendations?asset_id={asset.id}&limit=3").json() for _ in range(5)]

    first_run = results[0]
    for subsequent_run in results[1:]:
        assert [r["technician_id"] for r in subsequent_run] == [r["technician_id"] for r in first_run]
        assert [r["composite_score"] for r in subsequent_run] == [r["composite_score"] for r in first_run]


def test_existing_work_order_recommendations_endpoint(client, db_session):
    """GET /api/work-orders/{id}/technician-recommendations functions properly and excludes current order from penalty."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    tech = db_session.query(Technician).filter(Technician.status == "ACTIVE").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()

    # Create work order in ASSIGNED status with tech
    res_wo = client.post("/api/work-orders", json={
        "title": "Hydraulic Cylinder Inspection",
        "description": "Routine pressure test",
        "asset_id": asset.id,
        "maintenance_type_id": maint.id,
        "priority": "HIGH",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 1.5
    })
    assert res_wo.status_code == 201
    wo_id = res_wo.json()["id"]

    res_rec = client.get(f"/api/work-orders/{wo_id}/technician-recommendations")
    assert res_rec.status_code == 200
    recs = res_rec.json()
    assert len(recs) >= 1

    # Incumbent tech should not have this specific work order double-counted in their active workload
    tech_rec = next((r for r in recs if r["technician_id"] == tech.id), None)
    if tech_rec:
        assert tech_rec["active_work_orders_count"] == 0

    # 404 for nonexistent work order
    res_404 = client.get("/api/work-orders/999999/technician-recommendations")
    assert res_404.status_code == 404


def test_critical_work_order_recommendations_and_rule_2_enforcement(client, db_session):
    """Surfaces recommendations for CRITICAL order, and assigning recommended tech satisfies Rule 2."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()

    # Step 1: Query recommendations for a prospective CRITICAL work order on this asset
    res_rec = client.get(f"/api/technicians/recommendations?asset_id={asset.id}&priority=CRITICAL")
    assert res_rec.status_code == 200
    recs = res_rec.json()
    assert len(recs) >= 1

    best_tech_id = recs[0]["technician_id"]

    # Step 2: Attempting to create CRITICAL work order without tech must fail (Rule 2)
    res_fail = client.post("/api/work-orders", json={
        "title": "Critical Valve Leak",
        "description": "Emergency repair needed",
        "asset_id": asset.id,
        "maintenance_type_id": maint.id,
        "priority": "CRITICAL",
        "assigned_technician_id": None,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res_fail.status_code == 422
    assert "Rule 2 Violation" in res_fail.json()["detail"]

    # Step 3: Creating CRITICAL work order with the recommended technician succeeds
    res_success = client.post("/api/work-orders", json={
        "title": "Critical Valve Leak",
        "description": "Emergency repair needed",
        "asset_id": asset.id,
        "maintenance_type_id": maint.id,
        "priority": "CRITICAL",
        "assigned_technician_id": best_tech_id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res_success.status_code == 201
    assert res_success.json()["assigned_technician_id"] == best_tech_id
    assert res_success.json()["status"] == "ASSIGNED"


def test_missing_asset_or_skill_handled_safely(client, db_session):
    """Querying recommendations without an asset ID or with unknown category returns graceful rankings."""
    res_no_asset = client.get("/api/technicians/recommendations")
    assert res_no_asset.status_code == 200
    recs = res_no_asset.json()
    assert len(recs) >= 1
    # Ranked by availability
    assert all(r["status"] == "ACTIVE" for r in recs)


def test_technician_with_missing_specialization_handled_safely(client, db_session):
    """Technicians with missing or empty specialization receive 0 skill points and clear reason without errors."""
    from backend.app.services.recommendation_service import calculate_skill_match

    # Verify unit function handles None and whitespace gracefully
    score_none, level_none, exp_none = calculate_skill_match(None)
    assert score_none == 0.0
    assert level_none == "NONE"
    assert "no documented" in exp_none.lower() or "skills" in exp_none.lower()

    score_empty, level_empty, exp_empty = calculate_skill_match("   ")
    assert score_empty == 0.0
    assert level_empty == "NONE"

    # Verify in-database technician with empty string specialization
    t_no_skill = Technician(
        employee_id="TECH-NOSKILL-01",
        name="No Skill Ned",
        email="noskill@test.com",
        specialization="",
        status="ACTIVE",
        hourly_rate=50.0
    )
    db_session.add(t_no_skill)
    db_session.commit()

    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    res = client.get(f"/api/technicians/recommendations?asset_id={asset.id}&limit=10")
    assert res.status_code == 200
    recs = res.json()

    ned_rec = next((r for r in recs if r["technician_id"] == t_no_skill.id), None)
    assert ned_rec is not None
    assert ned_rec["skill_score"] == 0.0
    assert ned_rec["skill_match_level"] == "NONE"


def test_technician_tie_breaking_deterministic_order(client, db_session):
    """When technicians have identical composite score, skill score, workload, and rate, tie breaks by technician ID."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()

    # Create two identical active technicians with exact same attributes
    t_clone_a = Technician(
        employee_id="TECH-TIE-A",
        name="Twin Alpha",
        email="twin.a@test.com",
        specialization="Hydraulics & Mechanical",
        status="ACTIVE",
        hourly_rate=75.0
    )
    t_clone_b = Technician(
        employee_id="TECH-TIE-B",
        name="Twin Beta",
        email="twin.b@test.com",
        specialization="Hydraulics & Mechanical",
        status="ACTIVE",
        hourly_rate=75.0
    )
    db_session.add_all([t_clone_a, t_clone_b])
    db_session.commit()

    res = client.get(f"/api/technicians/recommendations?asset_id={asset.id}&limit=10")
    assert res.status_code == 200
    recs = res.json()

    rec_a = next(r for r in recs if r["technician_id"] == t_clone_a.id)
    rec_b = next(r for r in recs if r["technician_id"] == t_clone_b.id)

    assert rec_a["composite_score"] == rec_b["composite_score"]
    assert rec_a["skill_score"] == rec_b["skill_score"]
    assert rec_a["active_work_orders_count"] == rec_b["active_work_orders_count"]

    idx_a = next(i for i, r in enumerate(recs) if r["technician_id"] == t_clone_a.id)
    idx_b = next(i for i, r in enumerate(recs) if r["technician_id"] == t_clone_b.id)

    # Lower technician ID must strictly precede higher technician ID
    if t_clone_a.id < t_clone_b.id:
        assert idx_a < idx_b
    else:
        assert idx_b < idx_a


def test_preserve_manual_assignment_workflow(client, db_session):
    """Users can manually assign any active technician directly without using recommendations."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    # Find or create active technician
    tech = Technician(
        employee_id="TECH-MANUAL-01",
        name="Manual Manny",
        email="manny@test.com",
        specialization="General Maintenance",
        status="ACTIVE",
        hourly_rate=60.0
    )
    db_session.add(tech)
    db_session.commit()

    # Manual creation with explicit assigned technician
    res_create = client.post("/api/work-orders", json={
        "title": "Manual Assignment Test",
        "description": "Dispatcher chosen technician manually",
        "asset_id": asset.id,
        "maintenance_type_id": maint.id,
        "priority": "MEDIUM",
        "assigned_technician_id": tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "estimated_hours": 3.0
    })
    assert res_create.status_code == 201
    wo = res_create.json()
    assert wo["assigned_technician_id"] == tech.id
    assert wo["status"] == "ASSIGNED"

    # Manual update to reassign to a different technician
    other_tech = Technician(
        employee_id="TECH-MANUAL-02",
        name="Manual Morris",
        email="morris@test.com",
        specialization="Electrical",
        status="ACTIVE",
        hourly_rate=65.0
    )
    db_session.add(other_tech)
    db_session.commit()

    res_update = client.patch(f"/api/work-orders/{wo['id']}", json={
        "assigned_technician_id": other_tech.id
    })
    assert res_update.status_code == 200
    assert res_update.json()["assigned_technician_id"] == other_tech.id


def test_maintenance_type_skill_matching_and_emergency(client, db_session):
    """Emergency maintenance types and discipline keywords enhance recommendation scores."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint_emergency = db_session.query(MaintenanceType).filter(MaintenanceType.is_emergency == True).first()

    # Create active specialist for this asset category (Hydraulics)
    t_emerg_hydr = Technician(
        employee_id="TECH-EMERG-HYDR",
        name="Evan Emergency",
        email="evan.emerg@test.com",
        specialization="Hydraulics & Mechanical",
        status="ACTIVE",
        hourly_rate=80.0
    )
    db_session.add(t_emerg_hydr)
    db_session.commit()

    if maint_emergency:
        res = client.get(f"/api/technicians/recommendations?asset_id={asset.id}&maintenance_type_id={maint_emergency.id}")
        assert res.status_code == 200
        recs = res.json()
        assert len(recs) >= 1
        # Matching specialist should get top priority score for emergency (10.0 pts)
        rec_evan = next(r for r in recs if r["technician_id"] == t_emerg_hydr.id)
        assert rec_evan["priority_score"] >= 7.0


def test_critical_rule_enforced_independently_of_recommendation(client, db_session):
    """Rule 2 is strictly enforced on creation and update regardless of whether recommendations exist."""
    asset = db_session.query(Asset).filter(Asset.asset_tag == "AST-TEST-01").first()
    maint = db_session.query(MaintenanceType).filter(MaintenanceType.code == "CORRECTIVE").first()
    active_tech = db_session.query(Technician).filter(Technician.status == "ACTIVE").first()

    # Create CRITICAL with technician
    res_create = client.post("/api/work-orders", json={
        "title": "Critical Independent Rule 2 Test",
        "description": "Must keep technician assigned",
        "asset_id": asset.id,
        "maintenance_type_id": maint.id,
        "priority": "CRITICAL",
        "assigned_technician_id": active_tech.id,
        "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_hours": 2.0
    })
    assert res_create.status_code == 201
    wo_id = res_create.json()["id"]

    # Attempt to unassign technician on CRITICAL order must be rejected (Rule 2)
    res_unassign = client.put(f"/api/work-orders/{wo_id}", json={
        "assigned_technician_id": None
    })
    assert res_unassign.status_code == 422
    assert "Rule 2 Violation" in res_unassign.json()["detail"]

