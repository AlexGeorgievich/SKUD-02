import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.hr.models import Base
from backend.app.main import create_app


class AdminCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.app = create_app(Settings(data_dir=Path(self.temporary.name), database_url='sqlite+pysqlite:///:memory:'))
        Base.metadata.create_all(self.app.state.container.hr.repository.engine)
        self.addCleanup(self.app.state.container.hr.repository.engine.dispose)
        self.app.state.container.auth.create_user('admin', '123456789012', 'admin')
        self.app.state.container.auth.create_user('hr', '123456789012', 'hr')
        self.client = TestClient(self.app, base_url='http://localhost')
        self.client.post('/api/login', json={'username': 'admin', 'password': '123456789012'})

    def create(self, kind, **values):
        response = self.client.post(f'/api/admin/catalogs/{kind}', json=values)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_admin_can_list_create_rename_and_delete_all_catalog_kinds(self):
        office = self.create('offices', name=' Москва ')
        legal = self.create('legal_entities', name='ООО Тест')
        position = self.create('positions', name='Аналитик')
        department = self.create('departments', name='Buying', office_id=office['id'])

        body = self.client.get('/api/admin/catalogs').json()
        self.assertEqual(body['offices'][0]['name'], 'Москва')
        self.assertEqual(body['departments'][0]['office_id'], office['id'])
        self.assertEqual(body['positions'][0]['employee_count'], 0)

        renamed = self.client.patch(f"/api/admin/catalogs/positions/{position['id']}", json={'name': 'Старший аналитик'})
        self.assertEqual(renamed.status_code, 200, renamed.text)
        self.assertEqual(renamed.json()['name'], 'Старший аналитик')
        renamed_department = self.client.patch(
            f"/api/admin/catalogs/departments/{department['id']}", json={'name': 'Закупки'},
        )
        self.assertEqual(renamed_department.status_code, 200, renamed_department.text)
        self.assertEqual(renamed_department.json()['office_id'], office['id'])

        for kind, item in (('departments', department), ('positions', position), ('legal_entities', legal), ('offices', office)):
            response = self.client.delete(f"/api/admin/catalogs/{kind}/{item['id']}")
            self.assertEqual(response.status_code, 204, response.text)

    def test_hr_is_forbidden_and_names_are_normalized_unique(self):
        self.create('offices', name='Москва')
        duplicate = self.client.post('/api/admin/catalogs/offices', json={'name': '  москва  '})
        self.assertEqual(duplicate.status_code, 409, duplicate.text)
        self.assertEqual(self.client.post('/api/admin/catalogs/offices', json={'name': '   '}).status_code, 400)

        self.client.post('/api/login', json={'username': 'hr', 'password': '123456789012'})
        self.assertEqual(self.client.get('/api/admin/catalogs').status_code, 403)
        self.assertEqual(self.client.post('/api/admin/catalogs/positions', json={'name': 'X'}).status_code, 403)

    def test_referenced_items_cannot_be_deleted_or_silently_detached(self):
        office = self.create('offices', name='Москва')
        legal = self.create('legal_entities', name='ООО Тест')
        position = self.create('positions', name='Аналитик')
        department = self.create('departments', name='Buying', office_id=office['id'])
        employee = self.app.state.container.hr.repository.create_manual_employee('Иванов Иван', 'Buying', {
            'office_id': office['id'], 'office': 'Москва',
            'department_id': department['id'], 'legal_entity_id': legal['id'],
            'position_id': position['id'], 'position': 'Аналитик',
        })
        self.client.patch(f"/api/admin/catalogs/departments/{department['id']}", json={'name': 'Buying', 'office_id': office['id'], 'head_id': employee.id})

        for kind, item in (('offices', office), ('legal_entities', legal), ('positions', position), ('departments', department)):
            response = self.client.delete(f"/api/admin/catalogs/{kind}/{item['id']}")
            self.assertEqual(response.status_code, 409, (kind, response.text))
            self.assertIn('зависим', response.json()['detail'].lower())

        loaded = self.app.state.container.hr.repository.get_employee(employee.id)
        self.assertEqual(loaded.department_id, department['id'])
        self.assertEqual(loaded.position_id, position['id'])


if __name__ == '__main__':
    unittest.main()
