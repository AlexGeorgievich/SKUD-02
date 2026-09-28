"""Add KUS birth place and normalized position links.

Revision ID: 0010_kus_card_catalog_admin
Revises: 0009_uwr_period_history
"""

from datetime import datetime, timezone
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "0010_kus_card_catalog_admin"
down_revision = "0009_uwr_period_history"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    if "birth_place" not in columns:
        op.add_column("hr_employees", sa.Column("birth_place", sa.String(255), nullable=True))
    if "position_id" not in columns:
        op.add_column("hr_employees", sa.Column("position_id", sa.String(36), nullable=True))

    if bind.dialect.name == "postgresql":
        foreign_keys = sa.inspect(bind).get_foreign_keys("hr_employees")
        if not any(item["constrained_columns"] == ["position_id"] for item in foreign_keys):
            op.create_foreign_key(
                "fk_hr_employees_position_id", "hr_employees", "hr_catalog_values", ["position_id"], ["id"]
            )
    indexes = {item["name"] for item in sa.inspect(bind).get_indexes("hr_employees")}
    if "ix_hr_employees_position_id" not in indexes:
        op.create_index("ix_hr_employees_position_id", "hr_employees", ["position_id"])

    existing = {
        row.label.strip().casefold(): row.id
        for row in bind.execute(sa.text("SELECT id,label FROM hr_catalog_values WHERE kind='position'"))
        if row.label and row.label.strip()
    }
    rows = bind.execute(sa.text("SELECT id,position,position_id FROM hr_employees")).mappings().all()
    now = datetime.now(timezone.utc)
    for row in rows:
        label = str(row["position"] or "").strip()
        if not label or row["position_id"]:
            continue
        key = label.casefold()
        position_id = existing.get(key)
        if position_id is None:
            position_id = str(uuid4())
            bind.execute(
                sa.text("INSERT INTO hr_catalog_values (id,kind,label,created_at) VALUES (:id,'position',:label,:created_at)"),
                {"id": position_id, "label": label, "created_at": now},
            )
            existing[key] = position_id
        bind.execute(
            sa.text("UPDATE hr_employees SET position_id=:position_id WHERE id=:employee_id"),
            {"position_id": position_id, "employee_id": row["id"]},
        )


def downgrade():
    bind = op.get_bind()
    indexes = {item["name"] for item in sa.inspect(bind).get_indexes("hr_employees")}
    if "ix_hr_employees_position_id" in indexes:
        op.drop_index("ix_hr_employees_position_id", table_name="hr_employees")
    if bind.dialect.name == "postgresql":
        foreign_keys = {item["name"] for item in sa.inspect(bind).get_foreign_keys("hr_employees")}
        if "fk_hr_employees_position_id" in foreign_keys:
            op.drop_constraint("fk_hr_employees_position_id", "hr_employees", type_="foreignkey")
    columns = {column["name"] for column in sa.inspect(bind).get_columns("hr_employees")}
    if "position_id" in columns:
        op.drop_column("hr_employees", "position_id")
    if "birth_place" in columns:
        op.drop_column("hr_employees", "birth_place")
