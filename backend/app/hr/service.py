from sqlalchemy import select

from .models import HrEmployee, HrImportBatch
from .repository import HrRepository, SAFE_FIELDS


class HrService:
    def __init__(self, repository: HrRepository):
        self.repository = repository

    def sync_plan_rows(self, rows: list[dict], period: str, author: str) -> dict:
        seen = set()
        for row in rows:
            plan_id = str(row.get("id") or row.get("normalized") or row["name"])
            self.repository.upsert_plan_employee(plan_id, row["name"], row["department"], period)
            seen.add(plan_id)
        self.repository.mark_not_in_plan(seen)
        self.repository.add_audit(author, "plan_sync", "plan", period, {"count": len(rows)}, "plan")
        return {"synced": len(rows), "period": period}

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
