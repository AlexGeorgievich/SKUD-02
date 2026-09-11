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
