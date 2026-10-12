from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    work_order_number = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False, index=True)
    maintenance_type_id = Column(Integer, ForeignKey("maintenance_types.id"), nullable=False, index=True)
    assigned_technician_id = Column(Integer, ForeignKey("technicians.id", ondelete="SET NULL"), nullable=True, index=True)

    priority = Column(String(20), nullable=False, default="MEDIUM", index=True) # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(20), nullable=False, default="OPEN", index=True) # OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED

    scheduled_date = Column(DateTime, nullable=False, index=True)
    estimated_hours = Column(Float, nullable=False, default=1.0)
    actual_hours = Column(Float, nullable=True)

    resolution_summary = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    asset = relationship("Asset", back_populates="work_orders")
    technician = relationship("Technician", back_populates="work_orders")
    maintenance_type = relationship("MaintenanceType", back_populates="work_orders")
    status_history = relationship("WorkOrderStatusHistory", back_populates="work_order", cascade="all, delete-orphan", order_by="WorkOrderStatusHistory.created_at.desc()")


class WorkOrderStatusHistory(Base):
    __tablename__ = "work_order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=False)
    changed_by = Column(String(100), nullable=False, default="System Dispatcher")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    work_order = relationship("WorkOrder", back_populates="status_history")
