# Backend

Python/FastAPI. Запуск из корня проекта:

```powershell
python -m pip install -r backend/requirements.txt
python -m backend.app.cli user admin
python -m uvicorn backend.app.main:create_app --factory --host 127.0.0.1 --port 8000 --workers 1
python -m unittest discover -s backend/tests -t . -v
```

`app/main.py` создаёт приложение; `app/container.py` связывает сервисы и файловое хранилище. Каждый экземпляр имеет собственные сессии, настройки и сервисы. Тесты используют временные каталоги через Settings, не подменяют глобальный путь данных.

API → services → domain/infrastructure. Домен не импортирует FastAPI, openpyxl или файловое хранилище. Контракт хранения — `services/ports.py`; реализация — `infrastructure/repository.py`. Excel-адаптеры — `infrastructure/excel/`.

Данные — в корневой `data/` либо в TIMETRACK_DATA. HTTP раздаёт только frontend/dist. Запуск локальный, однопроцессный.
