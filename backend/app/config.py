"""Configuration independent of the web framework and current working directory."""
import os
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

@dataclass(frozen=True)
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get('TIMETRACK_DATA', PROJECT_ROOT / 'data')).resolve())
    frontend_dir: Path = PROJECT_ROOT / 'frontend' / 'dist'
    allowed_hosts: tuple[str, ...] = ('localhost', '127.0.0.1')
    allowed_origins: tuple[str, ...] = ('http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:8001', 'http://127.0.0.1:8001')
    upload_limit: int = 20 * 1024 * 1024
    session_seconds: int = 28800
    database_url: str = field(default_factory=lambda: os.environ.get('DATABASE_URL', ''))
    backup_dir: Path = field(default_factory=lambda: Path(os.environ.get('TIMETRACK_BACKUP_DIR', '/app/backups')).resolve())
    database_required: bool = field(default_factory=lambda: os.environ.get('DATABASE_REQUIRED') == '1')
