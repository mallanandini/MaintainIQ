from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Technician(Base):
    __tablename__ = "technicians"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    specialization = Column(String(100), nullable=False, index=True) # Mechanical, Electrical, HVAC, Robotics, etc.
    status = Column(String(50), nullable=False, default="ACTIVE", index=True) # ACTIVE, ON_LEAVE, INACTIVE
    hourly_rate = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    work_orders = relationship("WorkOrder", back_populates="technician")
