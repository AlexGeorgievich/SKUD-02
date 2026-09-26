import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

from backend.app.hr.matching import preview_source, resolve_source
from backend.app.infrastructure.excel.generator import generate
from backend.app.infrastructure.excel.reader import read_input
from backend.app.services.imports import ImportService


def employee(identifier, name, department):
    parts = name.split()
    return SimpleNamespace(id=identifier, plan_name=name, family_name=parts[0], given_name=parts[1], patronymic=' '.join(parts[2:]) or None, department=department, archived_at=None)


class SourceMatchingTests(unittest.TestCase):
    def setUp(self):
        self.roster = [employee('1', 'Иванов Иван', 'Buying'), employee('2', 'Петрова Анна', 'HR')]

    def test_name_and_department_match_to_kus_uuid(self):
        row = preview_source([{'name': 'Иванов Иван', 'department': 'Buying'}], 'plan', self.roster)[0]
        self.assertEqual((row.status, row.candidate_ids), ('matched', ('1',)))

    def test_duplicate_name_needs_manual_decision(self):
        roster = self.roster + [employee('3', 'Иванов Иван', 'PR')]
        row = preview_source([{'name': 'Иванов Иван', 'department': ''}], 'fact', roster)[0]
        self.assertEqual(row.status, 'ambiguous')
        self.assertEqual(row.candidate_ids, ('1', '3'))
        with self.assertRaises(ValueError):
            resolve_source([row], {})
        self.assertEqual(resolve_source([row], {1: '3'}), {1: '3'})

    def test_unknown_never_creates_employee(self):
        row = preview_source([{'name': 'Неизвестный Человек', 'department': 'Buying'}], 'plan', self.roster)[0]
        self.assertEqual((row.status, row.candidate_ids), ('unknown', ()))
        with self.assertRaises(ValueError):
            resolve_source([row], {})

    def test_same_name_in_plan_uses_department(self):
        roster = self.roster + [employee('3', 'Иванов Иван', 'PR')]
        row = preview_source([{'name': 'Иванов Иван', 'department': 'PR'}], 'plan', roster)[0]
        self.assertEqual((row.status, row.candidate_ids), ('matched', ('3',)))

    def test_import_uses_roster_but_never_bootstraps_or_rewrites_kus(self):
        plan, fact = generate('2026-08')
        roster = [employee(str(index), row['name'], row['department']) for index, row in enumerate(read_input(plan, 'plan', '2026-08'), 1)]
        before = [(item.id, item.plan_name, item.department) for item in roster]
        hr_service = Mock()
        hr_service.repository.list_employees.return_value = roster
        repository = Mock()
        repository.key.return_value = b'dGVzdC1vbmx5LWtleQ=='
        service = ImportService(repository, hr_service)
        result = service.run({'role': 'admin', 'username': 'admin'}, plan, fact, '2026-08', date(2026, 8, 31))
        self.assertTrue(result['ok'])
        hr_service.bootstrap_from_plan.assert_not_called()
        self.assertEqual([(item.id, item.plan_name, item.department) for item in roster], before)


if __name__ == '__main__':
    unittest.main()
