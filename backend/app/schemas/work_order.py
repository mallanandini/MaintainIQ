from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.asset import AssetResponse
from backend.app.schemas.technician import TechnicianResponse
from backend.app.schemas.maintenance_type import MaintenanceTypeResponse

class WorkOrderPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class WorkOrderStatus(str, Enum):
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class WorkOrderStatusHistoryResponse(BaseModel):
    id: int
    work_order_id: int
    from_status: Optional[str] = None
    to_status: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    changed_by: Optional[str] = None
    actor_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    changed_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WorkOrderBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=5)
    asset_id: int
    maintenance_type_id: int
    priority: WorkOrderPriority = Field(default=WorkOrderPriority.MEDIUM)
    assigned_technician_id: Optional[int] = None
    scheduled_date: datetime
    estimated_hours: float = Field(default=1.0, ge=0.1)

class WorkOrderCreate(WorkOrderBase):
    work_order_number: Optional[str] = None

class WorkOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[WorkOrderPriority] = None
    assigned_technician_id: Optional[int] = None
    scheduled_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    resolution_summary: Optional[str] = None

class WorkOrderTransitionRequest(BaseModel):
    to_status: WorkOrderStatus
    changed_by: Optional[str] = None
    actor_id: Optional[str] = None
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
    asset: Optional[AssetResponse] = None
    technician: Optional[TechnicianResponse] = None
    maintenance_type: Optional[MaintenanceTypeResponse] = None
    status_history: List[WorkOrderStatusHistoryResponse] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

# Bulk Technician Assignment
class BulkAssignTechnicianRequest(BaseModel):
    work_order_ids: List[int] = Field(..., min_length=1)
    technician_id: int

class BulkOperationResultItem(BaseModel):
    work_order_id: int
    work_order_number: Optional[str] = None
    success: bool
    error: Optional[str] = None

class BulkAssignTechnicianResponse(BaseModel):
    total_requested: int
    success_count: int
    failure_count: int
    results: List[BulkOperationResultItem]

# Work Order Duplication
class WorkOrderDuplicateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    priority: Optional[WorkOrderPriority] = None
    assigned_technician_id: Optional[int] = None
    estimated_hours: Optional[float] = None
