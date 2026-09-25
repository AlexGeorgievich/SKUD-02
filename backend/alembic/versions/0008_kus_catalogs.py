"""Add KUS dictionaries and structured personnel fields without replacing cards."""

from datetime import datetime, timezone
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "0008_kus_catalogs"
down_revision = "0007_hr_profile_full_dates"
branch_labels = None
depends_on = None


EMPLOYEE_COLUMNS = (
    ("family_name", sa.String(120)),
    ("given_name", sa.String(120)),
    ("patronymic", sa.String(120)),
    ("office_id", sa.String(36)),
    ("department_id", sa.String(36)),
    ("legal_entity_id", sa.String(36)),
    ("gender_id", sa.String(36)),
    ("work_format_id", sa.String(36)),
    ("position_en", sa.String(255)),
    ("telegram", sa.String(255)),
    ("personal_phone", sa.String(64)),
    ("business_card", sa.String(255)),
    ("academic_degree", sa.String(255)),
    ("recommendation", sa.Text()),
    ("recruiter", sa.String(255)),
    ("photo_source_url", sa.String(1024)),
    ("mail_image_url", sa.String(1024)),
    ("photo_path", sa.String(512)),
    ("insurance", sa.String(255)),
)


def _existing_columns(bind, table):
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _catalog_id(bind, table, name, cache, *, kind=None):
    label = str(name or "").strip()
    if not label:
        return None
    key = (kind or table, label.casefold())
    if key in cache:
        return cache[key]
    statement = (
        sa.text("SELECT id FROM hr_catalog_values WHERE kind=:kind AND label=:label")
        if kind else sa.text(f"SELECT id FROM {table} WHERE name=:label")
    )
    params = {"label": label, "kind": kind} if kind else {"label": label}
    found = bind.execute(statement, params).scalar()
    if found is None:
        found = str(uuid4())
        if kind:
            bind.execute(
                sa.text("INSERT INTO hr_catalog_values (id,kind,label,created_at) VALUES (:id,:kind,:label,:now)"),
                {"id": found, "kind": kind, "label": label, "now": datetime.now(timezone.utc)},
            )
        else:
            bind.execute(
                sa.text(f"INSERT INTO {table} (id,name,created_at) VALUES (:id,:label,:now)"),
                {"id": found, "label": label, "now": datetime.now(timezone.utc)},
            )
    cache[key] = found
    return found


def upgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "hr_offices" not in tables:
        op.create_table(
            "hr_offices",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    if "hr_legal_entities" not in tables:
        op.create_table(
            "hr_legal_entities",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    if "hr_catalog_values" not in tables:
        op.create_table(
            "hr_catalog_values",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("kind", sa.String(32), nullable=False),
            sa.Column("label", sa.String(255), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("kind", "label", name="uq_hr_catalog_kind_label"),
        )

    employee_columns = _existing_columns(bind, "hr_employees")
    for name, column_type in EMPLOYEE_COLUMNS:
        if name not in employee_columns:
            op.add_column("hr_employees", sa.Column(name, column_type, nullable=True))
    if "office_id" not in _existing_columns(bind, "hr_departments"):
        op.add_column("hr_departments", sa.Column("office_id", sa.String(36), nullable=True))

    existing_departments = {
        row.name.casefold(): row.id
        for row in bind.execute(sa.text("SELECT id,name FROM hr_departments"))
    }
    cache = {}
    rows = bind.execute(sa.text(
        "SELECT id,plan_name,office,department,plan_department,gender FROM hr_employees"
    )).mappings().all()
    for row in rows:
        office_id = _catalog_id(bind, "hr_offices", row["office"], cache)
        department = str(row["department"] or row["plan_department"] or "").strip()
        department_id = existing_departments.get(department.casefold()) if department else None
        if department and department_id is None:
            department_id = str(uuid4())
            now = datetime.now(timezone.utc)
            bind.execute(sa.text(
                "INSERT INTO hr_departments (id,name,office_id,created_at,updated_at) "
                "VALUES (:id,:name,:office_id,:now,:now)"
            ), {"id": department_id, "name": department, "office_id": office_id, "now": now})
            existing_departments[department.casefold()] = department_id
        elif department_id and office_id:
            bind.execute(sa.text(
                "UPDATE hr_departments SET office_id=:office_id "
                "WHERE id=:id AND office_id IS NULL"
            ), {"id": department_id, "office_id": office_id})
        gender_id = _catalog_id(bind, "hr_catalog_values", row["gender"], cache, kind="gender")
        parts = str(row["plan_name"] or "").split()
        names = parts if len(parts) in (2, 3) else [None, None, None]
        bind.execute(sa.text(
            "UPDATE hr_employees SET office_id=:office_id,department_id=:department_id,"
            "gender_id=:gender_id,family_name=:family_name,given_name=:given_name,"
            "patronymic=:patronymic WHERE id=:id"
        ), {
            "id": row["id"], "office_id": office_id, "department_id": department_id,
            "gender_id": gender_id, "family_name": names[0], "given_name": names[1],
            "patronymic": names[2] if len(names) > 2 else None,
        })

    if bind.dialect.name == "postgresql":
        constraints = (
            ("hr_employees", "office_id", "hr_offices"),
            ("hr_employees", "department_id", "hr_departments"),
            ("hr_employees", "legal_entity_id", "hr_legal_entities"),
            ("hr_employees", "gender_id", "hr_catalog_values"),
            ("hr_employees", "work_format_id", "hr_catalog_values"),
            ("hr_departments", "office_id", "hr_offices"),
        )
        for table, column, target in constraints:
            name = f"fk_{table}_{column}"
            existing = {item["name"] for item in sa.inspect(bind).get_foreign_keys(table)}
            if name not in existing and not any(
                item["constrained_columns"] == [column]
                for item in sa.inspect(bind).get_foreign_keys(table)
            ):
                op.create_foreign_key(name, table, target, [column], ["id"])
    for table, column in (
        ("hr_employees", "office_id"), ("hr_employees", "department_id"),
        ("hr_employees", "legal_entity_id"), ("hr_departments", "office_id"),
    ):
        name = f"ix_{table}_{column}"
        if name not in {item["name"] for item in sa.inspect(bind).get_indexes(table)}:
            op.create_index(name, table, [column])


def downgrade():
    raise RuntimeError("KUS catalog migration is data-bearing; restore from a verified backup")
