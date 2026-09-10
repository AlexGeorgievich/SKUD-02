"""Composition root: one service container per application instance."""
from dataclasses import dataclass
from .config import Settings
from .infrastructure.repository import FileRepository
from .services.auth import AuthService
from .services.imports import ImportService
from .services.reports import ReportService
from .services.ports import Repository

@dataclass
class Container:
    settings: Settings
    repository: Repository
    auth: AuthService
    imports: ImportService
    reports: ReportService

def build_container(settings: Settings, repository: Repository | None = None) -> Container:
    repo = repository if repository is not None else FileRepository(settings.data_dir)
    return Container(settings, repo, AuthService(repo, settings.session_seconds), ImportService(repo), ReportService(repo))
