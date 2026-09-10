@echo off
cd /d "%~dp0"
if not exist frontend\dist\index.html (
  echo React build is missing. See README.md: frontend build instructions.
  goto fail
)
if not exist .venv\Scripts\python.exe (
  py -3 -m venv .venv
  if errorlevel 1 goto fail
)
if not exist .venv\timetrack-0.3.0.ready (
  .venv\Scripts\python.exe -m pip install -r requirements.txt
  if errorlevel 1 goto fail
  .venv\Scripts\python.exe -c "from pathlib import Path; Path('.venv/timetrack-0.3.0.ready').touch()"
)
if not exist data\users.json (
  .venv\Scripts\python.exe manage.py user admin
  if errorlevel 1 goto fail
)
echo Open http://127.0.0.1:8000 in your browser. Ctrl+C to stop.
.venv\Scripts\python.exe -m uvicorn backend.app.main:create_app --factory --host 127.0.0.1 --port 8000 --workers 1
pause
exit /b
:fail
echo Setup failed. See README.md. Python 3.12 or newer is required.
pause
