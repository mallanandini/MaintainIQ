from backend.app.schemas.asset import AssetCreate, AssetUpdate, AssetResponse, AssetDetailResponse
from backend.app.schemas.technician import TechnicianCreate, TechnicianUpdate, TechnicianResponse, TechnicianDetailResponse
from backend.app.schemas.maintenance_type import MaintenanceTypeResponse
from backend.app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderDetailResponse,
    WorkOrderTransitionRequest,
    WorkOrderStatusHistoryResponse
)

__all__ = [
    "AssetCreate",
    "AssetUpdate",
    "AssetResponse",
    "AssetDetailResponse",
    "TechnicianCreate",
    "TechnicianUpdate",
    "TechnicianResponse",
    "TechnicianDetailResponse",
    "MaintenanceTypeResponse",
    "WorkOrderCreate",
    "WorkOrderUpdate",
    "WorkOrderResponse",
    "WorkOrderDetailResponse",
    "WorkOrderTransitionRequest",
    "WorkOrderStatusHistoryResponse"
]
