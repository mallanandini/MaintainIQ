from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from backend.app.database import Base

class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    asset_category = Column(String(100), nullable=True, index=True)
    maintenance_type_id = Column(Integer, ForeignKey("maintenance_types.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    maintenance_type = relationship("MaintenanceType")
    items = relationship("ChecklistTemplateItem", back_populates="template", cascade="all, delete-orphan", order_by="ChecklistTemplateItem.order_index")


class ChecklistTemplateItem(Base):
    __tablename__ = "checklist_template_items"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("checklist_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index = Column(Integer, default=0, nullable=False)
    item_text = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_required = Column(Boolean, default=True, nullable=False)

    template = relationship("ChecklistTemplate", back_populates="items")


class WorkOrderChecklist(Base):
    __tablename__ = "work_order_checklists"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    template_id = Column(Integer, ForeignKey("checklist_templates.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(150), nullable=False)
    summary_notes = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    work_order = relationship("WorkOrder", back_populates="checklist")
    template = relationship("ChecklistTemplate")
    items = relationship("WorkOrderChecklistItem", back_populates="checklist", cascade="all, delete-orphan", order_by="WorkOrderChecklistItem.order_index")


class WorkOrderChecklistItem(Base):
    __tablename__ = "work_order_checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("work_order_checklists.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index = Column(Integer, default=0, nullable=False)
    item_text = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_required = Column(Boolean, default=True, nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, PASS, FAIL, NOT_APPLICABLE
    notes = Column(Text, nullable=True)
    inspected_at = Column(DateTime(timezone=True), nullable=True)
    inspected_by = Column(String(100), nullable=True)
    attachment_path = Column(String(255), nullable=True)
    attachment_filename = Column(String(255), nullable=True)
    attachment_content_type = Column(String(100), nullable=True)
    attachment_file_size = Column(Integer, nullable=True)

    checklist = relationship("WorkOrderChecklist", back_populates="items")
