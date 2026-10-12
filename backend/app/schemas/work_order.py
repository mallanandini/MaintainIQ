from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.asset import AssetResponse
from backend.app.schemas.technician import TechnicianResponse
from backend.app.schemas.maintenance_type import MaintenanceTypeResponse

class WorkOrderStatusHistoryResponse(BaseModel):
    id: int
    work_order_id: int
    from_status: Optional[str] = None
    to_status: str
    changed_by: str
    notes: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WorkOrderBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=5)
    asset_id: int
    maintenance_type_id: int
    priority: str = Field(default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    assigned_technician_id: Optional[int] = None
    scheduled_date: datetime
    estimated_hours: float = Field(default=1.0, ge=0.1)

class WorkOrderCreate(WorkOrderBase):
    pass

class WorkOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    assigned_technician_id: Optional[int] = None
    scheduled_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    resolution_summary: Optional[str] = None

class WorkOrderTransitionRequest(BaseModel):
    to_status: str
    changed_by: str = Field(default="Dispatcher")
    notes: Optional[str] = None
    actual_hours: Optional[float] = None
    resolution_summary: Optional[str] = None
    cancellation_reason: Optional[str] = None

class WorkOrderResponse(WorkOrderBase):
    id: int
    work_order_number: str
    status: str
    actual_hours: Optional[float] = None
    resolution_summary: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WorkOrderDetailResponse(WorkOrderResponse):
    asset: AssetResponse
    technician: Optional[TechnicianResponse] = None
    maintenance_type: MaintenanceTypeResponse
    status_history: List[WorkOrderStatusHistoryResponse] = []
