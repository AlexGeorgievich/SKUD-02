"""The KUS migration must enrich existing cards without replacing their IDs."""

import importlib
import unittest

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text

from backend.app.hr.models import Base


class KusMigrationTests(unittest.TestCase):
    def test_current_models_have_catalogs_and_separate_name_parts(self):
        engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(engine)
        inspector = inspect(engine)

        self.assertIn("hr_offices", inspector.get_table_names())
        self.assertIn("hr_legal_entities", inspector.get_table_names())
        self.assertIn("hr_catalog_values", inspector.get_table_names())
        columns = {item["name"] for item in inspector.get_columns("hr_employees")}
        self.assertTrue({"family_name", "given_name", "patronymic", "office_id", "department_id"} <= columns)

    def test_upgrade_keeps_cards_and_backfills_catalogs(self):
        engine = create_engine("sqlite+pysqlite:///:memory:")
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE hr_employees (
                    id VARCHAR(36) PRIMARY KEY, plan_employee_id VARCHAR(120),
                    plan_name VARCHAR(255), plan_department VARCHAR(255),
                    office VARCHAR(255), department VARCHAR(255), gender VARCHAR(16)
                )
            """))
            connection.execute(text("""
                CREATE TABLE hr_departments (
                    id VARCHAR(36) PRIMARY KEY, name VARCHAR(255), head_id VARCHAR(36),
                    created_at DATETIME, updated_at DATETIME
                )
            """))
            connection.execute(text("""
                INSERT INTO hr_employees
                    (id,plan_employee_id,plan_name,plan_department,office,department,gender)
                VALUES
                    ('e-1','plan-1','Иванов Иван','Buying','Москва','Buying','Мужской'),
                    ('e-2','plan-2','Петрова Анна','Buying','Москва','Buying','Женский'),
                    ('m-1','manual:1','Тест Один','HR','Москва','HR',NULL),
                    ('m-2','manual:2','Тест Два','HR','Москва','HR',NULL),
                    ('m-3','manual:3','Тест Три','HR','Москва','HR',NULL)
            """))
            migration = importlib.import_module("backend.alembic.versions.0008_kus_catalogs")
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
            rows = connection.execute(text("SELECT id,plan_name,office_id,department_id,gender_id FROM hr_employees ORDER BY id")).all()
            self.assertEqual([row[0] for row in rows], ["e-1", "e-2", "m-1", "m-2", "m-3"])
            self.assertEqual(rows[0][1], "Иванов Иван")
            self.assertEqual(rows[0][2], rows[1][2])
            self.assertEqual(rows[0][3], rows[1][3])
            self.assertNotEqual(rows[0][4], rows[1][4])
            self.assertEqual(connection.scalar(text("SELECT COUNT(*) FROM hr_offices")), 1)
            self.assertEqual(connection.scalar(text("SELECT COUNT(*) FROM hr_departments")), 2)
            self.assertEqual(connection.scalar(text("SELECT COUNT(*) FROM hr_catalog_values WHERE kind='gender'")), 2)


if __name__ == "__main__":
    unittest.main()
