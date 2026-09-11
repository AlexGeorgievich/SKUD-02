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

    def test_plan_import_is_not_a_recurring_hr_synchronization(self):
        self.service.sync_plan_rows([{"id": "a", "name": "Иванов Иван", "department": "LAW"}], "2026-08", "admin")
        result = self.service.sync_plan_rows([{"id": "b", "name": "Петров Пётр", "department": "HR"}], "2026-09", "admin")

        self.assertEqual(result["status"], "skipped")
        self.assertIsNotNone(self.repository.get_employee("a"))
        self.assertIsNone(self.repository.get_employee("b"))

    def test_second_plan_bootstrap_does_not_change_hr_card(self):
        first = self.service.bootstrap_from_plan(
            [{"id": "a", "name": "Иванов Иван", "department": "LAW"}], "2026-08", "admin"
        )
        employee = self.repository.get_employee("a")
        self.service.update_employee(employee.id, {"department": "Legal"}, "hr-user")

        second = self.service.bootstrap_from_plan(
            [{"id": "a", "name": "Иванов И.И.", "department": "Changed"}], "2026-09", "admin"
        )

        self.assertEqual(first["status"], "applied")
        self.assertEqual(second["status"], "skipped")
        self.assertEqual(self.repository.get_employee("a").department, "Legal")
        self.assertEqual(self.repository.get_employee("a").plan_name, "Иванов Иван")

    def test_existing_registry_is_marked_bootstrapped_without_plan_rewrite(self):
        employee = self.repository.create_from_initial_plan("a", "Иванов Иван", "LAW", "2026-08")

        result = self.service.bootstrap_from_plan(
            [{"id": "a", "name": "Изменённое имя", "department": "Changed"}], "2026-09", "admin"
        )

        self.assertEqual(result["status"], "skipped")
        self.assertEqual(self.repository.get_employee(employee.id).plan_name, "Иванов Иван")

    def test_restore_returns_archived_employee_to_active_registry(self):
        employee = self.service.create_employee({"plan_name": "Петров Пётр", "department": "HR"}, "hr-user")
        self.service.archive_employee(employee.id, "hr-user")

        self.service.restore_employee(employee.id, "admin")

        self.assertEqual(self.repository.list_employees()[0].id, employee.id)

    def test_preview_does_not_change_registry(self):
        preview = self.service.preview_rows([{"plan_id": "a", "position": "Юрист", "passport": "blocked"}])
        self.assertEqual(preview["error_count"], 1)
        self.assertIsNone(self.repository.get_employee("a"))


if __name__ == "__main__":
    unittest.main()
