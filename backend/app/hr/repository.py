from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from .models import HrAuditLog, HrEmployee, HrPlanSync


SAFE_FIELDS = {
    "personnel_number", "position", "schedule_type", "schedule_hours",
    "employment_status", "work_email", "work_phone", "access_card_number",
    "access_card_status", "access_level", "work_zones",
}


class HrRepository:
    def __init__(self, engine_or_url):
        self.engine = create_engine(engine_or_url) if isinstance(engine_or_url, str) else engine_or_url
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    def upsert_plan_employee(self, plan_id: str, name: str, department: str, period: str) -> HrEmployee:
        with self.sessions.begin() as session:
            employee = session.scalar(select(HrEmployee).where(HrEmployee.plan_employee_id == plan_id))
            if employee is None:
                employee = HrEmployee(plan_employee_id=plan_id, plan_name=name, plan_department=department)
                session.add(employee)
                session.flush()
            else:
                employee.plan_name = name
                employee.plan_department = department
            employee.plan_period = period
            employee.in_current_plan = True
            session.add(HrPlanSync(employee_id=employee.id, plan_employee_id=plan_id, plan_period=period, source_name=name, source_department=department))
            return employee

    def get_employee(self, employee_id: str) -> HrEmployee | None:
        with self.sessions() as session:
            return session.get(HrEmployee, employee_id) or session.scalar(select(HrEmployee).where(HrEmployee.plan_employee_id == employee_id))

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
            session.add(HrAuditLog(author=author, action=action, object_type=object_type, object_id=object_id, changed_fields=changed_fields, source=source))

    def mark_not_in_plan(self, plan_ids: set[str]) -> None:
        with self.sessions.begin() as session:
            employees = session.scalars(select(HrEmployee)).all()
            for employee in employees:
                employee.in_current_plan = employee.plan_employee_id in plan_ids
