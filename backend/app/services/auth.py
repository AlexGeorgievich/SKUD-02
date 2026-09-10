import base64
import hashlib
import hmac
import secrets
import threading
import time
from ..domain.access import ROLES
from ..domain.errors import ServiceError
from ..domain.identity import token
from .ports import Repository

def password_hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()

class AuthService:
    def __init__(self, repository: Repository, session_seconds: int = 28800):
        self.repository = repository
        self.session_seconds = session_seconds
        self.sessions: dict = {}
        self.attempts: dict = {}
        self._lock = threading.RLock()

    def login(self, username: str, password: str, ip: str) -> tuple[str, dict]:
        with self._lock:
            now = time.time()
            self.sessions = {k: v for k, v in self.sessions.items() if v['expires'] > now}
            self.attempts[ip] = [t for t in self.attempts.get(ip, []) if now - t < 300]
            if len(self.attempts[ip]) >= 10:
                raise ServiceError('Слишком много попыток. Подождите 5 минут.', 429)
            found = self.repository.read_users().get(username)
            if not found or not hmac.compare_digest(password_hash(password, found['salt']), found['hash']):
                self.attempts[ip].append(now)
                raise ServiceError('Неверный логин или пароль', 401)
            user = {k: v for k, v in found.items() if k not in ('salt', 'hash')}
            user['username'] = username
            session = secrets.token_urlsafe(32)
            self.sessions[session] = {'user': user, 'expires': now + self.session_seconds}
            self.repository.audit(user, 'Вход')
            return session, user

    def current_user(self, session: str) -> dict:
        with self._lock:
            value = self.sessions.get(session)
            if not value or value['expires'] < time.time():
                raise ServiceError('Войдите в систему', 401)
            return dict(value['user'])

    def logout(self, session: str) -> None:
        with self._lock:
            self.sessions.pop(session, None)

    def create_user(self, username: str, password: str, role: str, department: str = '', employee: str = '') -> None:
        if not username.strip() or len(username) > 100 or role not in ROLES:
            raise ServiceError('Некорректный логин или роль')
        if not 12 <= len(password) <= 200:
            raise ServiceError('Пароль должен содержать от 12 до 200 символов')
        if role == 'manager' and not department:
            raise ServiceError('Укажите --department')
        if role == 'employee' and not employee:
            raise ServiceError('Укажите --employee "Фамилия Имя"')
        key = self.repository.key()
        salt = secrets.token_hex(16)
        record = dict(role=role, department=department,
                      employee_id=token(employee, base64.urlsafe_b64decode(key)) if employee else '',
                      salt=salt, hash=password_hash(password, salt))
        self.repository.add_user(username, record)
