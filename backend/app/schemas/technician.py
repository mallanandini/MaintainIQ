from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict

class TechnicianStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ON_LEAVE = "ON_LEAVE"

class TechnicianBase(BaseModel):
    employee_id: str = Field(..., min_length=2, max_length=50, json_schema_extra={"example": "TECH-101"})
    name: str = Field(..., min_length=2, max_length=255, json_schema_extra={"example": "Marcus Vance"})
    email: EmailStr = Field(..., json_schema_extra={"example": "marcus.vance@maintainiq.internal"})
    phone: Optional[str] = None
    specialization: str = Field(..., json_schema_extra={"example": "HVAC"})
    status: TechnicianStatus = Field(default=TechnicianStatus.ACTIVE, json_schema_extra={"example": "ACTIVE"})
    hourly_rate: Optional[float] = None

class TechnicianCreate(TechnicianBase):
    pass

class TechnicianUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    specialization: Optional[str] = None
    status: Optional[TechnicianStatus] = None
    hourly_rate: Optional[float] = None

class TechnicianResponse(TechnicianBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TechnicianDetailResponse(TechnicianResponse):
    assigned_work_orders_count: int = 0
    active_work_orders_count: int = 0
