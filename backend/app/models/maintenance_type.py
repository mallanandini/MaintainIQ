from sqlalchemy import Column, Integer, String, Text, Boolean
from sqlalchemy.orm import relationship
from backend.app.database import Base

class MaintenanceType(Base):
    __tablename__ = "maintenance_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True) # PREVENTATIVE, CORRECTIVE, EMERGENCY, INSPECTION, CALIBRATION
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_emergency = Column(Boolean, default=False, nullable=False)

    work_orders = relationship("WorkOrder", back_populates="maintenance_type")
