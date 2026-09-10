import os
import unittest


class HrSettingsTests(unittest.TestCase):
    def test_settings_read_database_url_from_environment(self):
        previous = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = "postgresql+psycopg://u:p@db:5432/timetrack"
        try:
            from backend.app.config import Settings

            self.assertEqual(Settings().database_url, os.environ["DATABASE_URL"])
        finally:
            if previous is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = previous

    def test_database_is_optional_by_default(self):
        from backend.app.config import Settings

        self.assertEqual(Settings().database_url, "")
        self.assertFalse(Settings().database_required)


if __name__ == "__main__":
    unittest.main()
