import subprocess
from uuid import uuid4

from fastapi import APIRouter, Depends, Response

from ...container import Container
from ...domain.errors import ServiceError
from ...admin.backup_runner import BackupRunner
from ...admin.catalog_service import AdminCatalogService
from ...hr.schemas import AdminCatalogCreate, AdminCatalogUpdate
from ..dependencies import current_user, get_container


router = APIRouter(prefix="/api/admin", tags=["admin"])
restore_requests: dict[str, dict] = {}


def require_admin(user: dict) -> None:
    if user["role"] != "admin":
        raise ServiceError("Нет права на администрирование", 403)


def catalog_service(c: Container) -> AdminCatalogService:
    if c.hr is None:
        raise ServiceError("Кадровая база не подключена", 503)
    return AdminCatalogService(c.hr.repository)


def catalog_error(error: Exception):
    if isinstance(error, KeyError):
        raise ServiceError("Значение справочника не найдено", 404)
    if isinstance(error, FileExistsError):
        raise ServiceError(str(error), 409)
    if isinstance(error, PermissionError):
        raise ServiceError(f"Удаление запрещено: существуют зависимости {error.args[0]}", 409)
    raise ServiceError(str(error), 400)


@router.get("/catalogs")
def catalogs(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    require_admin(user)
    return catalog_service(c).list_all()


@router.post("/catalogs/{kind}", status_code=201)
def create_catalog(kind: str, payload: AdminCatalogCreate, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    require_admin(user)
    try:
        return catalog_service(c).create(kind, payload.model_dump(exclude_unset=True), user["username"])
    except (KeyError, FileExistsError, PermissionError, ValueError) as error:
        catalog_error(error)


@router.patch("/catalogs/{kind}/{item_id}")
def update_catalog(kind: str, item_id: str, payload: AdminCatalogUpdate, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    require_admin(user)
    try:
        return catalog_service(c).update(kind, item_id, payload.model_dump(exclude_unset=True), user["username"])
    except (KeyError, FileExistsError, PermissionError, ValueError) as error:
        catalog_error(error)


@router.delete("/catalogs/{kind}/{item_id}", status_code=204)
def delete_catalog(kind: str, item_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    require_admin(user)
    try:
        catalog_service(c).delete(kind, item_id, user["username"])
        return Response(status_code=204)
    except (KeyError, FileExistsError, PermissionError, ValueError) as error:
        catalog_error(error)


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


@router.post("/restore-requests/{request_id}/confirm")
def confirm_restore_request(request_id: str, payload: dict, user: dict = Depends(current_user)):
    require_admin(user)
    request = restore_requests.get(request_id)
    if request is None:
        raise ServiceError("Заявка на восстановление не найдена", 404)
    if payload.get("confirmation") != request["phrase"]:
        raise ServiceError("Фраза подтверждения не совпадает", 400)
    return {"id": request_id, "status": "confirmed", "backup_id": request["backup_id"]}
