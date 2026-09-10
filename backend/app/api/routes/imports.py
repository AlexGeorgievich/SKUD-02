from datetime import date
from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from starlette.concurrency import run_in_threadpool
from ...container import Container
from ...domain.access import WRITERS
from ...domain.errors import ServiceError
from ..dependencies import current_user, get_container

router = APIRouter(prefix='/api', tags=['imports'])

@router.post('/import')
async def import_files(plan: UploadFile = File(...), fact: UploadFile = File(...), period: str = Form(...), asof: date = Form(...), preview: bool = Form(False), user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user['role'] not in WRITERS:
        raise ServiceError('Нет права на импорт', 403)
    if any(not (f.filename or '').lower().endswith('.xlsx') for f in (plan, fact)):
        raise ServiceError('Поддерживается только .xlsx')
    blobs = [await f.read(c.settings.upload_limit + 1) for f in (plan, fact)]
    if any(len(b) > c.settings.upload_limit for b in blobs):
        raise ServiceError('Файл превышает 20 МБ')
    return await run_in_threadpool(c.imports.run, user, *blobs, period, asof, preview)

@router.get('/demo')
def demo(period: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    return Response(c.imports.demo(period), media_type='application/zip', headers={'Content-Disposition': 'attachment; filename="demo-inputs.zip"'})
