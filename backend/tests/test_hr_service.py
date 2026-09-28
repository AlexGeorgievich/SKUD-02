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

    def test_analytics_counts_incomplete_cards_and_departments_without_deputy(self):
        self.service.create_employee({"plan_name": "Иванова Анна", "department": "HR", "department_status": "Руководитель отдела"}, "hr")

        result = self.service.analytics()

        self.assertEqual(result["incomplete_cards"], 1)
        self.assertEqual(result["departments_without_deputy"], ["HR"])

    def test_calendar_emits_hire_anniversary_without_contact_data(self):
        employee = self.service.create_employee({"plan_name": "Петров Пётр", "department": "LAW", "hire_date": "2020-09-11"}, "hr")

        event = self.service.calendar_events("2026-09")[0]

        self.assertEqual(event["employee_id"], employee.id)
        self.assertEqual(event["kind"], "hire_anniversary")
        self.assertNotIn("work_phone", event)

    def test_preview_does_not_change_registry(self):
        preview = self.service.preview_rows([{"plan_id": "a", "position": "Юрист", "passport": "blocked"}])
        self.assertEqual(preview["error_count"], 1)
        self.assertIsNone(self.repository.get_employee("a"))

    def test_legacy_unknown_gender_and_work_format_remain_readable(self):
        employee = self.repository.create_manual_employee('Старая Запись', 'Legacy', {
            'gender': 'Другое старое значение', 'work_schedule': 'Старый формат',
        })

        loaded = self.repository.get_employee(employee.id)

        self.assertEqual(loaded.gender, 'Другое старое значение')
        self.assertEqual(loaded.work_schedule, 'Старый формат')


if __name__ == "__main__":
    unittest.main()
