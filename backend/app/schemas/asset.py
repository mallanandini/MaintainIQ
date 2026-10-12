from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class AssetBase(BaseModel):
    asset_tag: str = Field(..., min_length=2, max_length=50, json_schema_extra={"example": "AST-0104"})
    name: str = Field(..., min_length=2, max_length=255, json_schema_extra={"example": "Centrifugal Chiller 450T"})
    category: str = Field(..., json_schema_extra={"example": "HVAC"})
    location: str = Field(..., json_schema_extra={"example": "Facility A - Penthouse 2"})
    status: str = Field(default="OPERATIONAL", json_schema_extra={"example": "OPERATIONAL"})
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    criticality: str = Field(default="MEDIUM", json_schema_extra={"example": "HIGH"})
    notes: Optional[str] = None

class AssetCreate(AssetBase):
    pass

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    criticality: Optional[str] = None
    notes: Optional[str] = None

class AssetResponse(AssetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AssetDetailResponse(AssetResponse):
    work_orders_count: int = 0
    active_work_orders_count: int = 0
