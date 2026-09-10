from fastapi import Depends, Request
from ..container import Container

def get_container(request: Request) -> Container:
    return request.app.state.container

def current_user(request: Request, container: Container = Depends(get_container)) -> dict:
    return container.auth.current_user(request.cookies.get('tt_session', ''))
