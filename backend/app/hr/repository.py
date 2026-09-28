from datetime import date
from uuid import uuid4
from json import dumps, loads

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from .models import HrAuditLog, HrBootstrapState, HrCatalogValue, HrDepartment, HrEmployee, HrImportBatch, HrLegalEntity, HrOffice, HrPlanSync, utcnow


SAFE_FIELDS = {
    "plan_name", "family_name", "given_name", "patronymic", "department", "department_id", "office", "office_id",
    "legal_entity_id", "gender_id", "work_format_id", "position_id", "department_status", "gender", "birth_year", "birth_month", "birth_date", "birth_place", "hire_date",
    "work_schedule", "department_head_id", "deputy_id", "deputy_from", "deputy_until",
    "education_institution", "education_specialty", "education_graduation_year", "education_graduation_month", "education_graduation_date", "work_experience",
    "personnel_number", "position", "position_en", "schedule_type", "schedule_hours",
    "employment_status", "employment_type", "probation_end_date", "comments", "responsibility", "work_email", "work_phone", "access_card_number",
    "access_card_status", "access_level", "work_zones", "telegram", "personal_phone", "business_card",
    "academic_degree", "recommendation", "recruiter", "photo_source_url", "mail_image_url", "insurance",
}


class HrRepository:
    def __init__(self, engine_or_url):
        if isinstance(engine_or_url, str):
            kwargs = {}
            if engine_or_url.startswith("sqlite") and ":memory:" in engine_or_url:
                kwargs = {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
            self.engine = create_engine(engine_or_url, **kwargs)
        else:
            self.engine = engine_or_url
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    def upsert_plan_employee(self, plan_id: str, name: str, department: str, period: str) -> HrEmployee:
        with self.sessions.begin() as session:
            employee = session.scalar(select(HrEmployee).where(HrEmployee.plan_employee_id == plan_id))
            if employee is None:
                employee = HrEmployee(plan_employee_id=plan_id, plan_name=name, plan_department=department, department=department)
                session.add(employee)
                session.flush()
            else:
                employee.plan_name = name
                employee.plan_department = department
            employee.plan_period = period
            employee.in_current_plan = True
            session.add(HrPlanSync(employee_id=employee.id, plan_employee_id=plan_id, plan_period=period, source_name=name, source_department=department))
            return employee

    def create_from_initial_plan(self, plan_id: str, name: str, department: str, period: str) -> HrEmployee:
        with self.sessions.begin() as session:
            employee = HrEmployee(
                plan_employee_id=plan_id,
                plan_name=name,
                plan_department=department,
                department=department,
                plan_period=period,
            )
            session.add(employee)
            session.flush()
            return employee

    def create_manual_employee(self, name: str, department: str, values: dict | None = None) -> HrEmployee:
        with self.sessions.begin() as session:
            employee = HrEmployee(
                plan_employee_id=f"manual:{uuid4()}",
                plan_name=name,
                plan_department=department,
                department=department,
                in_current_plan=False,
            )
            for key, value in (values or {}).items():
                if key in SAFE_FIELDS and key not in {"plan_name", "department"}:
                    setattr(employee, key, value)
            session.add(employee)
            session.flush()
            return employee

    def catalog_items(self) -> dict[str, list]:
        with self.sessions() as session:
            values = list(session.scalars(select(HrCatalogValue).order_by(HrCatalogValue.kind, HrCatalogValue.label)))
            return {
                "offices": list(session.scalars(select(HrOffice).order_by(HrOffice.name))),
                "departments": list(session.scalars(select(HrDepartment).order_by(HrDepartment.name))),
                "legal_entities": list(session.scalars(select(HrLegalEntity).order_by(HrLegalEntity.name))),
                "values": values,
                "positions": [item for item in values if item.kind == "position"],
            }

    def create_import_batch(self, author: str, diagnostics: dict, error_count: int) -> HrImportBatch:
        with self.sessions.begin() as session:
            batch = HrImportBatch(author=author, status="invalid" if error_count else "preview", error_count=error_count, diagnostics=diagnostics)
            session.add(batch)
            session.flush()
            return batch

    def get_import_batch(self, batch_id: str) -> HrImportBatch | None:
        with self.sessions() as session:
            return session.get(HrImportBatch, batch_id)

    def apply_import_batch(self, batch_id: str, confirm_archive_ids: set[str]) -> dict:
        with self.sessions.begin() as session:
            batch = session.get(HrImportBatch, batch_id)
            if batch is None:
                raise KeyError(batch_id)
            if batch.status == "applied":
                return {"created": batch.created_count, "updated": batch.updated_count, "archived": 0, "status": "already_applied"}
            if batch.error_count:
                raise ValueError("Импорт содержит ошибки; исправьте файл и повторите preview")
            payload = batch.diagnostics or {}
            required_archives = set(payload.get("archive_candidates", []))
            if required_archives - confirm_archive_ids:
                raise ValueError("Подтвердите архивирование отсутствующих в полном файле сотрудников")

            def catalog(model, name: str | None, kind: str | None = None):
                if not name:
                    return None
                statement = select(model).where(model.name == name) if hasattr(model, "name") else select(model).where(model.kind == kind, model.label == name)
                item = session.scalar(statement)
                if item is None:
                    item = model(name=name) if hasattr(model, "name") else model(kind=kind, label=name)
                    session.add(item)
                    session.flush()
                return item

            created = updated = archived = 0
            for row in payload.get("rows", []):
                values = dict(row["values"])
                for field in ("hire_date", "probation_end_date", "birth_date"):
                    if values.get(field):
                        values[field] = date.fromisoformat(values[field])
                department = catalog(HrDepartment, values.pop("department", None))
                legal_entity = catalog(HrLegalEntity, values.pop("legal_entity", None))
                gender = catalog(HrCatalogValue, values.pop("gender_label", None), "gender")
                work_format = catalog(HrCatalogValue, values.pop("work_format", None), "work_format")
                position = catalog(HrCatalogValue, values.get("position"), "position")
                if department:
                    values.update(department_id=department.id, department=department.name)
                if legal_entity:
                    values["legal_entity_id"] = legal_entity.id
                if gender:
                    values.update(gender_id=gender.id, gender=gender.label)
                if work_format:
                    values["work_format_id"] = work_format.id
                if position:
                    values["position_id"] = position.id
                employee = session.get(HrEmployee, row.get("employee_id")) if row.get("employee_id") else None
                if employee is None:
                    employee = HrEmployee(
                        plan_employee_id=f"manual:{uuid4()}", plan_name=values["plan_name"],
                        plan_department=values.get("department") or "", department=values.get("department"),
                        in_current_plan=False,
                    )
                    session.add(employee)
                    created += 1
                else:
                    updated += 1
                for key, value in values.items():
                    if key in SAFE_FIELDS:
                        setattr(employee, key, value)
            for employee_id in required_archives:
                employee = session.get(HrEmployee, employee_id)
                if employee is not None and employee.archived_at is None:
                    employee.archived_at = utcnow()
                    employee.archived_by = batch.author
                    archived += 1
            batch.status = "applied"
            batch.created_count = created
            batch.updated_count = updated
            return {"created": created, "updated": updated, "archived": archived, "status": "applied"}

    def export_employee_rows(self) -> list[dict]:
        with self.sessions() as session:
            rows = []
            for employee in session.scalars(select(HrEmployee).where(HrEmployee.archived_at.is_(None)).order_by(HrEmployee.department, HrEmployee.plan_name)):
                item = {column.name: getattr(employee, column.name) for column in employee.__table__.columns}
                if employee.legal_entity_id:
                    entity = session.get(HrLegalEntity, employee.legal_entity_id)
                    item["legal_entity"] = entity.name if entity else None
                if employee.work_format_id:
                    value = session.get(HrCatalogValue, employee.work_format_id)
                    item["work_format"] = value.label if value else None
                if employee.position_id:
                    value = session.get(HrCatalogValue, employee.position_id)
                    item["position"] = value.label if value and value.kind == "position" else employee.position
                rows.append(item)
            return rows

    def validate_card_values(self, values: dict, employee_id: str | None = None) -> dict:
        checked = dict(values)
        with self.sessions() as session:
            references = {
                "office_id": HrOffice, "department_id": HrDepartment,
                "legal_entity_id": HrLegalEntity, "gender_id": HrCatalogValue,
                "work_format_id": HrCatalogValue, "position_id": HrCatalogValue,
            }
            objects = {}
            for field, model in references.items():
                identifier = checked.get(field)
                if identifier:
                    item = session.get(model, identifier)
                    if item is None:
                        raise ValueError(f"Неизвестное значение справочника: {field}")
                    objects[field] = item
            if "gender_id" in objects and objects["gender_id"].kind != "gender":
                raise ValueError("Неверное значение пола")
            if "gender_id" in objects and objects["gender_id"].label not in {"Мужской", "Женский"}:
                raise ValueError("Пол должен быть выбран из значений Мужской или Женский")
            if "work_format_id" in objects and objects["work_format_id"].kind != "work_format":
                raise ValueError("Неверный формат работы")
            if "work_format_id" in objects and objects["work_format_id"].label not in {"Фиксированный", "Свободный", "Гибкий"}:
                raise ValueError("Неверный формат работы")
            if "position_id" in objects and objects["position_id"].kind != "position":
                raise ValueError("Неверная должность")
            if "position_id" in objects:
                checked["position"] = objects["position_id"].label
            department = objects.get("department_id")
            office = objects.get("office_id")
            if department and office and department.office_id and department.office_id != office.id:
                raise ValueError("Отдел не относится к выбранному офису")
            if department:
                checked["department"] = department.name
                if department.office_id and not office:
                    office = session.get(HrOffice, department.office_id)
                    checked["office_id"] = department.office_id
            if office:
                checked["office"] = office.name
            number = checked.get("personnel_number")
            if number and session.scalar(select(HrEmployee.id).where(
                HrEmployee.personnel_number == number,
                HrEmployee.id != employee_id if employee_id else HrEmployee.id.is_not(None),
            ).limit(1)):
                raise ValueError("Табельный номер уже назначен другому сотруднику")
            for field, message in (
                ("department_head_id", "Руководитель"),
                ("deputy_id", "Заместитель"),
            ):
                related_id = checked.get(field)
                if not related_id:
                    continue
                head = session.get(HrEmployee, related_id)
                department_name = checked.get("department")
                if head is None or head.archived_at is not None or (department_name and head.department != department_name):
                    raise ValueError(f"{message} должен быть действующим сотрудником выбранного отдела")
        return checked

    def is_bootstrap_complete(self) -> bool:
        with self.sessions() as session:
            return session.get(HrBootstrapState, "plan_initial_load") is not None

    def has_employees(self) -> bool:
        with self.sessions() as session:
            return session.scalar(select(HrEmployee.id).limit(1)) is not None

    def mark_bootstrap_complete(self, author: str, period: str) -> None:
        with self.sessions.begin() as session:
            if session.get(HrBootstrapState, "plan_initial_load") is None:
                session.add(HrBootstrapState(
                    key="plan_initial_load", completed_by=author, source_period=period,
                ))

    def get_employee(self, employee_id: str, include_archived: bool = False) -> HrEmployee | None:
        with self.sessions() as session:
            statement = select(HrEmployee).where((HrEmployee.id == employee_id) | (HrEmployee.plan_employee_id == employee_id))
            if not include_archived:
                statement = statement.where(HrEmployee.archived_at.is_(None))
            return session.scalar(statement)

    def get_employee_by_name(self, name: str, include_archived: bool = False) -> HrEmployee | None:
        normalized = name.strip().casefold()
        if not normalized:
            return None
        with self.sessions() as session:
            employees = session.scalars(select(HrEmployee)).all()
            return next((employee for employee in employees if employee.plan_name.strip().casefold() == normalized and (include_archived or employee.archived_at is None)), None)

    def get_active_employee(self, employee_id: str) -> HrEmployee | None:
        return self.get_employee(employee_id, include_archived=False)

    def list_employees(self, archived: bool = False) -> list[HrEmployee]:
        with self.sessions() as session:
            archive_filter = HrEmployee.archived_at.is_not(None) if archived else HrEmployee.archived_at.is_(None)
            statement = select(HrEmployee).where(archive_filter).order_by(HrEmployee.department, HrEmployee.plan_name)
            return list(session.scalars(statement).all())

    def list_departments(self) -> list[HrDepartment]:
        with self.sessions() as session:
            return list(session.scalars(select(HrDepartment).order_by(HrDepartment.name)).all())

    def create_department(self, name: str, head_id: str | None = None) -> HrDepartment:
        with self.sessions.begin() as session:
            department = HrDepartment(name=name.strip(), head_id=head_id)
            session.add(department)
            session.flush()
            return department

    def archive_employee(self, employee_id: str, author: str) -> HrEmployee:
        with self.sessions.begin() as session:
            employee = session.get(HrEmployee, employee_id)
            if employee is None:
                raise KeyError(employee_id)
            employee.archived_at = utcnow()
            employee.archived_by = author
            return employee

    def restore_employee(self, employee_id: str) -> HrEmployee:
        with self.sessions.begin() as session:
            employee = session.get(HrEmployee, employee_id)
            if employee is None:
                raise KeyError(employee_id)
            employee.archived_at = None
            employee.archived_by = None
            return employee

    def update_safe_fields(self, employee_id: str, values: dict) -> HrEmployee:
        invalid = set(values) - SAFE_FIELDS
        if invalid:
            raise ValueError(f"Unsupported HR fields: {', '.join(sorted(invalid))}")
        with self.sessions.begin() as session:
            employee = session.get(HrEmployee, employee_id)
            if employee is None:
                raise KeyError(employee_id)
            for key, value in values.items():
                setattr(employee, key, value)
            return employee

    def set_photo_path(self, employee_id: str, name: str) -> None:
        with self.sessions.begin() as session:
            employee = session.get(HrEmployee, employee_id)
            if employee is None:
                raise KeyError(employee_id)
            employee.photo_path = name

    def add_audit(self, author: str, action: str, object_type: str, object_id: str, changed_fields: dict | None, source: str) -> None:
        with self.sessions.begin() as session:
            safe_fields = loads(dumps(changed_fields, default=str)) if changed_fields is not None else None
            session.add(HrAuditLog(author=author, action=action, object_type=object_type, object_id=object_id, changed_fields=safe_fields, source=source))

    def mark_not_in_plan(self, plan_ids: set[str]) -> None:
        with self.sessions.begin() as session:
            employees = session.scalars(select(HrEmployee)).all()
            for employee in employees:
                employee.in_current_plan = employee.plan_employee_id in plan_ids
