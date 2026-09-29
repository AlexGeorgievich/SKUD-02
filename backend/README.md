# Backend

> В `feature/hr-lifecycle-admin` доступны `/api/hr/*`, `/api/admin/*` и `/api/uvr/periods/*`: нормализованный КУС, права и архивирование, admin-only CRUD кадровых справочников, история источников УВР, ручное сопоставление к UUID, расчётный снимок Plan–факт и PostgreSQL backup. См. [../docs/CURRENT_STATE.md](../docs/CURRENT_STATE.md).

Python/FastAPI. Запуск из корня проекта:

```powershell
python -m pip install -r backend/requirements.txt
python -m backend.app.cli user admin
python -m uvicorn backend.app.main:create_app --factory --host 127.0.0.1 --port 8000 --workers 1
python -m unittest discover -s backend/tests -t . -v
```

`app/main.py` создаёт приложение; `app/container.py` связывает сервисы и файловое хранилище. Каждый экземпляр имеет собственные сессии, настройки и сервисы. Тесты используют временные каталоги через Settings, не подменяют глобальный путь данных.

API → services → domain/infrastructure. Домен не импортирует FastAPI, openpyxl или файловое хранилище. Контракт хранения — `services/ports.py`; реализация — `infrastructure/repository.py`. Excel-адаптеры — `infrastructure/excel/`.

`uvr/` хранит версии исходных файлов Plan/СКУД/СК и версии расчётов с фиксированными ссылками на точные версии источников. Endpoint `/api/uvr/periods/{period}/calculate` рассчитывает по UUID КУС; версия расчёта доступна через `/calculation` и показывается в разделе месячной загрузки.

Миграция `0010_kus_card_catalog_admin` добавляет место рождения и `position_id`, нормализуя существующие должности без замены UUID сотрудников. HR читает справочники через `/api/hr/catalogs`; менять юридические лица, офисы, отделы и должности можно только через `/api/admin/catalogs*`. Удаление элемента отклоняется, пока на него ссылается хотя бы одна карточка.

Данные — в корневой `data/` либо в TIMETRACK_DATA. HTTP раздаёт только frontend/dist. Запуск локальный, однопроцессный.
