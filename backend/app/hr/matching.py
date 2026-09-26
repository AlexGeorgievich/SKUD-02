"""Pure row-to-KUS matching. It never writes personnel cards."""

from dataclasses import dataclass
import unicodedata


@dataclass(frozen=True)
class MatchRow:
    row_number: int
    source_name: str
    source_department: str | None
    candidate_ids: tuple[str, ...]
    status: str


def _text(value) -> str:
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).split()).casefold()


def _employee_name(employee) -> str:
    structured = " ".join(part for part in (getattr(employee, "family_name", None), getattr(employee, "given_name", None), getattr(employee, "patronymic", None)) if part)
    return structured or getattr(employee, "plan_name", "")


def preview_source(rows: list[dict], kind: str, roster: list) -> list[MatchRow]:
    active = [employee for employee in roster if getattr(employee, "archived_at", None) is None]
    result = []
    for index, row in enumerate(rows, 1):
        row_number = int(row.get("row_number") or index)
        source_name = str(row.get("name") or "").strip()
        department = str(row.get("department") or "").strip() or None
        candidates = [employee for employee in active if _text(_employee_name(employee)) == _text(source_name)]
        if department and len(candidates) > 1:
            scoped = [employee for employee in candidates if _text(getattr(employee, "department", "")) == _text(department)]
            if scoped:
                candidates = scoped
        identifiers = tuple(sorted(employee.id for employee in candidates))
        status = "matched" if len(identifiers) == 1 else "ambiguous" if identifiers else "unknown"
        result.append(MatchRow(row_number, source_name, department, identifiers, status))
    return result


def resolve_source(preview: list[MatchRow], decisions: dict[int, str]) -> dict[int, str]:
    mapping = {}
    for row in preview:
        decision = decisions.get(row.row_number)
        if row.status == "matched" and not decision:
            mapping[row.row_number] = row.candidate_ids[0]
            continue
        if not decision:
            raise ValueError(f"Строка {row.row_number} требует ручного сопоставления")
        if row.candidate_ids and decision not in row.candidate_ids:
            raise ValueError(f"Решение строки {row.row_number} не входит в список кандидатов")
        mapping[row.row_number] = decision
    return mapping
