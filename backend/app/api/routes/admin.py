import subprocess
from uuid import uuid4

from fastapi import APIRouter, Depends

from ...container import Container
from ...domain.errors import ServiceError
from ...admin.backup_runner import BackupRunner
from ..dependencies import current_user, get_container


router = APIRouter(prefix="/api/admin", tags=["admin"])
restore_requests: dict[str, dict] = {}


def require_admin(user: dict) -> None:
    if user["role"] != "admin":
        raise ServiceError("Нет права на администрирование", 403)


@router.get("/users")
def users(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    require_admin(user)
    items = []
    for username, record in c.repository.read_users().items():
        items.append({
            "username": username,
            "role": record.get("role"),
            "department": record.get("department", ""),
        })
    return {"items": sorted(items, key=lambda item: item["username"])}


@router.post("/backups", status_code=201)
def create_backup(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    require_admin(user)
    if not c.settings.database_url.startswith("postgresql"):
        raise ServiceError("Резервное копирование доступно только для PostgreSQL", 503)
    try:
        return BackupRunner(c.settings.database_url, c.settings.backup_dir).create()
    except (OSError, subprocess.CalledProcessError):
        raise ServiceError("Не удалось создать или проверить резервную копию", 503)


@router.post("/restore-requests", status_code=201)
def create_restore_request(payload: dict, user: dict = Depends(current_user)):
    require_admin(user)
    backup_id = str(payload.get("backup_id") or "").strip()
    if not backup_id:
        raise ServiceError("Укажите идентификатор резервной копии", 400)
    request_id = str(uuid4())
    phrase = f"RESTORE {backup_id}"
    restore_requests[request_id] = {"backup_id": backup_id, "author": user["username"], "phrase": phrase}
    return {"id": request_id, "confirmation_phrase": phrase}
