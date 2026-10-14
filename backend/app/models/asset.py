from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, Text
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)  # HVAC, Electrical, Machinery, etc.
    location = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="OPERATIONAL", index=True) # OPERATIONAL, UNDER_MAINTENANCE, OUT_OF_SERVICE, DECOMMISSIONED
    serial_number = Column(String(100), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    model_number = Column(String(100), nullable=True)
    criticality = Column(String(20), nullable=False, default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    operating_hours = Column(Float, nullable=True)
    operating_cycles = Column(Integer, nullable=True)
    service_threshold_hours = Column(Float, nullable=True)
    service_threshold_cycles = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    work_orders = relationship("WorkOrder", back_populates="asset", cascade="all, delete-orphan")
