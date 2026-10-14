from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from backend.app.models.asset import Asset
from backend.app.models.work_order import WorkOrder
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.schemas.asset_health import (
    RiskLevel,
    RiskFactorDetail,
    AssetUsageHealthMetrics,
    AssetMaintenanceHealthMetrics,
    AssetHealthDetail,
    AssetHealthOverviewSummary,
    AssetHealthOverviewResponse,
)

FORMULA_DOCUMENTATION = """MaintainIQ Deterministic Asset Risk Scoring Formula:
Risk Score is computed dynamically (0 to 100) from verified operational logs:
1. Critical Open Work Orders (Max 35 pts):
   - 1 Critical open ticket: +25 pts; >= 2 Critical open tickets: +35 pts
   - High open tickets (if no critical): 1 ticket: +10 pts; >= 2 tickets: +18 pts
2. Overdue Maintenance (Max 30 pts):
   - Non-terminal work orders with scheduled_date < now_utc:
     1 overdue: +15 pts; 2 overdue: +25 pts; >= 3 overdue: +30 pts
3. Recent Corrective / Emergency Repairs (Max 20 pts):
   - Corrective or emergency maintenance orders within the last 90 days:
     1 order: +10 pts; >= 2 orders: +20 pts
4. Service Threshold Utilization (Max 25 pts):
   - Ratio U = max(operating_hours / threshold_hours, operating_cycles / threshold_cycles)
   - U >= 1.0 (threshold exceeded): +25 pts
   - 0.85 <= U < 1.0 (approaching limit): +15 pts
   - 0.70 <= U < 0.85: +8 pts
   - U < 0.70: 0 pts
5. Operational Status Adjustment:
   - OUT_OF_SERVICE: Minimum score floor of 75 applied (Critical risk).
   - DEGRADED: Minimum score floor of 50 applied.
   - UNDER_MAINTENANCE: +10 base points.
Score Categories:
   - LOW: 0 - 24.9
   - MODERATE: 25.0 - 49.9
   - HIGH: 50.0 - 74.9
   - CRITICAL: 75.0 - 100.0
   - INSUFFICIENT DATA: Assessed when asset has neither recorded usage hours/cycles nor maintenance history.
Notice: This is a rule-based maintenance risk indicator based on service history and operating limits. It does not predict mechanical equipment failure."""


def calculate_asset_health(asset: Asset, work_orders: List[WorkOrder]) -> AssetHealthDetail:
    now_utc = datetime.utcnow()

    # 1. Inspect Usage Metrics
    hours = asset.operating_hours
    thresh_hours = asset.service_threshold_hours
    cycles = asset.operating_cycles
    thresh_cycles = asset.service_threshold_cycles

    hours_pct: Optional[float] = None
    if hours is not None and thresh_hours is not None and thresh_hours > 0:
        hours_pct = round((hours / thresh_hours) * 100.0, 1)

    cycles_pct: Optional[float] = None
    if cycles is not None and thresh_cycles is not None and thresh_cycles > 0:
        cycles_pct = round((cycles / thresh_cycles) * 100.0, 1)

    threshold_exceeded = (hours_pct is not None and hours_pct >= 100.0) or (cycles_pct is not None and cycles_pct >= 100.0)

    usage_metrics = AssetUsageHealthMetrics(
        operating_hours=hours,
        service_threshold_hours=thresh_hours,
        hours_utilization_pct=hours_pct,
        operating_cycles=cycles,
        service_threshold_cycles=thresh_cycles,
        cycles_utilization_pct=cycles_pct,
        threshold_exceeded=threshold_exceeded
    )

    # 2. Inspect Maintenance Metrics
    open_orders: List[WorkOrder] = []
    critical_open = 0
    high_open = 0
    overdue_orders = 0
    recent_corrective = 0
    last_maint_dt: Optional[datetime] = None

    cutoff_90d = now_utc - timedelta(days=90)

    for wo in work_orders:
        is_open = wo.status in ("OPEN", "ASSIGNED", "IN_PROGRESS")
        if is_open:
            open_orders.append(wo)
            if wo.priority == "CRITICAL":
                critical_open += 1
            elif wo.priority == "HIGH":
                high_open += 1

            if wo.scheduled_date and wo.scheduled_date < now_utc:
                overdue_orders += 1

        # Check completed date or created date for last maintenance
        wo_date = wo.scheduled_date or wo.created_at
        if wo_date and (last_maint_dt is None or wo_date > last_maint_dt):
            last_maint_dt = wo_date

        # Check recent corrective or emergency repairs
        is_corrective = (
            (wo.maintenance_type and (wo.maintenance_type.code in ("CORRECTIVE", "EMERGENCY") or wo.maintenance_type.is_emergency))
            or (wo.priority == "CRITICAL")
        )
        if is_corrective:
            event_dt = wo.scheduled_date or wo.created_at
            if event_dt and event_dt >= cutoff_90d:
                recent_corrective += 1

    maintenance_metrics = AssetMaintenanceHealthMetrics(
        open_work_orders_count=len(open_orders),
        critical_open_count=critical_open,
        high_open_count=high_open,
        overdue_work_orders_count=overdue_orders,
        recent_corrective_count=recent_corrective,
        total_maintenance_records=len(work_orders),
        last_maintenance_date=last_maint_dt.strftime("%Y-%m-%d") if last_maint_dt else None
    )

    # 3. Check for Insufficient Data
    # An asset has insufficient data if it has NO recorded usage (hours and cycles are None)
    # AND NO maintenance history records logged.
    has_usage_data = (hours is not None) or (cycles is not None)
    has_maint_data = len(work_orders) > 0

    if not has_usage_data and not has_maint_data:
        return AssetHealthDetail(
            asset_id=asset.id,
            asset_tag=asset.asset_tag,
            name=asset.name,
            category=asset.category,
            location=asset.location,
            status=asset.status,
            criticality=asset.criticality,
            risk_score=None,
            risk_level=RiskLevel.INSUFFICIENT_DATA,
            has_sufficient_data=False,
            status_label="Insufficient Data",
            summary_explanation=(
                "Insufficient operational usage or service history data to calculate an accurate risk assessment. "
                "Operating usage hours/cycles or maintenance history records are required."
            ),
            contributing_factors=[
                RiskFactorDetail(
                    category="DATA_COMPLETENESS",
                    title="Missing Operational Metrics",
                    impact_points=0.0,
                    max_points=0.0,
                    severity="INFO",
                    description="No recorded operating hours, cycles, or work-order history found for this machinery."
                )
            ],
            usage_metrics=usage_metrics,
            maintenance_metrics=maintenance_metrics,
            needs_maintenance_attention=False
        )

    # 4. Calculate Risk Factors
    factors: List[RiskFactorDetail] = []
    total_score = 0.0

    # Factor 1: Critical & High Open Work Orders (Max 35)
    open_impact = 0.0
    if critical_open >= 2:
        open_impact = 35.0
        factors.append(RiskFactorDetail(
            category="OPEN_WORK_ORDERS",
            title="Multiple Critical Work Orders Pending",
            impact_points=35.0,
            max_points=35.0,
            severity="CRITICAL",
            description=f"{critical_open} active work orders with CRITICAL priority are pending resolution."
        ))
    elif critical_open == 1:
        open_impact = 25.0
        factors.append(RiskFactorDetail(
            category="OPEN_WORK_ORDERS",
            title="Critical Work Order Dispatched",
            impact_points=25.0,
            max_points=35.0,
            severity="CRITICAL",
            description="1 active work order with CRITICAL emergency priority is currently pending execution."
        ))
    elif high_open >= 2:
        open_impact = 18.0
        factors.append(RiskFactorDetail(
            category="OPEN_WORK_ORDERS",
            title="High Priority Work Orders Open",
            impact_points=18.0,
            max_points=35.0,
            severity="HIGH",
            description=f"{high_open} active work orders with HIGH priority are pending."
        ))
    elif high_open == 1:
        open_impact = 10.0
        factors.append(RiskFactorDetail(
            category="OPEN_WORK_ORDERS",
            title="High Priority Work Order Open",
            impact_points=10.0,
            max_points=35.0,
            severity="WARNING",
            description="1 active work order with HIGH priority is scheduled or in-progress."
        ))
    elif len(open_orders) > 0:
        open_impact = 5.0
        factors.append(RiskFactorDetail(
            category="OPEN_WORK_ORDERS",
            title="Routine Work Orders Active",
            impact_points=5.0,
            max_points=35.0,
            severity="INFO",
            description=f"{len(open_orders)} standard active work order(s) currently open."
        ))
    total_score += open_impact

    # Factor 2: Overdue Maintenance (Max 30)
    overdue_impact = 0.0
    if overdue_orders >= 3:
        overdue_impact = 30.0
        factors.append(RiskFactorDetail(
            category="OVERDUE_MAINTENANCE",
            title="Severe Maintenance Schedule Backlog",
            impact_points=30.0,
            max_points=30.0,
            severity="CRITICAL",
            description=f"{overdue_orders} work orders have breached their target scheduled date."
        ))
    elif overdue_orders == 2:
        overdue_impact = 25.0
        factors.append(RiskFactorDetail(
            category="OVERDUE_MAINTENANCE",
            title="Multiple Overdue Maintenance Orders",
            impact_points=25.0,
            max_points=30.0,
            severity="HIGH",
            description="2 work orders are past their scheduled date without completed sign-off."
        ))
    elif overdue_orders == 1:
        overdue_impact = 15.0
        factors.append(RiskFactorDetail(
            category="OVERDUE_MAINTENANCE",
            title="Overdue Maintenance Scheduled Order",
            impact_points=15.0,
            max_points=30.0,
            severity="WARNING",
            description="1 active work order has breached its target scheduled date."
        ))
    total_score += overdue_impact

    # Factor 3: Recent Corrective Repairs (Max 20)
    corrective_impact = 0.0
    if recent_corrective >= 2:
        corrective_impact = 20.0
        factors.append(RiskFactorDetail(
            category="CORRECTIVE_REPAIRS",
            title="Frequent Corrective Repairs",
            impact_points=20.0,
            max_points=20.0,
            severity="HIGH",
            description=f"{recent_corrective} corrective/emergency repairs executed in the last 90 days."
        ))
    elif recent_corrective == 1:
        corrective_impact = 10.0
        factors.append(RiskFactorDetail(
            category="CORRECTIVE_REPAIRS",
            title="Recent Corrective Repair Logged",
            impact_points=10.0,
            max_points=20.0,
            severity="INFO",
            description="1 corrective or emergency breakdown repair occurred in recent operational history."
        ))
    total_score += corrective_impact

    # Factor 4: Usage vs Configurable Service Thresholds (Max 25)
    max_utilization = 0.0
    if hours_pct is not None:
        max_utilization = max(max_utilization, hours_pct)
    if cycles_pct is not None:
        max_utilization = max(max_utilization, cycles_pct)

    usage_impact = 0.0
    if max_utilization >= 100.0:
        usage_impact = 25.0
        factors.append(RiskFactorDetail(
            category="USAGE_THRESHOLDS",
            title="Service Threshold Exceeded",
            impact_points=25.0,
            max_points=25.0,
            severity="CRITICAL",
            description=f"Operating metric reached {max_utilization:.0f}% of recommended maintenance service threshold."
        ))
    elif max_utilization >= 85.0:
        usage_impact = 15.0
        factors.append(RiskFactorDetail(
            category="USAGE_THRESHOLDS",
            title="Approaching Service Limit",
            impact_points=15.0,
            max_points=25.0,
            severity="WARNING",
            description=f"Operating metric at {max_utilization:.0f}% of recommended maintenance service threshold."
        ))
    elif max_utilization >= 70.0:
        usage_impact = 8.0
        factors.append(RiskFactorDetail(
            category="USAGE_THRESHOLDS",
            title="Moderate Operating Utilization",
            impact_points=8.0,
            max_points=25.0,
            severity="INFO",
            description=f"Operating metric at {max_utilization:.0f}% of service threshold."
        ))
    total_score += usage_impact

    # Factor 5: Operational Status Override & Floors
    if asset.status == "OUT_OF_SERVICE":
        if total_score < 75.0:
            override_pts = 75.0 - total_score
            total_score = 75.0
            factors.append(RiskFactorDetail(
                category="STATUS_OVERRIDE",
                title="Out of Service Status Floor",
                impact_points=round(override_pts, 1),
                max_points=75.0,
                severity="CRITICAL",
                description="Equipment is marked OUT_OF_SERVICE. Baseline floor elevated to CRITICAL risk."
            ))
    elif asset.status == "DEGRADED":
        if total_score < 50.0:
            override_pts = 50.0 - total_score
            total_score = 50.0
            factors.append(RiskFactorDetail(
                category="STATUS_OVERRIDE",
                title="Degraded Performance Status Floor",
                impact_points=round(override_pts, 1),
                max_points=50.0,
                severity="HIGH",
                description="Equipment is running in DEGRADED condition. Baseline floor elevated to HIGH risk."
            ))
    elif asset.status == "UNDER_MAINTENANCE":
        total_score += 10.0
        factors.append(RiskFactorDetail(
            category="STATUS_OVERRIDE",
            title="Under Maintenance Condition",
            impact_points=10.0,
            max_points=10.0,
            severity="INFO",
            description="Machinery currently undergoing active maintenance servicing."
        ))

    # Clamp total score to [0.0, 100.0]
    final_score = min(100.0, max(0.0, round(total_score, 1)))

    # Determine Risk Category
    if final_score >= 75.0:
        risk_level = RiskLevel.CRITICAL
        status_label = "Critical Risk"
    elif final_score >= 50.0:
        risk_level = RiskLevel.HIGH
        status_label = "High Risk"
    elif final_score >= 25.0:
        risk_level = RiskLevel.MODERATE
        status_label = "Moderate Risk"
    else:
        risk_level = RiskLevel.LOW
        status_label = "Low Risk"

    # Needs Maintenance Attention
    needs_attention = (risk_level in (RiskLevel.CRITICAL, RiskLevel.HIGH)) or (overdue_orders > 0) or (critical_open > 0) or (asset.status == "OUT_OF_SERVICE")

    # Generate Summary Explanation
    if len(factors) == 0:
        summary_explanation = "Normal operating baseline. All scheduled maintenance is up-to-date and operating metrics remain within safe thresholds."
    else:
        top_factor = factors[0].title
        summary_explanation = f"Evaluated at {status_label} ({final_score}/100) primarily driven by: {top_factor}."
        if overdue_orders > 0:
            summary_explanation += f" Contains {overdue_orders} overdue maintenance order(s)."

    return AssetHealthDetail(
        asset_id=asset.id,
        asset_tag=asset.asset_tag,
        name=asset.name,
        category=asset.category,
        location=asset.location,
        status=asset.status,
        criticality=asset.criticality,
        risk_score=final_score,
        risk_level=risk_level,
        has_sufficient_data=True,
        status_label=status_label,
        summary_explanation=summary_explanation,
        contributing_factors=factors,
        usage_metrics=usage_metrics,
        maintenance_metrics=maintenance_metrics,
        needs_maintenance_attention=needs_attention
    )


def get_fleet_asset_health_overview(
    db: Session,
    category: Optional[str] = None,
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    needs_attention_only: bool = False
) -> AssetHealthOverviewResponse:
    """
    Fetch all assets with work order histories and compute live fleet-wide health indicators.
    Avoids storing derived scores by evaluating dynamically at request time.
    """
    query = (
        db.query(Asset)
        .options(
            joinedload(Asset.work_orders).joinedload(WorkOrder.maintenance_type)
        )
    )

    if category:
        query = query.filter(Asset.category == category)
    if status:
        query = query.filter(Asset.status == status)

    all_assets = query.order_by(Asset.id.asc()).all()

    items: List[AssetHealthDetail] = []
    critical_count = 0
    high_count = 0
    moderate_count = 0
    low_count = 0
    insufficient_count = 0
    attention_count = 0

    for asset in all_assets:
        detail = calculate_asset_health(asset, asset.work_orders)

        # Summary statistics
        if not detail.has_sufficient_data:
            insufficient_count += 1
        elif detail.risk_level == RiskLevel.CRITICAL:
            critical_count += 1
        elif detail.risk_level == RiskLevel.HIGH:
            high_count += 1
        elif detail.risk_level == RiskLevel.MODERATE:
            moderate_count += 1
        elif detail.risk_level == RiskLevel.LOW:
            low_count += 1

        if detail.needs_maintenance_attention:
            attention_count += 1

        # Apply risk_level filter if specified
        if risk_level and detail.risk_level.value != risk_level:
            continue

        # Apply needs_attention filter if specified
        if needs_attention_only and not detail.needs_maintenance_attention:
            continue

        items.append(detail)

    summary = AssetHealthOverviewSummary(
        total_assets=len(all_assets),
        total_assessed=len(all_assets) - insufficient_count,
        insufficient_data_count=insufficient_count,
        critical_risk_count=critical_count,
        high_risk_count=high_count,
        moderate_risk_count=moderate_count,
        low_risk_count=low_count,
        attention_required_count=attention_count
    )

    return AssetHealthOverviewResponse(
        summary=summary,
        formula_documentation=FORMULA_DOCUMENTATION,
        items=items
    )
