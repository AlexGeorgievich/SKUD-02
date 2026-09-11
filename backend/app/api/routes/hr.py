from fastapi import APIRouter, Depends, Query
from ...container import Container
from ...domain.errors import ServiceError
from ..dependencies import current_user, get_container
from ...hr.schemas import HrEmployeeCreate, HrEmployeeUpdate, HrImportRows

router = APIRouter(prefix='/api/hr', tags=['hr'])


def required_service(c: Container):
    if c.hr is None:
        raise ServiceError('Кадровая база не подключена. Настройте DATABASE_URL.', 503)
    return c.hr


def serialize(employee, mode: str = "edit"):
    return {**{column.name: getattr(employee, column.name) for column in employee.__table__.columns}, "mode": mode}


def can_view(user: dict, employee) -> bool:
    role = user['role']
    if role in ('admin', 'hr', 'timekeeper', 'executive', 'auditor'):
        return True
    if role == 'manager':
        return employee.plan_department == user.get('department')
    if role == 'employee':
        return employee.plan_name == user.get('employee') or employee.plan_employee_id == user.get('employee_id')
    return False


@router.get('/analytics')
def analytics(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr', 'timekeeper', 'executive', 'auditor', 'manager'):
        raise ServiceError('Нет права на кадровую аналитику', 403)
    return required_service(c).analytics()


@router.get('/calendar')
def calendar(month: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr', 'timekeeper', 'executive', 'auditor', 'manager'):
        raise ServiceError('Нет права на кадровый календарь', 403)
    return {'items': required_service(c).calendar_events(month)}


@router.get('/employees')
def employees(archived: bool = False, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if archived and user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на просмотр кадрового архива', 403)
    service = required_service(c)
    items = [employee for employee in service.repository.list_employees(archived=archived) if can_view(user, employee)]
    return {'items': [serialize(employee) for employee in items], 'count': len(items)}


@router.post('/employees', status_code=201)
def create_employee(payload: HrEmployeeCreate, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на создание кадровых данных', 403)
    try:
        item = required_service(c).create_employee(payload.model_dump(exclude_unset=True), user['username'])
    except ValueError as error:
        raise ServiceError(str(error), 400)
    return serialize(item)


@router.get('/employees/{employee_id}/read-only')
def employee_read_only(employee_id: str, source: str = Query("timetrack"), user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if source != "timetrack":
        raise ServiceError("Недопустимый источник карточки", 400)
    service = required_service(c)
    item = service.repository.get_employee(employee_id)
    if item is None or not can_view(user, item):
        raise ServiceError('Карточка сотрудника не найдена', 404)
    return serialize(item, mode="read-only")


@router.get('/employees/{employee_id}')
def employee(employee_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    service = required_service(c)
    item = service.repository.get_employee(employee_id)
    if item is None or not can_view(user, item):
        raise ServiceError('Карточка сотрудника не найдена', 404)
    return serialize(item)


@router.patch('/employees/{employee_id}')
def update_employee(employee_id: str, payload: HrEmployeeUpdate, source: str | None = None, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if source == "timetrack":
        raise ServiceError('Карточка TimeTrack доступна только для просмотра', 403)
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на изменение кадровых данных', 403)
    service = required_service(c)
    item = service.repository.get_employee(employee_id)
    if item is None:
        raise ServiceError('Карточка сотрудника не найдена', 404)
    values = payload.model_dump(exclude_unset=True)
    updated = service.update_employee(item.id, values, user['username'])
    return serialize(updated)


@router.post('/employees/{employee_id}/archive')
def archive_employee(employee_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на архивирование кадровых данных', 403)
    service = required_service(c)
    try:
        return serialize(service.archive_employee(employee_id, user['username']))
    except KeyError:
        raise ServiceError('Карточка сотрудника не найдена', 404)


@router.post('/employees/{employee_id}/restore')
def restore_employee(employee_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на восстановление кадровых данных', 403)
    service = required_service(c)
    try:
        return serialize(service.restore_employee(employee_id, user['username']))
    except KeyError:
        raise ServiceError('Карточка сотрудника не найдена', 404)


@router.post('/import/preview')
def import_preview(payload: HrImportRows, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на кадровый импорт', 403)
    return required_service(c).preview_rows(payload.rows)


@router.post('/import/apply')
def import_apply(payload: HrImportRows, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на кадровый импорт', 403)
    return required_service(c).apply_rows(payload.rows, user['username'])
