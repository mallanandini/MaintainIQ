"""Create digital inspection checklist tables

Revision ID: 005_inspection_checklists
Revises: 004_asset_health_metrics
Create Date: 2026-10-13 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '005_inspection_checklists'
down_revision = '004_asset_health_metrics'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Checklist Templates
    op.create_table(
        'checklist_templates',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('asset_category', sa.String(100), nullable=True, index=True),
        sa.Column('maintenance_type_id', sa.Integer(), sa.ForeignKey('maintenance_types.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # 2. Checklist Template Items
    op.create_table(
        'checklist_template_items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('template_id', sa.Integer(), sa.ForeignKey('checklist_templates.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('order_index', sa.Integer(), default=0, nullable=False),
        sa.Column('item_text', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_required', sa.Boolean(), default=True, nullable=False),
    )

    # 3. Work Order Checklists (Instances associated with Work Orders)
    op.create_table(
        'work_order_checklists',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('work_order_id', sa.Integer(), sa.ForeignKey('work_orders.id', ondelete='CASCADE'), nullable=False, unique=True, index=True),
        sa.Column('template_id', sa.Integer(), sa.ForeignKey('checklist_templates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('summary_notes', sa.Text(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # 4. Work Order Checklist Items (Snapshotted response rows)
    op.create_table(
        'work_order_checklist_items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('checklist_id', sa.Integer(), sa.ForeignKey('work_order_checklists.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('order_index', sa.Integer(), default=0, nullable=False),
        sa.Column('item_text', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_required', sa.Boolean(), default=True, nullable=False),
        sa.Column('status', sa.String(20), default='PENDING', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('inspected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('inspected_by', sa.String(100), nullable=True),
        sa.Column('attachment_path', sa.String(255), nullable=True),
        sa.Column('attachment_filename', sa.String(255), nullable=True),
        sa.Column('attachment_content_type', sa.String(100), nullable=True),
        sa.Column('attachment_file_size', sa.Integer(), nullable=True),
    )

def downgrade() -> None:
    op.drop_table('work_order_checklist_items')
    op.drop_table('work_order_checklists')
    op.drop_table('checklist_template_items')
    op.drop_table('checklist_templates')
