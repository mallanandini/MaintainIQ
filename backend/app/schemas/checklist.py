from typing import Optional, List
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict

class ChecklistItemStatus(str, Enum):
    PENDING = "PENDING"
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_APPLICABLE = "NOT_APPLICABLE"


# Template Item Schemas
class ChecklistTemplateItemCreate(BaseModel):
    order_index: int = 0
    item_text: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    is_required: bool = True

class ChecklistTemplateItemResponse(BaseModel):
    id: int
    template_id: int
    order_index: int
    item_text: str
    description: Optional[str] = None
    is_required: bool

    model_config = ConfigDict(from_attributes=True)


# Template Schemas
class ChecklistTemplateCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    description: Optional[str] = None
    asset_category: Optional[str] = None
    maintenance_type_id: Optional[int] = None
    items: List[ChecklistTemplateItemCreate] = []

class ChecklistTemplateResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    asset_category: Optional[str] = None
    maintenance_type_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: List[ChecklistTemplateItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# Work Order Checklist Item Schemas
class WorkOrderChecklistItemUpdate(BaseModel):
    status: Optional[ChecklistItemStatus] = None
    notes: Optional[str] = None
    inspected_by: Optional[str] = None

class WorkOrderChecklistItemResponse(BaseModel):
    id: int
    checklist_id: int
    order_index: int
    item_text: str
    description: Optional[str] = None
    is_required: bool
    status: str
    notes: Optional[str] = None
    inspected_at: Optional[datetime] = None
    inspected_by: Optional[str] = None
    attachment_filename: Optional[str] = None
    attachment_content_type: Optional[str] = None
    attachment_file_size: Optional[int] = None
    has_attachment: bool = False

    model_config = ConfigDict(from_attributes=True)


# Work Order Checklist Container Schemas
class WorkOrderChecklistInitialize(BaseModel):
    template_id: Optional[int] = None
    title: Optional[str] = None

class WorkOrderChecklistComplete(BaseModel):
    summary_notes: Optional[str] = None
    completed_by: Optional[str] = None

class WorkOrderChecklistResponse(BaseModel):
    id: int
    work_order_id: int
    template_id: Optional[int] = None
    title: str
    summary_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_items: int = 0
    passed_items: int = 0
    failed_items: int = 0
    na_items: int = 0
    pending_items: int = 0
    completion_percentage: float = 0.0
    has_failed_items: bool = False
    can_complete: bool = False
    incomplete_required_count: int = 0
    items: List[WorkOrderChecklistItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
