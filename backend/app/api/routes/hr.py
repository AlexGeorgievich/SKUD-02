from fastapi import APIRouter, Depends
from ...container import Container
from ...domain.errors import ServiceError
from ..dependencies import current_user, get_container
from ...hr.schemas import HrEmployeeUpdate, HrImportRows

router = APIRouter(prefix='/api/hr', tags=['hr'])


def required_service(c: Container):
    if c.hr is None:
        raise ServiceError('Кадровая база не подключена. Настройте DATABASE_URL.', 503)
    return c.hr


def serialize(employee):
    return {column.name: getattr(employee, column.name) for column in employee.__table__.columns}


def can_view(user: dict, employee) -> bool:
    role = user['role']
    if role in ('admin', 'hr', 'timekeeper', 'executive', 'auditor'):
        return True
    if role == 'manager':
        return employee.plan_department == user.get('department')
    if role == 'employee':
        return employee.plan_name == user.get('employee') or employee.plan_employee_id == user.get('employee_id')
    return False


@router.get('/employees')
def employees(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    service = required_service(c)
    items = [employee for employee in service.repository.list_employees() if can_view(user, employee)]
    return {'items': [serialize(employee) for employee in items], 'count': len(items)}


@router.get('/employees/{employee_id}')
def employee(employee_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    service = required_service(c)
    item = service.repository.get_employee(employee_id)
    if item is None or not can_view(user, item):
        raise ServiceError('Карточка сотрудника не найдена', 404)
    return serialize(item)


@router.patch('/employees/{employee_id}')
def update_employee(employee_id: str, payload: HrEmployeeUpdate, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на изменение кадровых данных', 403)
    service = required_service(c)
    item = service.repository.get_employee(employee_id)
    if item is None:
        raise ServiceError('Карточка сотрудника не найдена', 404)
    values = payload.model_dump(exclude_unset=True)
    updated = service.repository.update_safe_fields(item.id, values)
    service.repository.add_audit(user['username'], 'update', 'employee', item.id, values, 'manual')
    return serialize(updated)


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
