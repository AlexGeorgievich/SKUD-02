"""Add responsibility notes to HR employee profiles."""

from alembic import op
import sqlalchemy as sa


revision = "0004_hr_responsibility"
down_revision = "0003_hr_profile_fields"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    if "responsibility" not in columns:
        op.add_column("hr_employees", sa.Column("responsibility", sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    if "responsibility" in columns:
        op.drop_column("hr_employees", "responsibility")
