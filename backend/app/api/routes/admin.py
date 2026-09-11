from fastapi import APIRouter, Depends

from ...container import Container
from ...domain.errors import ServiceError
from ..dependencies import current_user, get_container


router = APIRouter(prefix="/api/admin", tags=["admin"])


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


@router.post("/backups")
def create_backup(user: dict = Depends(current_user)):
    require_admin(user)
    raise ServiceError("Резервное копирование будет доступно после подключения PostgreSQL backup-service", 501)
