from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict

class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"

class RiskFactorDetail(BaseModel):
    category: str  # "OPEN_WORK_ORDERS", "OVERDUE_MAINTENANCE", "CORRECTIVE_REPAIRS", "USAGE_THRESHOLDS", "STATUS_OVERRIDE"
    title: str
    impact_points: float
    max_points: float
    severity: str  # "INFO", "WARNING", "HIGH", "CRITICAL"
    description: str

class AssetUsageHealthMetrics(BaseModel):
    operating_hours: Optional[float] = None
    service_threshold_hours: Optional[float] = None
    hours_utilization_pct: Optional[float] = None
    operating_cycles: Optional[int] = None
    service_threshold_cycles: Optional[int] = None
    cycles_utilization_pct: Optional[float] = None
    threshold_exceeded: bool = False

class AssetMaintenanceHealthMetrics(BaseModel):
    open_work_orders_count: int = 0
    critical_open_count: int = 0
    high_open_count: int = 0
    overdue_work_orders_count: int = 0
    recent_corrective_count: int = 0
    total_maintenance_records: int = 0
    last_maintenance_date: Optional[str] = None

class AssetHealthDetail(BaseModel):
    asset_id: int
    asset_tag: str
    name: str
    category: str
    location: str
    status: str
    criticality: str
    risk_score: Optional[float] = None  # None if insufficient data; 0.0 to 100.0 otherwise
    risk_level: RiskLevel
    has_sufficient_data: bool
    status_label: str  # "Low Risk", "Moderate Risk", "High Risk", "Critical Risk", "Insufficient Data"
    summary_explanation: str
    contributing_factors: List[RiskFactorDetail] = []
    usage_metrics: AssetUsageHealthMetrics
    maintenance_metrics: AssetMaintenanceHealthMetrics
    needs_maintenance_attention: bool
    disclaimer: str = (
        "This assessment is a rule-based maintenance risk indicator based on documented service history, "
        "scheduled dates, and operating thresholds. It does not predict mechanical equipment failure."
    )

    model_config = ConfigDict(from_attributes=True)

class AssetHealthOverviewSummary(BaseModel):
    total_assets: int
    total_assessed: int
    insufficient_data_count: int
    critical_risk_count: int
    high_risk_count: int
    moderate_risk_count: int
    low_risk_count: int
    attention_required_count: int

class AssetHealthOverviewResponse(BaseModel):
    summary: AssetHealthOverviewSummary
    formula_documentation: str
    disclaimer: str = (
        "Rule-based maintenance risk indicator based on documented service history, "
        "scheduled dates, and operating thresholds. Does not predict mechanical equipment failure."
    )
    items: List[AssetHealthDetail]

    model_config = ConfigDict(from_attributes=True)
