from datetime import date

from .models import HrEmployee, HrImportBatch
from .repository import HrRepository, SAFE_FIELDS


class HrService:
    def __init__(self, repository: HrRepository):
        self.repository = repository

    def sync_plan_rows(self, rows: list[dict], period: str, author: str) -> dict:
        return self.bootstrap_from_plan(rows, period, author)

    def bootstrap_from_plan(self, rows: list[dict], period: str, author: str) -> dict:
        if self.repository.is_bootstrap_complete():
            return {"status": "skipped", "created": 0, "period": period}
        if self.repository.has_employees():
            self.repository.mark_bootstrap_complete(author, period)
            self.repository.add_audit(author, "initial_plan_bootstrap_skipped", "registry", period, {"reason": "existing_records"}, "plan")
            return {"status": "skipped", "created": 0, "period": period}
        created = 0
        for row in rows:
            plan_id = str(row.get("id") or row.get("normalized") or row["name"])
            self.repository.create_from_initial_plan(plan_id, row["name"], row["department"], period)
            created += 1
        self.repository.mark_bootstrap_complete(author, period)
        self.repository.add_audit(author, "initial_plan_bootstrap", "registry", period, {"created": created}, "plan")
        return {"status": "applied", "created": created, "period": period}

    def create_employee(self, values: dict, author: str) -> HrEmployee:
        name = str(values.get("plan_name") or "").strip()
        department = str(values.get("department") or "").strip()
        if not name or not department:
            raise ValueError("Для карточки сотрудника укажите ФИО и отдел")
        employee = self.repository.create_manual_employee(name, department)
        updates = self._normalize_values({key: value for key, value in values.items() if key in SAFE_FIELDS and key not in {"plan_name", "department"}})
        if updates:
            employee = self.repository.update_safe_fields(employee.id, updates)
        self.repository.add_audit(author, "create", "employee", employee.id, values, "manual")
        return employee

    def update_employee(self, employee_id: str, values: dict, author: str) -> HrEmployee:
        values = self._normalize_values(values)
        updated = self.repository.update_safe_fields(employee_id, values)
        self.repository.add_audit(author, "update", "employee", employee_id, values, "manual")
        return updated

    def archive_employee(self, employee_id: str, author: str) -> HrEmployee:
        archived = self.repository.archive_employee(employee_id, author)
        self.repository.add_audit(author, "archive", "employee", employee_id, None, "manual")
        return archived

    def restore_employee(self, employee_id: str, author: str) -> HrEmployee:
        restored = self.repository.restore_employee(employee_id)
        self.repository.add_audit(author, "restore", "employee", employee_id, None, "manual")
        return restored

    @staticmethod
    def _normalize_values(values: dict) -> dict:
        normalized = dict(values)
        for key in ("hire_date", "deputy_from", "deputy_until", "probation_end_date"):
            if isinstance(normalized.get(key), str):
                normalized[key] = date.fromisoformat(normalized[key])
        for month_key, year_key in (("birth_month", "birth_year"), ("education_graduation_month", "education_graduation_year")):
            if normalized.get(month_key):
                normalized[year_key] = int(normalized[month_key][:4])
        return normalized

    def analytics(self) -> dict:
        employees = self.repository.list_employees()
        departments = sorted({employee.department for employee in employees if employee.department})
        heads = {employee.department for employee in employees if employee.department and employee.department_status == "Руководитель отдела"}
        deputies = {employee.department for employee in employees if employee.department and employee.department_status in ("Заместитель руководителя", "Временно исполняющий обязанности")}
        incomplete = sum(1 for employee in employees if not employee.office or not employee.position or not employee.hire_date)
        return {
            "total": len(employees),
            "incomplete_cards": incomplete,
            "departments_without_deputy": sorted(heads - deputies),
            "departments": departments,
        }

    def calendar_events(self, month: str) -> list[dict]:
        year, month_number = (int(part) for part in month.split("-", 1))
        events = []
        for employee in self.repository.list_employees():
            if employee.hire_date and employee.hire_date.month == month_number:
                events.append({
                    "employee_id": employee.id,
                    "employee_name": employee.plan_name,
                    "department": employee.department,
                    "date": date(year, month_number, employee.hire_date.day).isoformat(),
                    "kind": "hire_anniversary",
                })
        return sorted(events, key=lambda event: (event["date"], event["employee_name"]))

    def preview_rows(self, rows: list[dict]) -> dict:
        errors = []
        accepted = []
        for index, row in enumerate(rows, 1):
            invalid = set(row) - ({"plan_id", "id"} | SAFE_FIELDS)
            if not row.get("plan_id") and not row.get("id"):
                errors.append({"row": index, "error": "Не указан plan_id"})
            elif invalid:
                errors.append({"row": index, "error": f"Недопустимые поля: {', '.join(sorted(invalid))}"})
            else:
                accepted.append(row)
        return {"accepted": accepted, "error_count": len(errors), "errors": errors}

    def apply_rows(self, rows: list[dict], author: str) -> dict:
        preview = self.preview_rows(rows)
        if preview["error_count"]:
            raise ValueError("Импорт содержит ошибки; сначала исправьте preview")
        updated = 0
        for row in preview["accepted"]:
            plan_id = str(row.get("plan_id") or row.get("id"))
            employee = self.repository.get_employee(plan_id)
            if employee is None:
                continue
            values = {key: value for key, value in row.items() if key in SAFE_FIELDS}
            if values:
                self.repository.update_safe_fields(employee.id, values)
                updated += 1
        self.repository.add_audit(author, "hr_import", "employee", "batch", {"updated": updated}, "hr_import")
        return {"updated": updated, "error_count": 0}
