"""Observable KUS behavior at the HTTP boundary."""

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.hr.models import Base, HrCatalogValue, HrDepartment, HrLegalEntity, HrOffice
from backend.app.main import create_app


class KusApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.app = create_app(Settings(data_dir=Path(self.temporary.name), database_url="sqlite+pysqlite:///:memory:"))
        self.engine = self.app.state.container.hr.repository.engine
        Base.metadata.create_all(self.engine)
        self.addCleanup(self.engine.dispose)
        self.auth = self.app.state.container.auth
        self.repo = self.app.state.container.hr.repository
        self.auth.create_user("hr", "123456789012", "hr")
        self.client = TestClient(self.app, base_url="http://localhost")
        self.client.post("/api/login", json={"username": "hr", "password": "123456789012"})
        with self.repo.sessions.begin() as session:
            office = HrOffice(name="Главный офис")
            company = HrLegalEntity(name="Тестовое юрлицо")
            gender = HrCatalogValue(kind="gender", label="Женский")
            work_format = HrCatalogValue(kind="work_format", label="Гибкий")
            position = HrCatalogValue(kind="position", label="Специалист")
            session.add_all([office, company, gender, work_format, position])
            session.flush()
            department = HrDepartment(name="Buying", office_id=office.id)
            session.add(department)
            session.flush()
            self.ids = {
                "office_id": office.id, "department_id": department.id,
                "legal_entity_id": company.id, "gender_id": gender.id,
                "work_format_id": work_format.id, "position_id": position.id,
            }

    def test_hr_creates_structured_card_using_catalog_ids(self):
        response = self.client.post("/api/hr/employees", json={
            **self.ids,
            "family_name": "Иванова", "given_name": "Анна", "patronymic": "Петровна",
            "plan_name": "Это значение нельзя сохранить", "personnel_number": "T-001", "position_en": "Specialist",
            "telegram": "@anna_test", "personal_phone": "+7 999 123-45-67",
            "work_email": "anna@example.com", "birth_date": "1990-05-21", "birth_place": "Москва",
        })

        self.assertEqual(response.status_code, 201, response.text)
        item = response.json()
        self.assertEqual(item["plan_name"], "Иванова Анна")
        self.assertEqual(item["family_name"], "Иванова")
        self.assertEqual(item["department_id"], self.ids["department_id"])
        self.assertEqual(item["telegram"], "@anna_test")
        self.assertEqual(item["personal_phone"], "+79991234567")
        self.assertEqual(item["birth_date"], "1990-05-21")
        self.assertEqual(item["birth_place"], "Москва")
        self.assertEqual(item["position"], "Специалист")

        updated = self.client.patch(f'/api/hr/employees/{item["id"]}', json={
            'plan_name': 'Подмена ФИО', 'patronymic': 'Сергеевна',
        })
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()['plan_name'], 'Иванова Анна')

    def test_bad_contact_is_rejected_without_creating_card(self):
        response = self.client.post("/api/hr/employees", json={
            "plan_name": "Иванова Анна", "department": "Buying", "work_email": "not-email",
        })

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/api/hr/employees").json()["count"], 0)

    def test_catalog_endpoint_lists_offices_and_departments(self):
        response = self.client.get("/api/hr/catalogs")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["offices"][0]["name"], "Главный офис")
        self.assertEqual(response.json()["departments"][0]["name"], "Buying")

    def test_role_scopes_and_read_only_card(self):
        first = self.client.post('/api/hr/employees', json={**self.ids, 'family_name': 'Иванова', 'given_name': 'Анна', 'personal_phone': '+79991234567'}).json()
        second = self.client.post('/api/hr/employees', json={**self.ids, 'family_name': 'Петрова', 'given_name': 'Елена'}).json()
        self.auth.create_user('employee', '123456789012', 'employee', employee='Иванова Анна')
        self.auth.create_user('manager', '123456789012', 'manager', department='Other')
        self.auth.create_user('timekeeper', '123456789012', 'timekeeper')
        self.auth.create_user('auditor', '123456789012', 'auditor')
        login = self.client.post('/api/login', json={'username': 'employee', 'password': '123456789012'})
        self.assertEqual(login.status_code, 200, login.text)
        listing = self.client.get('/api/hr/employees')
        self.assertEqual(listing.status_code, 200, listing.text)
        self.assertEqual(listing.json()['count'], 1)
        self.assertEqual(self.client.get(f'/api/hr/employees/{second["id"]}').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/hr/employees/{first["id"]}', json={'position': 'X'}).status_code, 403)
        self.assertEqual(self.client.get(f'/api/hr/employees/{first["id"]}/read-only').json()['mode'], 'read-only')
        self.client.post('/api/login', json={'username': 'manager', 'password': '123456789012'})
        self.assertEqual(self.client.get('/api/hr/employees').json()['count'], 0)
        self.client.post('/api/login', json={'username': 'timekeeper', 'password': '123456789012'})
        self.assertNotIn('personal_phone', self.client.get('/api/hr/employees').json()['items'][0])
        self.assertNotIn('personal_phone', self.client.get(f'/api/hr/employees/{first["id"]}').json())
        self.client.post('/api/login', json={'username': 'auditor', 'password': '123456789012'})
        self.assertNotIn('plan_name', self.client.get('/api/hr/employees').json()['items'][0])

    def test_personnel_number_is_unique_and_head_belongs_to_department(self):
        first = self.client.post('/api/hr/employees', json={**self.ids, 'family_name': 'Иванова', 'given_name': 'Анна', 'personnel_number': 'T-1'}).json()
        duplicate = self.client.post('/api/hr/employees', json={**self.ids, 'family_name': 'Петрова', 'given_name': 'Елена', 'personnel_number': 'T-1'})
        self.assertEqual(duplicate.status_code, 400)
        with self.repo.sessions.begin() as session:
            other = HrDepartment(name='Other')
            session.add(other)
            session.flush()
            other_id = other.id
        bad_head = self.client.post('/api/hr/employees', json={'department_id': other_id, 'family_name': 'Сидорова', 'given_name': 'Мария', 'department_head_id': first['id']})
        self.assertEqual(bad_head.status_code, 400)

    def test_fixed_catalog_values_and_date_ranges_are_enforced(self):
        with self.repo.sessions.begin() as session:
            bad_gender = HrCatalogValue(kind='gender', label='Не указан')
            bad_format = HrCatalogValue(kind='work_format', label='Гибрид')
            session.add_all([bad_gender, bad_format])
            session.flush()
            bad_gender_id, bad_format_id = bad_gender.id, bad_format.id

        base = {**self.ids, 'family_name': 'Иванова', 'given_name': 'Анна'}
        self.assertEqual(self.client.post('/api/hr/employees', json={**base, 'gender_id': bad_gender_id}).status_code, 400)
        self.assertEqual(self.client.post('/api/hr/employees', json={**base, 'work_format_id': bad_format_id}).status_code, 400)
        self.assertEqual(self.client.post('/api/hr/employees', json={
            **base, 'hire_date': '2026-09-10', 'probation_end_date': '2026-09-09',
        }).status_code, 400)
        self.assertEqual(self.client.post('/api/hr/employees', json={
            **base, 'deputy_from': '2026-09-10', 'deputy_until': '2026-09-09',
        }).status_code, 400)

    def test_office_department_and_deputy_must_be_consistent(self):
        first = self.client.post('/api/hr/employees', json={
            **self.ids, 'family_name': 'Иванова', 'given_name': 'Анна',
        }).json()
        with self.repo.sessions.begin() as session:
            other_office = HrOffice(name='Другой офис')
            other_department = HrDepartment(name='Other', office_id=other_office.id)
            session.add_all([other_office, other_department])
            session.flush()
            other_office_id, other_department_id = other_office.id, other_department.id

        mismatch = self.client.post('/api/hr/employees', json={
            **self.ids, 'office_id': other_office_id,
            'family_name': 'Петрова', 'given_name': 'Елена',
        })
        self.assertEqual(mismatch.status_code, 400)
        bad_deputy = self.client.post('/api/hr/employees', json={
            'department_id': other_department_id,
            'family_name': 'Сидорова', 'given_name': 'Мария', 'deputy_id': first['id'],
        })
        self.assertEqual(bad_deputy.status_code, 400)

    def test_photo_upload_is_checked_and_requires_authorized_reader(self):
        item = self.client.post('/api/hr/employees', json={**self.ids, 'family_name': 'Иванова', 'given_name': 'Анна'}).json()
        employee_id = item['id']
        bad = self.client.post(f'/api/hr/employees/{employee_id}/photo', files={'photo': ('fake.png', b'not-an-image', 'image/png')})
        self.assertEqual(bad.status_code, 400)
        png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')
        uploaded = self.client.post(f'/api/hr/employees/{employee_id}/photo', files={'photo': ('avatar.png', png, 'image/png')})
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        self.assertEqual(self.client.get(f'/api/hr/employees/{employee_id}/photo').content, png)
        self.auth.create_user('manager', '123456789012', 'manager', department='Other')
        self.client.post('/api/login', json={'username': 'manager', 'password': '123456789012'})
        self.assertEqual(self.client.get(f'/api/hr/employees/{employee_id}/photo').status_code, 404)


if __name__ == "__main__":
    unittest.main()
