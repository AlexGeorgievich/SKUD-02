"""Store the selected month together with HR profile years."""

from alembic import op
import sqlalchemy as sa


revision = "0005_hr_profile_months"
down_revision = "0004_hr_responsibility"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    if "birth_month" not in columns:
        op.add_column("hr_employees", sa.Column("birth_month", sa.String(length=7), nullable=True))
    if "education_graduation_month" not in columns:
        op.add_column("hr_employees", sa.Column("education_graduation_month", sa.String(length=7), nullable=True))


def downgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    if "education_graduation_month" in columns:
        op.drop_column("hr_employees", "education_graduation_month")
    if "birth_month" in columns:
        op.drop_column("hr_employees", "birth_month")
