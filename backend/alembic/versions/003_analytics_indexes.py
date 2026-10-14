"""Add composite indexes for maintenance analytics query patterns

Revision ID: 003_analytics_indexes
Revises: 002_status_audit_trail_update
Create Date: 2026-10-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '003_analytics_indexes'
down_revision = '002_status_audit_trail_update'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Composite index for overdue filtering: status in (...) and scheduled_date < ...
    op.create_index(
        'ix_work_orders_status_scheduled_date',
        'work_orders',
        ['status', 'scheduled_date']
    )

    # 2. Composite index for technician active workload queries: assigned_technician_id and status
    op.create_index(
        'ix_work_orders_tech_status',
        'work_orders',
        ['assigned_technician_id', 'status']
    )

    # 3. Composite index for completion trend queries: to_status and created_at
    op.create_index(
        'ix_wosh_to_status_created_at',
        'work_order_status_history',
        ['to_status', 'created_at']
    )

def downgrade() -> None:
    op.drop_index('ix_wosh_to_status_created_at', table_name='work_order_status_history')
    op.drop_index('ix_work_orders_tech_status', table_name='work_orders')
    op.drop_index('ix_work_orders_status_scheduled_date', table_name='work_orders')
