from fastapi import APIRouter, Depends, Response
from ...container import Container
from ..dependencies import current_user, get_container

router = APIRouter(prefix='/api', tags=['reports'])

@router.get('/result')
def result(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    return c.reports.result(user)

@router.get('/export')
def export(department: str = '', employee: str = '', view: str = 'all', anonymous: bool = False, search: str = '', user: dict = Depends(current_user), c: Container = Depends(get_container)):
    blob = c.reports.export(user, department, employee, view, anonymous, search)
    return Response(blob, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers={'Content-Disposition': 'attachment; filename="timetrack-report.xlsx"'})

@router.get('/audit')
def audit(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    return c.reports.audit(user)
