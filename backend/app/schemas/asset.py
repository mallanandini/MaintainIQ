from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class AssetStatus(str, Enum):
    OPERATIONAL = "OPERATIONAL"
    DEGRADED = "DEGRADED"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"
    DECOMMISSIONED = "DECOMMISSIONED"

class AssetCriticality(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class AssetBase(BaseModel):
    asset_tag: str = Field(..., min_length=2, max_length=50, json_schema_extra={"example": "AST-0104"})
    name: str = Field(..., min_length=2, max_length=255, json_schema_extra={"example": "Centrifugal Chiller 450T"})
    category: str = Field(..., json_schema_extra={"example": "HVAC"})
    location: str = Field(..., json_schema_extra={"example": "Facility A - Penthouse 2"})
    status: AssetStatus = Field(default=AssetStatus.OPERATIONAL, json_schema_extra={"example": "OPERATIONAL"})
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    criticality: AssetCriticality = Field(default=AssetCriticality.MEDIUM, json_schema_extra={"example": "HIGH"})
    operating_hours: Optional[float] = None
    operating_cycles: Optional[int] = None
    service_threshold_hours: Optional[float] = None
    service_threshold_cycles: Optional[int] = None
    notes: Optional[str] = None

class AssetCreate(AssetBase):
    pass

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    status: Optional[AssetStatus] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    criticality: Optional[AssetCriticality] = None
    operating_hours: Optional[float] = None
    operating_cycles: Optional[int] = None
    service_threshold_hours: Optional[float] = None
    service_threshold_cycles: Optional[int] = None
    notes: Optional[str] = None

class AssetResponse(AssetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AssetDetailResponse(AssetResponse):
    work_orders_count: int = 0
    active_work_orders_count: int = 0

from backend.app.schemas.maintenance_type import MaintenanceTypeResponse
from backend.app.schemas.technician import TechnicianResponse

class AssetMaintenanceHistoryItem(BaseModel):
    id: int
    work_order_number: str
    title: str
    description: str
    maintenance_type_id: int
    maintenance_type: Optional[MaintenanceTypeResponse] = None
    priority: str
    status: str
    assigned_technician_id: Optional[int] = None
    technician: Optional[TechnicianResponse] = None
    scheduled_date: datetime
    created_date: datetime
    created_at: datetime
    completed_date: Optional[datetime] = None
    actual_hours: Optional[float] = None
    estimated_hours: Optional[float] = None
    resolution_summary: Optional[str] = None
    cancellation_reason: Optional[str] = None
    has_checklist: bool = False
    checklist_status: Optional[str] = None  # "COMPLETED", "IN_PROGRESS", "FAILED_ITEMS"
    checklist_summary: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
