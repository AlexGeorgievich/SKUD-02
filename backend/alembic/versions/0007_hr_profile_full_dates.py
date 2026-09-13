"""Store complete HR birth and graduation dates."""

from alembic import op
import sqlalchemy as sa


revision = "0007_hr_profile_full_dates"
down_revision = "0006_hr_departments"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    if "birth_date" not in columns:
        op.add_column("hr_employees", sa.Column("birth_date", sa.Date(), nullable=True))
    if "education_graduation_date" not in columns:
        op.add_column("hr_employees", sa.Column("education_graduation_date", sa.Date(), nullable=True))
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute("UPDATE hr_employees SET birth_date = (birth_month || '-01')::date WHERE birth_date IS NULL AND birth_month IS NOT NULL")
        op.execute("UPDATE hr_employees SET education_graduation_date = (education_graduation_month || '-01')::date WHERE education_graduation_date IS NULL AND education_graduation_month IS NOT NULL")
    elif dialect == "sqlite":
        op.execute("UPDATE hr_employees SET birth_date = birth_month || '-01' WHERE birth_date IS NULL AND birth_month IS NOT NULL")
        op.execute("UPDATE hr_employees SET education_graduation_date = education_graduation_month || '-01' WHERE education_graduation_date IS NULL AND education_graduation_month IS NOT NULL")


def downgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    if "education_graduation_date" in columns:
        op.drop_column("hr_employees", "education_graduation_date")
    if "birth_date" in columns:
        op.drop_column("hr_employees", "birth_date")
