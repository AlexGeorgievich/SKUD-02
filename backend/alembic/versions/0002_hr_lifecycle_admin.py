"""Add safe HR lifecycle fields without removing existing personnel data."""

from alembic import op
import sqlalchemy as sa


revision = "0002_hr_lifecycle_admin"
down_revision = "0001_hr_initial"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("hr_employees")}
    additions = (
        ("office", sa.Column("office", sa.String(length=255), nullable=True)),
        ("department", sa.Column("department", sa.String(length=255), nullable=True)),
        ("department_status", sa.Column("department_status", sa.String(length=64), nullable=True)),
        ("gender", sa.Column("gender", sa.String(length=16), nullable=True)),
        ("birth_year", sa.Column("birth_year", sa.Integer(), nullable=True)),
        ("hire_date", sa.Column("hire_date", sa.Date(), nullable=True)),
        ("work_schedule", sa.Column("work_schedule", sa.String(length=255), nullable=True)),
        ("department_head_id", sa.Column("department_head_id", sa.String(length=36), nullable=True)),
        ("deputy_id", sa.Column("deputy_id", sa.String(length=36), nullable=True)),
        ("deputy_from", sa.Column("deputy_from", sa.Date(), nullable=True)),
        ("deputy_until", sa.Column("deputy_until", sa.Date(), nullable=True)),
        ("archived_at", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True)),
        ("archived_by", sa.Column("archived_by", sa.String(length=120), nullable=True)),
    )
    for name, column in additions:
        if name not in columns:
            op.add_column("hr_employees", column)
    inspector = sa.inspect(bind)
    if "hr_bootstrap_state" not in inspector.get_table_names():
        op.create_table(
            "hr_bootstrap_state",
            sa.Column("key", sa.String(length=64), primary_key=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_by", sa.String(length=120), nullable=False),
            sa.Column("source_period", sa.String(length=20), nullable=False),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "hr_bootstrap_state" in inspector.get_table_names():
        op.drop_table("hr_bootstrap_state")
    existing = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    for name in ("archived_by", "archived_at", "deputy_until", "deputy_from", "deputy_id", "department_head_id", "work_schedule", "hire_date", "birth_year", "gender", "department_status", "department", "office"):
        if name in existing:
            op.drop_column("hr_employees", name)
