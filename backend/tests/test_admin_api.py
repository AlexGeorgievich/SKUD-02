import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app


class AdminApiTests(unittest.TestCase):
    def test_hr_cannot_manage_users_or_create_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(data_dir=Path(tmp), database_url="sqlite+pysqlite:///:memory:"))
            app.state.container.auth.create_user("hr", "123456789012", "hr")
            client = TestClient(app, base_url="http://localhost")
            self.assertEqual(client.post("/api/login", json={"username": "hr", "password": "123456789012"}).status_code, 200)
            self.assertEqual(client.get("/api/admin/users").status_code, 403)
            self.assertEqual(client.post("/api/admin/backups").status_code, 403)


if __name__ == "__main__":
    unittest.main()
