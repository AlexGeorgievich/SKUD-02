"""Composition root: one service container per application instance."""
from dataclasses import dataclass
from .config import Settings
from .infrastructure.repository import FileRepository
from .services.auth import AuthService
from .services.imports import ImportService
from .services.reports import ReportService
from .services.ports import Repository
from .hr.repository import HrRepository
from .hr.service import HrService
from sqlalchemy import create_engine

@dataclass
class Container:
    settings: Settings
    repository: Repository
    auth: AuthService
    imports: ImportService
    reports: ReportService
    hr: HrService | None = None

def build_container(settings: Settings, repository: Repository | None = None) -> Container:
    repo = repository if repository is not None else FileRepository(settings.data_dir)
    hr_service = None
    if settings.database_url:
        hr_service = HrService(HrRepository(create_engine(settings.database_url)))
    return Container(settings, repo, AuthService(repo, settings.session_seconds), ImportService(repo, hr_service), ReportService(repo), hr_service)
