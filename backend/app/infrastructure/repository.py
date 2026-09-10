"""Local repository. Atomic snapshot publication and legacy 0.1/0.2 reading."""
import json
import os
import re
import tempfile
import threading
import time
import uuid
from pathlib import Path
from cryptography.fernet import Fernet
from ..domain.errors import ServiceError

class FileRepository:
    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self._lock = threading.RLock()

    def _write(self, path: Path, content: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix='.write-', dir=path.parent)
        try:
            with os.fdopen(fd, 'wb') as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

    def key(self) -> bytes:
        with self._lock:
            path = self.directory / 'secret.key'
            if not path.exists():
                if (self.directory / 'identity.enc').exists() or (self.directory / 'current.json').exists():
                    raise ServiceError('Отсутствует ключ существующих данных. Восстановите secret.key из резервной копии.', 503)
                self._write(path, Fernet.generate_key())
                path.chmod(0o600)
            return path.read_bytes()

    def read_users(self) -> dict:
        with self._lock:
            path = self.directory / 'users.json'
            return json.loads(path.read_text('utf-8')) if path.exists() else {}

    def add_user(self, username: str, record: dict) -> None:
        with self._lock:
            users = self.read_users()
            if username in users:
                raise ServiceError('Пользователь уже существует; запись не изменена.', 409)
            users[username] = record
            self._write(self.directory / 'users.json', json.dumps(users, ensure_ascii=False).encode())

    def save_snapshot(self, result: dict, identities: dict) -> None:
        with self._lock:
            encrypted = Fernet(self.key()).encrypt(json.dumps(identities, ensure_ascii=False).encode())
            generation = uuid.uuid4().hex
            folder = self.directory / 'snapshots' / generation
            self._write(folder / 'result.json', json.dumps(result, ensure_ascii=False).encode())
            self._write(folder / 'identity.enc', encrypted)
            # The pointer is the commit point; a reader never observes half a snapshot.
            self._write(self.directory / 'current.json', json.dumps({'generation': generation}).encode())

    def load_snapshot(self, identities: bool = True) -> tuple[dict, dict]:
        with self._lock:
            folder = self.directory
            pointer = folder / 'current.json'
            if pointer.exists():
                generation = json.loads(pointer.read_text())['generation']
                if not re.fullmatch(r'[0-9a-f]{32}', generation):
                    raise ServiceError('Повреждён указатель текущего набора', 503)
                folder = folder / 'snapshots' / generation
            path = folder / 'result.json'
            if not path.exists():
                raise ServiceError('Сначала загрузите и обработайте два файла', 404)
            result = json.loads(path.read_text('utf-8'))
            mapping = json.loads(Fernet(self.key()).decrypt((folder / 'identity.enc').read_bytes())) if identities else {}
            return result, mapping

    def audit(self, user: dict, action: str) -> None:
        with self._lock:
            self.directory.mkdir(parents=True, exist_ok=True)
            entry = {'time': time.strftime('%Y-%m-%d %H:%M:%S'), 'user': user['username'], 'action': action}
            with (self.directory / 'audit.jsonl').open('a', encoding='utf-8') as f:
                f.write(json.dumps(entry, ensure_ascii=False) + '\n')

    def audit_entries(self) -> list[dict]:
        with self._lock:
            path = self.directory / 'audit.jsonl'
            return [json.loads(s) for s in path.read_text('utf-8').splitlines()][-200:][::-1] if path.exists() else []
