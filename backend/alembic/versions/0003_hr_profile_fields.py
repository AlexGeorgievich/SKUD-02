"""Add education, employment type, schedule and comments to HR profiles."""

from alembic import op
import sqlalchemy as sa


revision = "0003_hr_profile_fields"
down_revision = "0002_hr_lifecycle_admin"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    additions = (
        ("education_institution", sa.Column("education_institution", sa.String(length=255), nullable=True)),
        ("education_specialty", sa.Column("education_specialty", sa.String(length=255), nullable=True)),
        ("education_graduation_year", sa.Column("education_graduation_year", sa.Integer(), nullable=True)),
        ("work_experience", sa.Column("work_experience", sa.String(length=128), nullable=True)),
        ("employment_type", sa.Column("employment_type", sa.String(length=32), nullable=True)),
        ("probation_end_date", sa.Column("probation_end_date", sa.Date(), nullable=True)),
        ("comments", sa.Column("comments", sa.Text(), nullable=True)),
    )
    for name, column in additions:
        if name not in existing:
            op.add_column("hr_employees", column)


def downgrade():
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    for name in ("comments", "probation_end_date", "employment_type", "work_experience", "education_graduation_year", "education_specialty", "education_institution"):
        if name in existing:
            op.drop_column("hr_employees", name)
