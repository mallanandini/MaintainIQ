"""Add usage and service threshold metrics to assets for risk monitoring

Revision ID: 004_asset_health_metrics
Revises: 003_analytics_indexes
Create Date: 2026-10-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '004_asset_health_metrics'
down_revision = '003_analytics_indexes'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('assets', sa.Column('operating_hours', sa.Float(), nullable=True))
    op.add_column('assets', sa.Column('operating_cycles', sa.Integer(), nullable=True))
    op.add_column('assets', sa.Column('service_threshold_hours', sa.Float(), nullable=True))
    op.add_column('assets', sa.Column('service_threshold_cycles', sa.Integer(), nullable=True))

def downgrade() -> None:
    op.drop_column('assets', 'service_threshold_cycles')
    op.drop_column('assets', 'service_threshold_hours')
    op.drop_column('assets', 'operating_cycles')
    op.drop_column('assets', 'operating_hours')
