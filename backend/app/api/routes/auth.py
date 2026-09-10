from fastapi import APIRouter, Depends, Request, Response
from ...container import Container
from ...domain.access import ROLES
from ..dependencies import current_user, get_container
from ..schemas import LoginRequest

router = APIRouter(prefix='/api', tags=['auth'])

@router.post('/login')
def login(body: LoginRequest, request: Request, response: Response, c: Container = Depends(get_container)):
    session, user = c.auth.login(body.username, body.password, request.client.host if request.client else 'local')
    response.set_cookie('tt_session', session, httponly=True, samesite='strict', max_age=c.settings.session_seconds)
    return user

@router.post('/logout')
def logout(request: Request, response: Response, c: Container = Depends(get_container)):
    c.auth.logout(request.cookies.get('tt_session', ''))
    response.delete_cookie('tt_session')
    return {'ok': True}

@router.get('/me')
def me(user: dict = Depends(current_user)):
    return {**user, 'role_label': ROLES[user['role']]}
