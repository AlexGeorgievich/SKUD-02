from uuid import uuid4
from json import dumps, loads

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from .models import HrAuditLog, HrBootstrapState, HrEmployee, HrPlanSync, utcnow


SAFE_FIELDS = {
    "plan_name", "department", "office", "department_status", "gender", "birth_year", "hire_date",
    "work_schedule", "department_head_id", "deputy_id", "deputy_from", "deputy_until",
    "personnel_number", "position", "schedule_type", "schedule_hours",
    "employment_status", "work_email", "work_phone", "access_card_number",
    "access_card_status", "access_level", "work_zones",
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

    def create_manual_employee(self, name: str, department: str) -> HrEmployee:
        with self.sessions.begin() as session:
            employee = HrEmployee(
                plan_employee_id=f"manual:{uuid4()}",
                plan_name=name,
                plan_department=department,
                department=department,
                in_current_plan=False,
            )
            session.add(employee)
            session.flush()
            return employee

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

    def get_active_employee(self, employee_id: str) -> HrEmployee | None:
        return self.get_employee(employee_id, include_archived=False)

    def list_employees(self, archived: bool = False) -> list[HrEmployee]:
        with self.sessions() as session:
            archive_filter = HrEmployee.archived_at.is_not(None) if archived else HrEmployee.archived_at.is_(None)
            statement = select(HrEmployee).where(archive_filter).order_by(HrEmployee.department, HrEmployee.plan_name)
            return list(session.scalars(statement).all())

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

    def add_audit(self, author: str, action: str, object_type: str, object_id: str, changed_fields: dict | None, source: str) -> None:
        with self.sessions.begin() as session:
            safe_fields = loads(dumps(changed_fields, default=str)) if changed_fields is not None else None
            session.add(HrAuditLog(author=author, action=action, object_type=object_type, object_id=object_id, changed_fields=safe_fields, source=source))

    def mark_not_in_plan(self, plan_ids: set[str]) -> None:
        with self.sessions.begin() as session:
            employees = session.scalars(select(HrEmployee)).all()
            for employee in employees:
                employee.in_current_plan = employee.plan_employee_id in plan_ids
