from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.technician import Technician
from backend.app.models.asset import Asset
from backend.app.models.work_order import WorkOrder
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.schemas.technician import TechnicianResponse
from pydantic import BaseModel, ConfigDict

class TechnicianRecommendationResponse(BaseModel):
    technician_id: int
    name: str
    employee_id: str
    specialization: str
    status: str
    hourly_rate: Optional[float] = None
    active_work_orders_count: int
    active_estimated_hours: float
    skill_score: float
    availability_score: float
    priority_score: float
    composite_score: float
    skill_match_level: str  # "DIRECT", "COMPATIBLE", "GENERAL", "NONE"
    explanation: str

    model_config = ConfigDict(from_attributes=True)


# Documented Domain & Skill Compatibility Mapping
# Maps asset categories (or technical disciplines) to compatible technician skills
RELATED_SKILL_MAP: Dict[str, List[str]] = {
    "hvac": ["thermal", "mechanical", "cooling", "energy", "chiller", "refrigeration"],
    "thermal": ["hvac", "mechanical", "boiler", "energy", "thermal & energy"],
    "thermal & energy": ["hvac", "mechanical", "boiler", "energy", "thermal"],
    "hydraulics": ["mechanical", "pneumatics", "machinery", "fluid", "hydraulics & mechanical"],
    "pneumatics": ["hydraulics", "mechanical", "machinery", "pneumatics"],
    "robotics": ["automation", "electrical", "electronics", "machinery", "robotics & automation"],
    "automation": ["robotics", "electrical", "electronics", "automation"],
    "cnc machinery": ["mechanical", "robotics", "machinery", "calibration", "hydraulics"],
    "machinery": ["mechanical", "hydraulics", "cnc machinery", "pneumatics"],
    "electrical": ["high-voltage", "electronics", "automation", "electrical & high-voltage"],
    "precision calibration": ["calibration", "machinery", "electronics", "instrumentation"],
    "calibration": ["precision calibration", "instrumentation", "electronics", "machinery"],
    "instrumentation": ["calibration", "electronics", "precision calibration", "automation"],
    "mechanical": ["hydraulics", "pneumatics", "machinery", "cnc machinery", "thermal", "hvac"],
    "cooling": ["hvac", "thermal", "chiller", "refrigeration"],
    "refrigeration": ["hvac", "thermal", "cooling", "chiller"],
    "facilities": ["hvac", "electrical", "mechanical", "plumbing"],
    "plumbing": ["hydraulics", "facilities", "mechanical"],
}


def _tokenize(text: Optional[str]) -> set:
    if not text:
        return set()
    cleaned = text.lower().replace("&", " ").replace("/", " ").replace("-", " ")
    return {w.strip() for w in cleaned.split() if len(w.strip()) > 2}


def calculate_skill_match(
    tech_specialization: Optional[str],
    asset_category: Optional[str] = None,
    wo_context: Optional[str] = None
) -> Tuple[float, str, str]:
    """
    Computes a deterministic skill match score (0.0 to 50.0), a match level enum,
    and a descriptive explanation component.
    """
    if not tech_specialization or not tech_specialization.strip():
        return 0.0, "NONE", "No documented technician specialization."

    spec_lower = tech_specialization.lower().strip()
    spec_tokens = _tokenize(tech_specialization)

    if not asset_category or not asset_category.strip():
        # Fall back to general match if work order title/description has relevant keywords
        if wo_context:
            context_tokens = _tokenize(wo_context)
            common = spec_tokens.intersection(context_tokens)
            if common:
                return 25.0, "GENERAL", f"Specialization overlaps with work order keywords ({', '.join(common)})."
        return 10.0, "GENERAL", "General technical capacity (asset category unspecified)."

    cat_lower = asset_category.lower().strip()
    cat_tokens = _tokenize(asset_category)

    # 1. Direct / Exact Specialization Match (50.0 pts)
    # Check if category is within specialization or vice versa, or shares primary tokens
    if cat_lower in spec_lower or spec_lower in cat_lower or bool(spec_tokens.intersection(cat_tokens)):
        return 50.0, "DIRECT", f"Direct skill match in {asset_category}."

    # 2. Documented Compatible / Related Match (30.0 pts)
    # Check related skills dictionary
    related_skills = []
    for cat_key, relatives in RELATED_SKILL_MAP.items():
        if cat_key in cat_lower or any(ct in cat_key for ct in cat_tokens):
            related_skills.extend(relatives)

    related_tokens = {w.lower() for w in related_skills}
    if bool(spec_tokens.intersection(related_tokens)) or any(r in spec_lower for r in related_skills):
        return 30.0, "COMPATIBLE", f"Compatible specialization for {asset_category} operations."

    # 3. Work Order Text Context Secondary Match (15.0 pts)
    if wo_context:
        context_tokens = _tokenize(wo_context)
        common = spec_tokens.intersection(context_tokens)
        if common:
            return 15.0, "GENERAL", f"Specialization matches work description keywords ({', '.join(common)})."

    # 4. No Match (0.0 pts)
    return 0.0, "NONE", f"Specialization ({tech_specialization}) does not directly match {asset_category}."


def calculate_workload(
    db: Session,
    tech_id: int,
    exclude_work_order_id: Optional[int] = None
) -> Tuple[int, float, float, str]:
    """
    Calculates active workload for a technician from assigned work orders.
    Active states are 'ASSIGNED' and 'IN_PROGRESS'.
    Returns:
        (active_orders_count, active_estimated_hours, availability_score, workload_summary)
    """
    query = db.query(WorkOrder).filter(
        WorkOrder.assigned_technician_id == tech_id,
        WorkOrder.status.in_(["ASSIGNED", "IN_PROGRESS"])
    )
    if exclude_work_order_id:
        query = query.filter(WorkOrder.id != exclude_work_order_id)

    active_orders = query.all()
    count = len(active_orders)
    hours = sum(wo.estimated_hours or 0.0 for wo in active_orders)

    # Availability Formula (0.0 to 40.0 pts)
    # Penalty: 10 pts per active order + 1 pt per active estimated hour (capped at 10 pts hour penalty)
    penalty = (count * 10.0) + min(10.0, hours * 1.0)
    avail_score = max(0.0, 40.0 - penalty)

    if count == 0:
        summary = "Available with 0 active work orders (optimal capacity)."
    elif count == 1:
        summary = f"Currently assigned to 1 active work order ({hours:.1f} hrs estimated)."
    else:
        summary = f"Currently assigned to {count} active work orders ({hours:.1f} hrs estimated)."

    return count, round(hours, 2), round(avail_score, 2), summary


def get_technician_recommendations(
    db: Session,
    asset_id: Optional[int] = None,
    priority: Optional[str] = "MEDIUM",
    maintenance_type_id: Optional[int] = None,
    wo_context: Optional[str] = None,
    exclude_work_order_id: Optional[int] = None,
    limit: int = 3
) -> List[TechnicianRecommendationResponse]:
    """
    Deterministic, explainable recommendation system for technician dispatch.
    
    Ranking Formula:
        Composite Score (0 - 100) = Skill Score (max 50) + Availability Score (max 40) + Priority Factor (max 10)
    
    Tie-Breaking Criteria:
        1. Higher Composite Score
        2. Higher Skill Match Score
        3. Lower Active Work Order Count
        4. Lower Hourly Rate (cost efficiency)
        5. Lower Technician ID (stable sorting)
        
    Limitations:
        - Relies on documented specialization strings in MaintainIQ.
        - Workload is computed strictly from active assignments in MaintainIQ;
          external plant duties or off-system tasks are not captured.
        - Technicians on leave or inactive are 100% excluded.
    """
    # 1. Fetch only ACTIVE technicians (Mandatory Eligibility Filter)
    active_technicians = (
        db.query(Technician)
        .filter(Technician.status == "ACTIVE")
        .all()
    )

    if not active_technicians:
        return []

    # 2. Fetch Asset details if available
    asset_category = None
    if asset_id:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if asset:
            asset_category = asset.category

    # 3. Check maintenance type emergency status & context
    is_emergency = False
    context_tokens_list = []
    if wo_context:
        context_tokens_list.append(wo_context)

    if maintenance_type_id:
        mt = db.query(MaintenanceType).filter(MaintenanceType.id == maintenance_type_id).first()
        if mt:
            if mt.is_emergency:
                is_emergency = True
            if mt.name:
                context_tokens_list.append(mt.name)
            if mt.description:
                context_tokens_list.append(mt.description)

    combined_context = " ".join(context_tokens_list) if context_tokens_list else None
    priority_clean = (priority or "MEDIUM").upper()

    recommendations: List[TechnicianRecommendationResponse] = []

    for tech in active_technicians:
        # Skill Match Calculation (0 - 50 pts)
        skill_score, match_level, skill_explanation = calculate_skill_match(
            tech_specialization=tech.specialization,
            asset_category=asset_category,
            wo_context=combined_context
        )

        # Workload Calculation (0 - 40 pts)
        act_count, act_hours, avail_score, workload_explanation = calculate_workload(
            db=db,
            tech_id=tech.id,
            exclude_work_order_id=exclude_work_order_id
        )

        # Priority / Criticality Alignment Factor (0 - 10 pts)
        prio_score = 5.0  # Base
        if priority_clean == "CRITICAL" or is_emergency:
            if match_level == "DIRECT":
                prio_score = 10.0
            elif match_level == "COMPATIBLE":
                prio_score = 7.0
            else:
                prio_score = 2.0
        elif priority_clean == "HIGH":
            if match_level == "DIRECT":
                prio_score = 8.0
            elif match_level == "COMPATIBLE":
                prio_score = 6.0

        composite = round(skill_score + avail_score + prio_score, 2)

        # Generate Synthesized Explanation
        reasons = []
        if match_level == "DIRECT":
            reasons.append(f"Direct {tech.specialization} specialist")
        elif match_level == "COMPATIBLE":
            reasons.append(f"Compatible {tech.specialization} background")
        elif match_level == "GENERAL":
            reasons.append(f"General technical capacity ({tech.specialization})")
        else:
            reasons.append(f"Available technician ({tech.specialization})")

        if act_count == 0:
            reasons.append("immediate availability (0 active orders)")
        else:
            reasons.append(f"currently managing {act_count} active order(s)")

        if priority_clean == "CRITICAL" and match_level == "DIRECT":
            reasons.append("high priority match for critical asset")

        full_explanation = f"{reasons[0].capitalize()}; {'; '.join(reasons[1:])}."

        rec = TechnicianRecommendationResponse(
            technician_id=tech.id,
            name=tech.name,
            employee_id=tech.employee_id,
            specialization=tech.specialization,
            status=tech.status,
            hourly_rate=tech.hourly_rate,
            active_work_orders_count=act_count,
            active_estimated_hours=act_hours,
            skill_score=skill_score,
            availability_score=avail_score,
            priority_score=prio_score,
            composite_score=composite,
            skill_match_level=match_level,
            explanation=full_explanation
        )
        recommendations.append(rec)

    # 4. Deterministic Ranking
    # Sort key: (-composite_score, -skill_score, active_count, hourly_rate, tech.id)
    recommendations.sort(
        key=lambda r: (
            -r.composite_score,
            -r.skill_score,
            r.active_work_orders_count,
            r.hourly_rate if r.hourly_rate is not None else 9999.0,
            r.technician_id
        )
    )

    return recommendations[:limit]
