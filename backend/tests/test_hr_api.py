import tempfile
import unittest
from pathlib import Path
from sqlalchemy import create_engine
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.hr.models import Base
from backend.app.main import create_app


class HrApiTests(unittest.TestCase):
    def test_hr_can_list_archived_cards_and_restore_them(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            employee = app.state.container.hr.repository.create_manual_employee("Архивов Аркадий", "HR")
            client = TestClient(app, base_url="http://localhost")
            client.post("/api/login", json={"username": "hr", "password": "123456789012"})

            self.assertEqual(client.post(f"/api/hr/employees/{employee.id}/archive").status_code, 200)
            self.assertEqual(client.get("/api/hr/employees").json()["count"], 0)
            archived = client.get("/api/hr/employees?archived=true")
            self.assertEqual(archived.status_code, 200)
            self.assertEqual(archived.json()["items"][0]["plan_name"], "Архивов Аркадий")
            self.assertIsNotNone(archived.json()["items"][0]["archived_at"])

            self.assertEqual(client.post(f"/api/hr/employees/{employee.id}/restore").status_code, 200)
            self.assertEqual(client.get("/api/hr/employees?archived=true").json()["count"], 0)

    def test_hr_can_create_employee_but_manager_cannot(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            app.state.container.auth.create_user("manager", "123456789012", "manager", department="LAW")
            client = TestClient(app, base_url="http://localhost")
            client.post("/api/login", json={"username": "hr", "password": "123456789012"})
            response = client.post("/api/hr/employees", json={"plan_name": "Петров Пётр", "department": "HR", "office": "PPL Group"})
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["plan_name"], "Петров Пётр")
            self.assertEqual(response.json()["department"], "HR")
            client.post("/api/logout")
            client.post("/api/login", json={"username": "manager", "password": "123456789012"})
            self.assertEqual(client.post("/api/hr/employees", json={"plan_name": "Сидоров Сидор", "department": "LAW"}).status_code, 403)

    def test_hr_profile_supports_education_probation_schedule_and_comments(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            client = TestClient(app, base_url="http://localhost")
            client.post("/api/login", json={"username": "hr", "password": "123456789012"})
            response = client.post("/api/hr/employees", json={
                "plan_name": "Петров Пётр", "department": "LAW", "education_institution": "МГУ",
                "education_specialty": "Право", "education_graduation_year": 2018,
                "work_experience": "6 лет", "employment_type": "probation",
                "probation_end_date": "2026-12-31", "schedule_type": "flexible",
                "comments": "Наставник назначен", "responsibility": "Контроль договоров\nКоординация отдела",
            })
            self.assertEqual(response.status_code, 201)
            item = response.json()
            self.assertEqual(item["education_institution"], "МГУ")
            self.assertEqual(item["employment_type"], "probation")
            self.assertEqual(item["probation_end_date"], "2026-12-31")
            self.assertEqual(item["schedule_type"], "flexible")
            self.assertEqual(item["responsibility"], "Контроль договоров\nКоординация отдела")

    def test_hr_profile_preserves_birth_and_education_months(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            client = TestClient(app, base_url="http://localhost")
            client.post("/api/login", json={"username": "hr", "password": "123456789012"})

            response = client.post("/api/hr/employees", json={
                "plan_name": "Иванова Ирина", "department": "HR",
                "birth_month": "1993-10", "education_graduation_month": "2016-06",
            })

            self.assertEqual(response.status_code, 201)
            item = response.json()
            self.assertEqual(item["birth_month"], "1993-10")
            self.assertEqual(item["education_graduation_month"], "2016-06")
            self.assertEqual(item["birth_year"], 1993)
            self.assertEqual(item["education_graduation_year"], 2016)

    def test_hr_can_store_full_birth_and_graduation_dates(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            client = TestClient(app, base_url="http://localhost")
            client.post("/api/login", json={"username": "hr", "password": "123456789012"})
            response = client.post("/api/hr/employees", json={
                "plan_name": "Сидоров Сергей", "department": "HR",
                "birth_date": "1993-10-20", "education_graduation_date": "2016-06-30",
            })

            self.assertEqual(response.status_code, 201)
            item = response.json()
            self.assertEqual(item["birth_date"], "1993-10-20")
            self.assertEqual(item["education_graduation_date"], "2016-06-30")
            self.assertEqual(item["birth_year"], 1993)
            self.assertEqual(item["education_graduation_year"], 2016)

    def test_hr_can_create_department_and_assign_its_head(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            employee = app.state.container.hr.repository.create_manual_employee("Иванов Иван", "HR")
            client = TestClient(app, base_url="http://localhost")
            client.post("/api/login", json={"username": "hr", "password": "123456789012"})

            response = client.post("/api/hr/departments", json={"name": "Новый отдел", "head_id": employee.id})

            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["name"], "Новый отдел")
            self.assertEqual(response.json()["head_id"], employee.id)
            self.assertEqual(client.get("/api/hr/departments").json()["items"][0]["name"], "Новый отдел")

    def test_admin_can_edit_but_manager_cannot(self):
        with tempfile.TemporaryDirectory() as tmp:
            engine = create_engine("sqlite+pysqlite:///:memory:")
            Base.metadata.create_all(engine)
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            # Reuse the app's in-memory engine and create its schema.
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("admin", "123456789012", "admin")
            app.state.container.auth.create_user("manager", "123456789012", "manager", department="LAW")
            employee = app.state.container.hr.repository.upsert_plan_employee("p1", "Иванов Иван", "LAW", "2026-08")
            client = TestClient(app, base_url="http://localhost")
            self.assertEqual(client.post("/api/login", json={"username": "admin", "password": "123456789012"}).status_code, 200)
            self.assertEqual(client.patch(f"/api/hr/employees/{employee.id}", json={"position": "Юрист"}).status_code, 200)
            client.post("/api/logout")
            self.assertEqual(client.post("/api/login", json={"username": "manager", "password": "123456789012"}).status_code, 200)
            self.assertEqual(client.patch(f"/api/hr/employees/{employee.id}", json={"position": "Нет"}).status_code, 403)

    def test_timetrack_card_is_read_only_and_hr_can_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("admin", "123456789012", "admin")
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            app.state.container.auth.create_user("manager", "123456789012", "manager", department="LAW")
            employee = app.state.container.hr.repository.create_from_initial_plan("p1", "Иванов Иван", "LAW", "2026-08")
            client = TestClient(app, base_url="http://localhost")

            self.assertEqual(client.post("/api/login", json={"username": "admin", "password": "123456789012"}).status_code, 200)
            response = client.get(f"/api/hr/employees/{employee.id}/read-only?source=timetrack")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["mode"], "read-only")
            by_name = client.get("/api/hr/employees/not-the-plan-id/read-only", params={"source": "timetrack", "name": "Иванов Иван"})
            self.assertEqual(by_name.status_code, 200)
            self.assertEqual(by_name.json()["plan_employee_id"], "p1")
            self.assertEqual(client.patch(f"/api/hr/employees/{employee.id}?source=timetrack", json={"position": "Юрист"}).status_code, 403)
            client.post("/api/logout")

            self.assertEqual(client.post("/api/login", json={"username": "hr", "password": "123456789012"}).status_code, 200)
            self.assertEqual(client.post(f"/api/hr/employees/{employee.id}/archive").status_code, 200)
            client.post("/api/logout")
            self.assertEqual(client.post("/api/login", json={"username": "manager", "password": "123456789012"}).status_code, 200)
            self.assertEqual(client.post(f"/api/hr/employees/{employee.id}/restore").status_code, 403)

    def test_hr_calendar_and_analytics_are_available_to_authorized_user(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            Base.metadata.create_all(app.state.container.hr.repository.engine)
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            employee = app.state.container.hr.repository.create_manual_employee("Иванов Иван", "LAW")
            app.state.container.hr.update_employee(employee.id, {"hire_date": "2020-09-11"}, "hr")
            client = TestClient(app, base_url="http://localhost")
            client.post("/api/login", json={"username": "hr", "password": "123456789012"})
            self.assertEqual(client.get("/api/hr/analytics").status_code, 200)
            response = client.get("/api/hr/calendar?month=2026-09")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["items"][0]["kind"], "hire_anniversary")


if __name__ == "__main__":
    unittest.main()
