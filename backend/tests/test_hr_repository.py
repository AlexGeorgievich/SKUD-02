import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.hr.models import Base
from backend.app.hr.repository import HrRepository


class HrRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.repo = HrRepository(self.engine)

    def test_plan_sync_creates_and_updates_only_plan_fields(self):
        employee = self.repo.upsert_plan_employee("plan-1", "Иванов Иван", "LAW", "2026-08")
        self.assertEqual(employee.plan_name, "Иванов Иван")
        self.assertEqual(employee.plan_department, "LAW")
        self.repo.update_safe_fields(employee.id, {"position": "Юрист", "work_email": "ivanov@example.com"})
        updated = self.repo.upsert_plan_employee("plan-1", "Иванов И.И.", "Legal", "2026-09")
        self.assertEqual(updated.id, employee.id)
        self.assertEqual(updated.position, "Юрист")
        self.assertEqual(updated.plan_name, "Иванов И.И.")
        self.assertEqual(updated.plan_department, "Legal")

    def test_unknown_employee_returns_none(self):
        self.assertIsNone(self.repo.get_employee("missing"))


if __name__ == "__main__":
    unittest.main()
