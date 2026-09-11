from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .api.routes import admin, auth, imports, reports, hr
from .config import Settings
from .container import build_container
from .domain.errors import ServiceError
from .services.ports import Repository

def create_app(settings: Settings | None = None, repository: Repository | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title='TimeTrack Pro — PPL Group', version='0.3.0', docs_url=None, redoc_url=None)
    app.state.container = build_container(settings, repository)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.allowed_hosts))

    @app.exception_handler(ServiceError)
    async def service_error(request: Request, exc: ServiceError):
        return JSONResponse({'detail': str(exc)}, status_code=exc.status)

    @app.exception_handler(ValueError)
    async def invalid_input(request: Request, exc: ValueError):
        return JSONResponse({'detail': str(exc)}, status_code=400)

    @app.middleware('http')
    async def secure(request: Request, call_next):
        origin = request.headers.get('origin')
        if request.method not in ('GET', 'HEAD') and origin and origin not in settings.allowed_origins:
            return Response('Origin rejected', 403)
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'"
        return response

    for router in (auth.router, imports.router, reports.router, hr.router, admin.router):
        app.include_router(router)

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'version': '0.3.0'}

    @app.get('/')
    def home():
        path = settings.frontend_dir / 'index.html'
        if not path.exists():
            return JSONResponse({'detail': 'React-сборка отсутствует. Выполните npm run build в frontend.'}, status_code=503)
        return FileResponse(path)

    app.mount('/static/react', StaticFiles(directory=settings.frontend_dir, check_dir=False), name='frontend')
    return app
