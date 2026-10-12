from typing import Optional
from pydantic import BaseModel, ConfigDict

class MaintenanceTypeBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    is_emergency: bool = False

class MaintenanceTypeResponse(MaintenanceTypeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
