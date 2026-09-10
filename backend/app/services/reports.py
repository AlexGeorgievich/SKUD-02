from ..domain.access import scope_result
from ..domain.errors import ServiceError
from ..infrastructure.excel.writer import export
from .ports import Repository

class ReportService:
    def __init__(self, repository: Repository):
        self.repository = repository

    def result(self, user: dict) -> dict:
        result, mapping = self.repository.load_snapshot(identities=user['role'] != 'auditor')
        result = scope_result(user, result)
        result['employees'] = [{**e, 'name': mapping.get(e['id'], e['id'])} for e in result['employees']]
        return result

    def export(self, user: dict, department: str = '', employee: str = '', view: str = 'all', anonymous: bool = False, search: str = '') -> bytes:
        result, names = self.repository.load_snapshot(identities=user['role'] != 'auditor')
        result = scope_result(user, result)
        if search.strip():
            query = search.strip().lower()
            result['employees'] = [e for e in result['employees'] if query in names.get(e['id'], e['id']).lower()]
            ids = {e['id'] for e in result['employees']}
            result['days'] = [d for d in result['days'] if d['id'] in ids]
        blob = export(result, None if anonymous or user['role'] == 'auditor' else names, department, employee, view)
        self.repository.audit(user, 'Экспорт ' + view)
        return blob

    def audit(self, user: dict) -> list[dict]:
        if user['role'] not in ('admin', 'auditor'):
            raise ServiceError('Нет доступа', 403)
        return self.repository.audit_entries()
