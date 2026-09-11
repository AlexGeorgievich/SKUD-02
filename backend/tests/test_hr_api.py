import tempfile
import unittest
from pathlib import Path
from sqlalchemy import create_engine
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.hr.models import Base
from backend.app.main import create_app


class HrApiTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
