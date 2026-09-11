import base64
import io
import zipfile
from datetime import date
from ..domain.access import WRITERS
from ..domain.errors import ServiceError
from ..infrastructure.excel.reader import read_input
from ..infrastructure.excel.generator import generate
from .ports import Repository
from .reconciliation import process

class ImportService:
    def __init__(self, repository: Repository, hr_service=None):
        self.repository = repository
        self.hr_service = hr_service

    def demo(self, period: str) -> bytes:
        plan, fact = generate(period)
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('plan.xlsx', plan)
            z.writestr('skud_fact.xlsx', fact)
        return out.getvalue()

    def run(self, user: dict, plan: bytes, fact: bytes, period: str, asof: date, preview: bool = False) -> dict:
        if user['role'] not in WRITERS:
            raise ServiceError('Нет права на импорт', 403)
        if preview:
            rows = [read_input(b, kind, period) for b, kind in ((plan, 'plan'), (fact, 'fact'))]
            return dict(plan_count=len(rows[0]), fact_count=len(rows[1]), plan=rows[0][:8], fact=rows[1][:8])
        if asof > date.today():
            raise ServiceError('Дата анализа не может быть в будущем')
        result, identities = process(plan, fact, period, base64.urlsafe_b64decode(self.repository.key()), asof)
        self.repository.save_snapshot(result, identities)
        if self.hr_service is not None:
            plan_rows = read_input(plan, 'plan', period)
            self.hr_service.sync_plan_rows(plan_rows, period, user['username'])
        self.repository.audit(user, 'Импорт ' + period)
        return {'ok': True, 'employees': len(result['employees']), 'unmatched': len(result['unmatched'])}
