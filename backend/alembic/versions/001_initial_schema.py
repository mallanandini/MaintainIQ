"""Initial database schema for MaintainIQ

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. assets table
    op.create_table(
        'assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_tag', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('serial_number', sa.String(length=100), nullable=True),
        sa.Column('manufacturer', sa.String(length=100), nullable=True),
        sa.Column('model_number', sa.String(length=100), nullable=True),
        sa.Column('criticality', sa.String(length=20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('asset_tag')
    )
    op.create_index(op.f('ix_assets_asset_tag'), 'assets', ['asset_tag'], unique=True)
    op.create_index(op.f('ix_assets_id'), 'assets', ['id'], unique=False)
    op.create_index(op.f('ix_assets_name'), 'assets', ['name'], unique=False)
    op.create_index(op.f('ix_assets_status'), 'assets', ['status'], unique=False)

    # 2. technicians table
    op.create_table(
        'technicians',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('specialization', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('hourly_rate', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('employee_id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_technicians_employee_id'), 'technicians', ['employee_id'], unique=True)
    op.create_index(op.f('ix_technicians_email'), 'technicians', ['email'], unique=True)
    op.create_index(op.f('ix_technicians_id'), 'technicians', ['id'], unique=False)

    # 3. maintenance_types table
    op.create_table(
        'maintenance_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_emergency', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_maintenance_types_code'), 'maintenance_types', ['code'], unique=True)

    # 4. work_orders table
    op.create_table(
        'work_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_order_number', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('maintenance_type_id', sa.Integer(), nullable=False),
        sa.Column('assigned_technician_id', sa.Integer(), nullable=True),
        sa.Column('priority', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('scheduled_date', sa.DateTime(), nullable=False),
        sa.Column('estimated_hours', sa.Float(), nullable=False),
        sa.Column('actual_hours', sa.Float(), nullable=True),
        sa.Column('resolution_summary', sa.Text(), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['maintenance_type_id'], ['maintenance_types.id']),
        sa.ForeignKeyConstraint(['assigned_technician_id'], ['technicians.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('work_order_number')
    )
    op.create_index(op.f('ix_work_orders_work_order_number'), 'work_orders', ['work_order_number'], unique=True)
    op.create_index(op.f('ix_work_orders_asset_id'), 'work_orders', ['asset_id'], unique=False)
    op.create_index(op.f('ix_work_orders_assigned_technician_id'), 'work_orders', ['assigned_technician_id'], unique=False)
    op.create_index(op.f('ix_work_orders_status'), 'work_orders', ['status'], unique=False)
    op.create_index(op.f('ix_work_orders_priority'), 'work_orders', ['priority'], unique=False)

    # 5. work_order_status_history table
    op.create_table(
        'work_order_status_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_order_id', sa.Integer(), nullable=False),
        sa.Column('from_status', sa.String(length=20), nullable=True),
        sa.Column('to_status', sa.String(length=20), nullable=False),
        sa.Column('changed_by', sa.String(length=100), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_work_order_status_history_work_order_id'), 'work_order_status_history', ['work_order_id'], unique=False)
    op.create_index(op.f('ix_work_order_status_history_created_at'), 'work_order_status_history', ['created_at'], unique=False)

def downgrade() -> None:
    op.drop_table('work_order_status_history')
    op.drop_table('work_orders')
    op.drop_table('maintenance_types')
    op.drop_table('technicians')
    op.drop_table('assets')
