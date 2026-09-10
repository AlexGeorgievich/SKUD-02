import ast
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from cryptography.fernet import Fernet
from backend.app.infrastructure.repository import FileRepository
from backend.app.config import PROJECT_ROOT

class StorageTests(unittest.TestCase):
    def test_failed_publication_keeps_previous_pair(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = FileRepository(Path(tmp))
            repo.save_snapshot({'version': 1}, {'key': 'first'})
            original = repo._write
            def fail_pointer(path, content):
                if path.name == 'current.json':
                    raise OSError('Simulated interruption')
                return original(path, content)
            with patch.object(repo, '_write', side_effect=fail_pointer):
                with self.assertRaises(OSError):
                    repo.save_snapshot({'version': 2}, {'key': 'second'})
            self.assertEqual(repo.load_snapshot(), ({'version': 1}, {'key': 'first'}))

    def test_legacy_read_without_conversion(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            repo = FileRepository(path)
            key = repo.key()
            (path/'result.json').write_text(json.dumps({'version': 'legacy'}))
            (path/'identity.enc').write_bytes(Fernet(key).encrypt(b'{"id":"name"}'))
            self.assertEqual(repo.load_snapshot(), ({'version': 'legacy'}, {'id': 'name'}))
            self.assertFalse((path/'current.json').exists())

    def test_domain_has_no_external_layer_dependencies(self):
        for file in (PROJECT_ROOT/'backend/app/domain').glob('*.py'):
            for node in ast.walk(ast.parse(file.read_text())):
                if isinstance(node, ast.Import):
                    modules = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom):
                    modules = [node.module or '']
                else:
                    continue
                self.assertFalse(any(any(x in m for x in ('fastapi','openpyxl','infrastructure','services','api.')) for m in modules), file.name)
