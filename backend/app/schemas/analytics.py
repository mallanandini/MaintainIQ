from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class StatusDistributionItem(BaseModel):
    status: str
    label: str
    count: int
    percentage: float
    color: str

class PriorityDistributionItem(BaseModel):
    priority: str
    label: str
    count: int
    percentage: float
    color: str

class MonthlyCompletionItem(BaseModel):
    month_key: str  # "YYYY-MM"
    label: str      # "Oct 2026"
    year: int
    month: int
    completed_count: int

class TechnicianWorkloadItem(BaseModel):
    technician_id: int
    name: str
    employee_id: str
    specialization: str
    status: str
    active_work_orders_count: int
    completed_work_orders_count: int
    total_assigned_count: int
    active_estimated_hours: float

class FrequentlyMaintainedAssetItem(BaseModel):
    asset_id: int
    asset_tag: str
    name: str
    category: str
    criticality: str
    total_work_orders: int
    completed_work_orders: int
    active_work_orders: int

class OverdueMetrics(BaseModel):
    overdue_count: int
    critical_overdue_count: int
    high_overdue_count: int
    rule_description: str

class AnalyticsSummary(BaseModel):
    total_work_orders: int
    active_work_orders: int
    completed_work_orders: int
    cancelled_work_orders: int
    overdue_work_orders: int
    completion_rate_percentage: float
    cancellation_rate_percentage: float = 0.0
    avg_completion_time_hours: Optional[float] = None
    cancellation_reasons_breakdown: List[Dict[str, Any]] = []
    total_assets: int
    total_technicians: int
    active_technicians: int
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None

class MaintenanceAnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    status_distribution: List[StatusDistributionItem]
    priority_distribution: List[PriorityDistributionItem]
    monthly_completion_trend: List[MonthlyCompletionItem]
    technician_workloads: List[TechnicianWorkloadItem]
    frequently_maintained_assets: List[FrequentlyMaintainedAssetItem]
    overdue_metrics: OverdueMetrics

    model_config = ConfigDict(from_attributes=True)


class OverdueWorkOrderReportItem(BaseModel):
    id: int
    work_order_number: str
    title: str
    priority: str
    status: str
    asset_id: int
    asset_tag: Optional[str] = None
    asset_name: Optional[str] = None
    location: Optional[str] = None
    assigned_technician_id: Optional[int] = None
    technician_name: Optional[str] = None
    scheduled_date: datetime
    days_overdue: int
    estimated_hours: float

    model_config = ConfigDict(from_attributes=True)


class TechnicianWorkloadReportItem(BaseModel):
    technician_id: int
    employee_id: str
    name: str
    specialization: str
    status: str
    active_work_orders_count: int
    active_estimated_hours: float
    completed_work_orders_count: int
    total_assigned_count: int
    utilization_status: str  # "AVAILABLE", "OPTIMAL", "HEAVY", "OVERLOADED"
    active_work_orders: List[Dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)

