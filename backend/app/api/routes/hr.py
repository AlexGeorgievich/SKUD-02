import base64

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi.responses import FileResponse
from ...container import Container
from ...domain.errors import ServiceError
from ..dependencies import current_user, get_container
from ...hr.schemas import HrDepartmentCreate, HrEmployeeCreate, HrEmployeeUpdate, HrImportRows, HrXlsxApply
from ...domain.identity import token
from ...hr.photos import MAX_PHOTO_BYTES, image_extension, photo_file, save_photo
from ...hr.import_service import HrXlsxService

router = APIRouter(prefix='/api/hr', tags=['hr'])


def required_service(c: Container):
    if c.hr is None:
        raise ServiceError('Кадровая база не подключена. Настройте DATABASE_URL.', 503)
    return c.hr


def serialize(employee, mode: str = "edit"):
    return {**{column.name: getattr(employee, column.name) for column in employee.__table__.columns}, "mode": mode}


PRIVATE_FIELDS = {
    'birth_date', 'birth_month', 'birth_year', 'personal_phone', 'telegram', 'work_email',
    'work_phone', 'insurance', 'comments', 'recommendation', 'recruiter', 'photo_source_url',
    'mail_image_url', 'photo_path', 'business_card', 'academic_degree', 'education_institution',
    'education_specialty', 'education_graduation_year', 'education_graduation_month',
    'education_graduation_date', 'work_experience', 'access_card_number', 'access_card_status',
}


def serialize_employee(employee, user: dict, detail: bool = False, mode: str | None = None) -> dict:
    role = user['role']
    card = {column.name: getattr(employee, column.name) for column in employee.__table__.columns}
    if not detail:
        card.pop('plan_employee_id', None)
    card.pop('photo_path', None)
    if not detail or role == 'timekeeper':
        for field in PRIVATE_FIELDS:
            card.pop(field, None)
    if role == 'auditor':
        card = {key: card.get(key) for key in ('id', 'department', 'office', 'position', 'employment_status')}
    elif employee.photo_path and detail and role not in ('timekeeper', 'auditor'):
        card['photo_url'] = f"/api/hr/employees/{employee.id}/photo"
    card['mode'] = mode or ('edit' if role in ('admin', 'hr') else 'read-only')
    return card


def can_view(user: dict, employee, key: str | None = None) -> bool:
    role = user['role']
    if role in ('admin', 'hr', 'timekeeper', 'auditor'):
        return True
    if role == 'executive':
        return bool(user.get('office_id') and employee.office_id == user['office_id']) or bool(user.get('office') and employee.office == user['office'])
    if role == 'manager':
        return bool(user.get('department_id') and employee.department_id == user['department_id']) or bool(user.get('department') and employee.department == user['department'])
    if role == 'employee':
        if user.get('employee_uuid') == employee.id:
            return True
        legacy_id = user.get('employee_id')
        if key and legacy_id:
            secret = base64.urlsafe_b64decode(key)
            name_parts = employee.plan_name.split()
            if len(name_parts) >= 2:
                return legacy_id == token(' '.join(name_parts[:2]), secret)
        return False
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
    items = [employee for employee in service.repository.list_employees(archived=archived) if can_view(user, employee, c.auth.repository.key())]
    return {'items': [serialize_employee(employee, user) for employee in items], 'count': len(items)}


@router.get('/departments')
def departments(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr', 'timekeeper', 'executive', 'auditor', 'manager'):
        raise ServiceError('Нет права на просмотр отделов', 403)
    return {'items': [serialize(department) for department in required_service(c).repository.list_departments()]}


@router.get('/catalogs')
def catalogs(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr', 'timekeeper', 'executive', 'auditor', 'manager'):
        raise ServiceError('Нет права на справочники', 403)
    return {kind: [serialize(item) for item in items]
            for kind, items in required_service(c).repository.catalog_items().items()}


@router.post('/departments', status_code=201)
def create_department(payload: HrDepartmentCreate, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на создание отдела', 403)
    try:
        return serialize(required_service(c).create_department(payload.name, payload.head_id, user['username']))
    except ValueError as error:
        raise ServiceError(str(error), 400)


@router.post('/employees', status_code=201)
def create_employee(payload: HrEmployeeCreate, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на создание кадровых данных', 403)
    try:
        item = required_service(c).create_employee(payload.model_dump(exclude_unset=True), user['username'])
    except ValueError as error:
        raise ServiceError(str(error), 400)
    return serialize_employee(item, user, detail=True)


@router.get('/employees/{employee_id}/read-only')
def employee_read_only(employee_id: str, source: str = Query("timetrack"), name: str | None = Query(None), user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if source != "timetrack":
        raise ServiceError("Недопустимый источник карточки", 400)
    service = required_service(c)
    item = service.repository.get_employee(employee_id)
    if item is None and name:
        item = service.repository.get_employee_by_name(name)
    if item is None or not can_view(user, item, c.auth.repository.key()):
        raise ServiceError('Карточка сотрудника не найдена', 404)
    return serialize_employee(item, user, detail=True, mode="read-only")


@router.get('/employees/{employee_id}')
def employee(employee_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    service = required_service(c)
    item = service.repository.get_employee(employee_id)
    if item is None or not can_view(user, item, c.auth.repository.key()):
        raise ServiceError('Карточка сотрудника не найдена', 404)
    return serialize_employee(item, user, detail=True)


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
    try:
        updated = service.update_employee(item.id, values, user['username'])
    except ValueError as error:
        raise ServiceError(str(error), 400)
    return serialize_employee(updated, user, detail=True)


@router.post('/employees/{employee_id}/photo')
async def upload_photo(employee_id: str, photo: UploadFile = File(...), user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на загрузку фото', 403)
    repository = required_service(c).repository
    employee = repository.get_employee(employee_id)
    if employee is None:
        raise ServiceError('Карточка сотрудника не найдена', 404)
    blob = await photo.read(MAX_PHOTO_BYTES + 1)
    try:
        image_extension(blob)
    except ValueError as error:
        raise ServiceError(str(error), 400)
    name = save_photo(c.settings.data_dir, employee.id, blob)
    repository.set_photo_path(employee.id, name)
    repository.add_audit(user['username'], 'photo_upload', 'employee', employee.id, {'file': name}, 'manual')
    return {'photo_url': f'/api/hr/employees/{employee.id}/photo'}


@router.get('/employees/{employee_id}/photo')
def get_photo(employee_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    employee = required_service(c).repository.get_employee(employee_id)
    if user['role'] in ('timekeeper', 'auditor') or employee is None or not can_view(user, employee, c.auth.repository.key()):
        raise ServiceError('Фото сотрудника не найдено', 404)
    path = photo_file(c.settings.data_dir, employee.photo_path)
    if path is None:
        raise ServiceError('Фото сотрудника не найдено', 404)
    return FileResponse(path)


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


@router.post('/xlsx/preview')
async def xlsx_preview(file: UploadFile = File(...), user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на кадровый импорт', 403)
    blob = await file.read(c.settings.upload_limit + 1)
    if len(blob) > c.settings.upload_limit:
        raise ServiceError('Файл превышает допустимый размер', 413)
    try:
        return HrXlsxService(required_service(c).repository).preview(blob, user['username'])
    except ValueError as error:
        raise ServiceError(str(error), 400)


@router.post('/xlsx/apply')
def xlsx_apply(payload: HrXlsxApply, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на кадровый импорт', 403)
    try:
        return HrXlsxService(required_service(c).repository).apply(payload.batch_id, payload.confirm_archive_ids, user['username'])
    except KeyError:
        raise ServiceError('Пакет preview не найден', 404)
    except ValueError as error:
        raise ServiceError(str(error), 400)


@router.get('/xlsx/export')
def xlsx_export(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in ('admin', 'hr'):
        raise ServiceError('Нет права на кадровый экспорт', 403)
    blob = HrXlsxService(required_service(c).repository).export()
    required_service(c).repository.add_audit(user['username'], 'hr_xlsx_export', 'registry', 'active', None, 'hr_export')
    return Response(
        content=blob,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="HR-export.xlsx"'},
    )
