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


if __name__ == "__main__":
    unittest.main()
