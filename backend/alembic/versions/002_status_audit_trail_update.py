"""Update work order status history to allow nullable changed_by actor

Revision ID: 002_status_audit_trail_update
Revises: 001_initial_schema
Create Date: 2026-10-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '002_status_audit_trail_update'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table('work_order_status_history') as batch_op:
        batch_op.alter_column(
            'changed_by',
            existing_type=sa.String(length=100),
            nullable=True
        )

def downgrade() -> None:
    with op.batch_alter_table('work_order_status_history') as batch_op:
        batch_op.alter_column(
            'changed_by',
            existing_type=sa.String(length=100),
            nullable=False
        )
