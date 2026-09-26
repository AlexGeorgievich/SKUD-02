"""Versioned monthly UWR sources.

Revision ID: 0009_uwr_period_history
Revises: 0008_kus_catalogs
"""
from alembic import op
import sqlalchemy as sa

revision='0009_uwr_period_history';down_revision='0008_kus_catalogs';branch_labels=None;depends_on=None

def upgrade():
 op.create_table('uvr_periods',sa.Column('period',sa.String(7),primary_key=True),sa.Column('closed',sa.Boolean(),nullable=False,server_default=sa.false()),sa.Column('closed_at',sa.DateTime(timezone=True)),sa.Column('closed_by',sa.String(120)),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
 op.create_table('uvr_source_versions',sa.Column('id',sa.String(36),primary_key=True),sa.Column('period',sa.String(7),sa.ForeignKey('uvr_periods.period'),nullable=False),sa.Column('kind',sa.String(16),nullable=False),sa.Column('version',sa.Integer(),nullable=False),sa.Column('content_hash',sa.String(64),nullable=False),sa.Column('blob',sa.LargeBinary(),nullable=False),sa.Column('author',sa.String(120),nullable=False),sa.Column('reason',sa.Text()),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.UniqueConstraint('period','kind','version'),sa.UniqueConstraint('period','kind','content_hash'))
 op.create_index('ix_uvr_source_versions_period','uvr_source_versions',['period']);op.create_index('ix_uvr_source_versions_kind','uvr_source_versions',['kind'])
 op.create_table('uvr_source_rows',sa.Column('id',sa.String(36),primary_key=True),sa.Column('source_version_id',sa.String(36),sa.ForeignKey('uvr_source_versions.id'),nullable=False),sa.Column('row_number',sa.Integer(),nullable=False),sa.Column('employee_id',sa.String(36),nullable=False),sa.Column('source_name',sa.String(255),nullable=False),sa.Column('source_department',sa.String(255)),sa.Column('values',sa.JSON()))
 op.create_index('ix_uvr_source_rows_source_version_id','uvr_source_rows',['source_version_id']);op.create_index('ix_uvr_source_rows_employee_id','uvr_source_rows',['employee_id'])
 op.create_table('uvr_calculation_versions',sa.Column('id',sa.String(36),primary_key=True),sa.Column('period',sa.String(7),sa.ForeignKey('uvr_periods.period'),nullable=False),sa.Column('version',sa.Integer(),nullable=False),sa.Column('source_versions',sa.JSON(),nullable=False),sa.Column('result',sa.JSON(),nullable=False),sa.Column('author',sa.String(120),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
 op.create_index('ix_uvr_calculation_versions_period','uvr_calculation_versions',['period'])

def downgrade():
 raise RuntimeError('Downgrade monthly history only from a verified backup')
