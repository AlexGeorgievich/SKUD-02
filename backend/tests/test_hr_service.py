import unittest
from sqlalchemy import create_engine
from backend.app.hr.models import Base
from backend.app.hr.repository import HrRepository
from backend.app.hr.service import HrService


class HrServiceTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.repository = HrRepository(engine)
        self.service = HrService(self.repository)

    def test_sync_keeps_plan_authoritative_and_marks_missing(self):
        self.service.sync_plan_rows([{"id": "a", "name": "Иванов Иван", "department": "LAW"}], "2026-08", "admin")
        self.service.sync_plan_rows([{"id": "b", "name": "Петров Пётр", "department": "HR"}], "2026-09", "admin")
        self.assertTrue(self.repository.get_employee("b").in_current_plan)
        self.assertFalse(self.repository.get_employee("a").in_current_plan)

    def test_preview_does_not_change_registry(self):
        preview = self.service.preview_rows([{"plan_id": "a", "position": "Юрист", "passport": "blocked"}])
        self.assertEqual(preview["error_count"], 1)
        self.assertIsNone(self.repository.get_employee("a"))


if __name__ == "__main__":
    unittest.main()
