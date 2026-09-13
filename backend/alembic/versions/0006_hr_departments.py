"""Add HR department registry."""

from alembic import op
import sqlalchemy as sa


revision = "0006_hr_departments"
down_revision = "0005_hr_profile_months"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "hr_departments" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "hr_departments",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False, unique=True),
            sa.Column("head_id", sa.String(length=36), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_hr_departments_name", "hr_departments", ["name"])


def downgrade():
    bind = op.get_bind()
    if "hr_departments" in sa.inspect(bind).get_table_names():
        op.drop_index("ix_hr_departments_name", table_name="hr_departments")
        op.drop_table("hr_departments")
