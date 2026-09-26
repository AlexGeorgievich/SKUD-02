"""Reviewed HR workbook exchange; preview never mutates the roster."""

from datetime import date
from hashlib import sha256

from .validation import normalize_contact
from .xlsx import export_hr_xlsx, parse_hr_xlsx


GENDERS = {"ж": "Женский", "женский": "Женский", "м": "Мужской", "мужской": "Мужской"}


def _date(value: str | None, field: str, errors: list, row_number: int):
    if not value:
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        errors.append({"row": row_number, "field": field, "error": "Ожидается полная дата YYYY-MM-DD"})
        return None


def _parts(name: str) -> tuple[str | None, str | None, str | None]:
    items = name.split()
    return (items[0] if items else None, items[1] if len(items) > 1 else None, " ".join(items[2:]) or None)


class HrXlsxService:
    def __init__(self, repository):
        self.repository = repository

    def preview(self, blob: bytes, author: str) -> dict:
        source_rows = parse_hr_xlsx(blob)
        employees = self.repository.list_employees()
        by_name = {}
        for employee in employees:
            by_name.setdefault(employee.plan_name.strip().casefold(), []).append(employee)
        rows, errors, seen_ids = [], [], set()
        for source in source_rows:
            row_number = source["row_number"]
            name = (source.get("name") or "").strip()
            department = (source.get("department") or "").strip()
            row_errors = []
            if len(name.split()) < 2:
                row_errors.append({"row": row_number, "field": "name", "error": "Укажите фамилию и имя"})
            if not department:
                row_errors.append({"row": row_number, "field": "department", "error": "Не указан отдел"})
            contacts = {}
            for field, kind in (("telegram", "telegram"), ("personal_phone", "phone"), ("work_email", "email")):
                try:
                    contacts[field] = normalize_contact(kind, source.get(field))
                except ValueError as error:
                    row_errors.append({"row": row_number, "field": field, "error": str(error)})
            matches = by_name.get(name.casefold(), []) if name else []
            if len(matches) > 1:
                same_department = [item for item in matches if (item.department or "").casefold() == department.casefold()]
                matches = same_department if len(same_department) == 1 else matches
            if len(matches) > 1:
                row_errors.append({"row": row_number, "field": "name", "error": "ФИО неоднозначно; требуется ручное сопоставление"})
            employee_id = matches[0].id if len(matches) == 1 else None
            if employee_id:
                seen_ids.add(employee_id)
            family_name, given_name, patronymic = _parts(name)
            birth_date = _date(source.get("birth_date"), "birth_date", row_errors, row_number) if source.get("birth_date") and len(source["birth_date"]) >= 8 else None
            values = {
                "plan_name": name, "family_name": family_name, "given_name": given_name, "patronymic": patronymic,
                "department": department, "position": source.get("position"), "position_en": source.get("position_en"),
                "legal_entity": source.get("legal_entity"), "work_format": source.get("work_format"),
                "hire_date": _date(source.get("hire_date"), "hire_date", row_errors, row_number),
                "probation_end_date": _date(source.get("probation_end_date"), "probation_end_date", row_errors, row_number),
                "birth_date": birth_date, "birth_month": birth_date[:7] if birth_date else None,
                "birth_year": int(birth_date[:4]) if birth_date else None,
                "gender_label": GENDERS.get((source.get("gender") or "").casefold(), source.get("gender")),
                "business_card": source.get("business_card"), **contacts,
                "education_institution": source.get("education_institution"), "academic_degree": source.get("academic_degree"),
                "education_specialty": source.get("education_specialty"), "recommendation": source.get("recommendation"),
                "recruiter": source.get("recruiter"), "photo_source_url": source.get("photo_source_url"),
                "mail_image_url": source.get("mail_image_url"), "comments": source.get("comments"), "insurance": source.get("insurance"),
            }
            errors.extend(row_errors)
            rows.append({"row_number": row_number, "employee_id": employee_id, "action": "update" if employee_id else "create", "values": values})
        archive_candidates = [employee.id for employee in employees if employee.id not in seen_ids]
        diagnostics = {"file_hash": sha256(blob).hexdigest(), "rows": rows, "archive_candidates": archive_candidates, "errors": errors}
        batch = self.repository.create_import_batch(author, diagnostics, len(errors))
        return {
            "batch_id": batch.id, "row_count": len(rows), "error_count": len(errors), "errors": errors,
            "create_count": sum(row["action"] == "create" for row in rows),
            "update_count": sum(row["action"] == "update" for row in rows),
            "archive_candidates": archive_candidates,
        }

    def apply(self, batch_id: str, confirm_archive_ids: list[str], author: str) -> dict:
        batch = self.repository.get_import_batch(batch_id)
        if batch is None or batch.author != author:
            raise KeyError(batch_id)
        result = self.repository.apply_import_batch(batch_id, set(confirm_archive_ids))
        self.repository.add_audit(author, "hr_xlsx_apply", "import_batch", batch_id, result, "hr_import")
        return result

    def export(self) -> bytes:
        return export_hr_xlsx(self.repository.export_employee_rows())
