# КУС, месячная история УВР и отчёт СК: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать КУС источником списочного состава, безопасно импортировать план/СКУД/СК по UUID КУС, хранить версии месяцев и выпускать кадровый и демонстрационный Excel.

**Architecture:** PostgreSQL хранит нормализованный КУС, справочники, решения сопоставления и версии месячных источников. Существующие файловые снимки УВР читаются для совместимости. React показывает HR-карточку, справочники, preview конфликтов и месячные источники; API проверяет права и область видимости каждого ответа.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL 16, openpyxl для серверного импорта/экспорта, React/TypeScript/Vite, Vitest; `@oai/artifact-tool` для создания `demo/Demo-control.xlsx`.

**Spec:** `docs/superpowers/specs/2026-09-25-kus-roster-uvr-control-design.md`

## Global Constraints

- Работать в `feature/hr-lifecycle-admin`; три ручные тестовые карточки сохраняются.
- План больше не создаёт и не изменяет КУС ни в демо, ни в рабочем контуре. ФИО плана служит только для сопоставления и источника месячного снимка.
- Не менять закрытые месяцы при изменении КУС; исправление закрытого месяца создаёт версию с автором и причиной.
- Права проверяются сервером. Сотрудник видит только свои сведения без права записи; переход из УВР всегда read-only.
- Отсутствие регистрации СКУД и текст «Прогулы/переработки» СК не устанавливают прогул автоматически.
- Реальные данные не смешивать с демо; не печатать `.env`, контакты или ФИО в диагностические логи.
- Перед миграцией действующего PostgreSQL сделать и проверить backup; не выполнять `docker compose down -v`.
- Создать файл с точным именем `demo/Demo-control.xlsx` для августа 2026.

## Review Focus

- Два одинаковых ФИО в разных отделах: preview не связывает строку только по имени; тест Task 5.
- ФИО изменено HR после закрытия месяца: старый снимок и ссылка по UUID остаются прежними; тест Task 6.
- Источник содержит неизвестного человека: пакет блокируется до решения и не создаёт КУС; тест Task 5.
- Кадровый Excel содержит неполную дату рождения, а телефон/email/Telegram ошибочны: preview отмечает только соответствующие поля/строки; тест Task 3.
- Сотрудник обращается к чужой карточке или пытается PATCH: сервер отвечает 404/403 и не выдаёт личные поля в списке; тест Task 2.

---

## Карта файлов и интерфейсов

`backend/app/hr/models.py` и миграция `0008_kus_catalogs.py` владеют HR-схемой. `backend/app/hr/validation.py` приводит значения и проверяет форматы. `backend/app/hr/xlsx.py` отвечает за совместимый кадровый Excel. `backend/app/hr/matching.py` связывает строки источников с UUID КУС, не изменяя карточки. `backend/app/uvr/models.py`, `repository.py`, `service.py` отвечают за месячные версии; `backend/app/infrastructure/excel/control_reader.py` читает СК. API разделяется на `routes/hr.py` и новые `routes/uvr.py`; `frontend/src/features/hr/` и `frontend/src/features/import/` отображают эти сценарии. Большой `HrPage.tsx` разделяется на форму карточки и экран справочников при работе над ним. Старые `/api/import` и `/api/result` остаются совместимыми до подключения новых экранов.

### Task 1: Нормализовать КУС без потери старых ID

**Files:** Modify `backend/app/hr/models.py`; Create `backend/alembic/versions/0008_kus_catalogs.py`; Test `backend/tests/test_kus_migration.py`.

**Interfaces:** `HrEmployee.id` не меняется. Новые `HrOffice`, `HrLegalEntity`, `HrCatalogValue(kind,label)`, `HrDepartment.office_id`, `HrEmployee.department_id`, `office_id`, `legal_entity_id`, `gender_id`, `work_format_id`, `family_name`, `given_name`, `patronymic` доступны репозиторию. В `HrEmployee` также добавляются `position_en`, `telegram`, `personal_phone`, `business_card`, `academic_degree`, `recommendation`, `recruiter`, `photo_source_url`, `mail_image_url`, `insurance` и локальный `photo_path`. Существующие даты, образование, email, должность и комментарии используются повторно. Старые текстовые колонки остаются для совместимости.

- [ ] Написать тест Alembic `0007 → 0008` на SQLite и интеграционный тест PostgreSQL: две старые карточки сохраняют UUID; уникальные офис/отдел/пол переходят в справочники; три `manual:` карточки остаются.
- [ ] Запустить `python -m unittest backend.tests.test_kus_migration -v`; убедиться, что миграция/модели ещё отсутствуют.
- [ ] Добавить модели и `0008_kus_catalogs.py`: сначала nullable FK и новые колонки, затем перенос уникальных значений, затем индексы; не удалять `plan_name`, `plan_department`, `department`, `office`.
- [ ] Запустить узкий тест и `alembic -c backend/alembic.ini upgrade head` на пустой тестовой БД. Зафиксировать `feat: add normalized KUS catalogs`.

```python
class HrCatalogValue(Base):
    __tablename__ = "hr_catalog_values"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    __table_args__ = (UniqueConstraint("kind", "label"),)
```

### Task 2: Карточка, справочники, права и форматы

**Files:** Modify `backend/app/hr/schemas.py`, `repository.py`, `service.py`, `backend/app/api/routes/hr.py`, `backend/app/services/auth.py`, `backend/app/domain/access.py`; Create `backend/app/hr/validation.py`, `backend/app/hr/photos.py`; Test `backend/tests/test_kus_api.py`.

**Interfaces:** `HrService.create_employee(values,author)` и `update_employee(id,values,author)` принимают ID справочников и отдельные части ФИО. `GET /api/hr/catalogs` возвращает разрешённые значения. `serialize_employee(employee,user,detail=False)` возвращает проекцию по роли, а `read-only` всегда выставляет `mode="read-only"`.

- [ ] Тестами зафиксировать создание/обновление через ID справочников, принадлежность руководителя отделу, уникальный непустой табельный номер, формат `YYYY-MM-DD`, телефона, `@username`/`t.me` и email.
- [ ] Тестами зафиксировать: `employee` читает только свою карточку по UUID и не PATCH; `manager` только свой отдел; `executive` свой офис; `timekeeper` не получает личные поля в списке; `auditor` получает обезличенную проекцию. Для старой учётной записи сотрудника проверить безопасный переход с токена ФИО на UUID КУС.
- [ ] Тестами зафиксировать загрузку фото с проверкой типа/размера, выдачу только авторизованному читателю и отказ от автоматического скачивания `photo_source_url`.
- [ ] Запустить `python -m unittest backend.tests.test_kus_api -v` до реализации; затем добавить нормализацию и проверку FK на сервере, справочники, UUID-привязку учётных записей, ролевую сериализацию и локальный endpoint фото.
- [ ] Повторить тесты, проверить OpenAPI и зафиксировать `feat: validate KUS cards and scope HR responses`.

```python
def normalize_contact(kind: str, value: str | None) -> str | None:
    """Return canonical phone, Telegram or email; raise ValueError on invalid input."""

def serialize_employee(employee: HrEmployee, user: dict, detail: bool = False) -> dict:
    """Apply role and office/department scope before returning fields."""
```

### Task 3: Кадровый Excel с preview, сопоставлением и экспортом

**Files:** Create `backend/app/hr/xlsx.py`, `backend/app/hr/import_service.py`; Modify `backend/app/api/routes/hr.py`, `backend/app/hr/models.py`; Test `backend/tests/test_hr_xlsx.py`.

**Interfaces:** `parse_hr_xlsx(blob: bytes) -> list[HrSourceRow]` читает 25 заголовков `HH_bd.xlsx`; `preview_hr_xlsx(blob,user) -> HrPreview`; `apply_hr_preview(batch_id, decisions, user) -> dict`; `export_hr_xlsx(user) -> bytes` создаёт совместимый лист с 25 колонками.

- [ ] Тестами закрепить порядок заголовков, типы дат Excel, пустые значения, round-trip экспорт→preview, отсутствие записи до apply, обнаружение исчезнувших из полного файла карточек и ручное подтверждение архива.
- [ ] Добавить тест на неполную дату рождения и ошибки контактов из Review Focus; запуск до кода должен падать по отсутствующему API.
- [ ] Реализовать ограничение размера/распакованного XLSX, разбор шапки, построчные ошибки и хеш пакета. Решения привязать к `batch_id` и отпечатку исходного файла; применять в одной транзакции.
- [ ] Добавить `POST /api/hr/xlsx/preview`, `POST /api/hr/xlsx/apply`, `GET /api/hr/xlsx/export` для HR/admin, аудит импорта/экспорта; повторить тесты и зафиксировать `feat: add reviewed HR Excel exchange`.

```python
HR_HEADERS = ("ФИО", "Должность", "Должность англ.", "Отдел", "Руководитель", "Юр.лицо", "Формат работы", "Дата выхода", "Дата окончания ИС", "Пол", "ДР Месяц", "День рождения", "Визитка", "ТГ", "Телефон", "Почта", "Образование", "Уч. степень", "Специальность", "Рекомендация", "Рекрутер (HR)", "Ссылка на фото", "Ссылка на картинку в почте", "Комментарии", "Страховка")
```

### Task 4: HR-интерфейс карточки и справочников

**Files:** Modify `frontend/src/features/hr/HrPage.tsx`; Create `frontend/src/features/hr/HrEmployeeCard.tsx`, `HrCatalogs.tsx`, `frontend/src/features/hr/hrTypes.ts`; Modify `frontend/src/shared/styles/react.css`; Test `frontend/src/tests/components.test.tsx`.

**Interfaces:** `HrEmployeeCard` принимает `employee`, `catalogs`, `mode`, `onSave`; `HrCatalogs` работает через `/api/hr/catalogs`. Карточка показывает локальное фото из авторизованного endpoint и исходную ссылку отдельно. Состояние поиска/фильтров остаётся в `HrPage`.

- [ ] Добавить компонентные тесты на три поля ФИО, все 25 полей Excel, табельный номер, списки офисов/отделов/юрлиц, выбор руководителя своего отдела, ошибки даты/контактов, загрузку/показ фото, read-only из УВР и видимость личных вкладок по роли.
- [ ] Запустить `npm test -- --run src/tests/components.test.tsx` до реализации; вынести форму из `HrPage` и подключить новые API без изменения существующих маршрутов УВР.
- [ ] Добавить отдельный экран «Справочники» для HR, preview/apply и экспорт кадрового Excel; обеспечить клавиатурную навигацию и отсутствие горизонтального обрезания на ширине целевого экрана.
- [ ] Запустить `npm test` и `npm run build`; проверить в браузере на 8001 карточку и строку отделов; зафиксировать `feat: add HR catalogs and accessible KUS card`.

### Task 5: Сопоставлять план, СКУД и СК только с КУС

**Files:** Create `backend/app/hr/matching.py`; Modify `backend/app/services/imports.py`, `backend/app/infrastructure/excel/reader.py`, `backend/app/api/routes/imports.py`; Test `backend/tests/test_source_matching.py`.

**Interfaces:** `preview_source(rows: list[dict], kind: str, roster: list[HrEmployee]) -> list[MatchRow]` возвращает `row_number`, исходное ФИО/отдел, `candidate_ids`, `status`; `resolve_source(preview, decisions) -> dict[int,str]` возвращает подтверждённые UUID. Ни один метод не пишет в КУС.

- [ ] Зафиксировать тестами: полное совпадение ФИО/отдела; два одинаковых ФИО; неизвестный работник; строка СКУД без отдела; неизвестный сотрудник СКУД при известном плане; повторное применение решений.
- [ ] Написать регрессионный тест, что `ImportService.run(...)` больше не вызывает `bootstrap_from_plan`, а ФИО/отдел КУС не меняются после загрузки плана.
- [ ] Изменить Excel reader так, чтобы дубли ФИО не отбрасывались до preview, и добавить API preview с решениями по номеру строки. Запретить apply при незавершённых решениях; зафиксировать `feat: match UWR sources against KUS roster`.

```python
@dataclass(frozen=True)
class MatchRow:
    row_number: int
    source_name: str
    source_department: str | None
    candidate_ids: tuple[str, ...]
    status: str  # matched | ambiguous | unknown | rejected
```

### Task 6: Хранить месяцы и версии источников

**Files:** Create `backend/app/uvr/models.py`, `backend/app/uvr/repository.py`, `backend/app/uvr/service.py`, `backend/alembic/versions/0009_uwr_period_history.py`, `backend/app/api/routes/uvr.py`; Modify `backend/app/container.py`, `backend/app/main.py`, `backend/app/services/reconciliation.py`; Test `backend/tests/test_uwr_history.py`.

**Interfaces:** `UvrService.publish(period, kind, blob, mapping, author, reason=None)` возвращает номер версии; `UvrService.result(period)` возвращает расчёт с UUID КУС и точными версиями plan/fact/control. Таблицы `uvr_periods`, `uvr_source_versions`, `uvr_source_rows`, `uvr_calculation_versions` хранят исходный XLSX (`LargeBinary`), SHA-256, снимок ФИО/отдела, решения и результат.

- [ ] Тестами закрепить публикацию августа и сентября, неизменность августа после изменения КУС, идемпотентный повтор файла, блокировку закрытого месяца без причины/подтверждения, сохранение прежней версии после исправления.
- [ ] Запустить тест до реализации, добавить миграцию и репозиторий, затем сервис; расчёт плана/СКУД перевести на подтверждённый UUID при сохранении старого read-only файлового результата.
- [ ] Добавить `GET /api/uvr/periods`, `GET /api/uvr/periods/{period}`, `POST /api/uvr/periods/{period}/sources/{kind}/preview|apply`, `POST /api/uvr/periods/{period}/close|revise`; права проверять в API.
- [ ] Запустить `python -m unittest backend.tests.test_uwr_history -v`, PostgreSQL migration smoke и зафиксировать `feat: keep versioned monthly UWR history`.

### Task 7: Читать отчёт СК и показывать аналитику

**Files:** Create `backend/app/infrastructure/excel/control_reader.py`, `backend/app/uvr/control_analytics.py`; Modify `backend/app/api/routes/uvr.py`, `frontend/src/features/analytics/BiDashboard.tsx`, `frontend/src/features/import/Upload.tsx`; Test `backend/tests/test_control_source.py`, `frontend/src/tests/components.test.tsx`.

**Interfaces:** `read_control_xlsx(blob: bytes, period: str) -> list[dict]` возвращает восемь полей и номер строки; `control_summary(period, scope) -> dict` выводит активные/полезные часы и hh.ru минуты по разрешённому составу с указанием версии источника.

- [ ] Тестами закрепить 8 заголовков, числовые часы/минуты, пустые и неверные ячейки, отсутствие ФИО, дубли и текстовые замечания без автоматического статуса прогула.
- [ ] Реализовать preview/apply отчёта СК через Task 5/6, ограничить загрузку `timekeeper`/`admin`, добавить карточку источника и разрезы СК в УВР без смешения с часами СКУД.
- [ ] Проверить, что менеджер видит только свою область, сотрудник только себя, аудитор не получает личные замечания; запустить backend/frontend тесты и зафиксировать `feat: add reviewed control report analytics`.

### Task 8: Создать демонстрационный `Demo-control.xlsx`

**Files:** Create `demo/Demo-control.xlsx`; Test `backend/tests/test_demo_control.py`.

**Interfaces:** Один лист и восемь колонок источника СК; строки — 166 карточек КУС, уже сопоставленных августовскому плану. Три ручные карточки остаются в БД, но вне состава августовского снимка.

- [ ] Прочитать в память список из 166 UUID, ФИО и отделов КУС, подтверждённых демо-планом; проверить число, уникальность и покрытие 17 отделов, не печатая ФИО в логах.
- [ ] Создать файл через `@oai/artifact-tool` на основе структуры `Отчет_PPL-buying_Demo.xlsx`; перед авторингом вызвать `mark_artifact_operation_started.mjs` один раз. Использовать фиксированный seed, плановый отпуск и типичные диапазоны исходного отчёта; сохранить `demo/Demo-control.xlsx`.
- [ ] Проверить рендер и прочитать готовый файл: 166 строк, правильный августовский заголовок, восемь колонок, числовые значения, отсутствие дубликатов и неизвестных ФИО. Запустить `python -m unittest backend.tests.test_demo_control -v`; зафиксировать `testdata: add August control report demo`.

### Task 9: Приёмка и эксплуатационная документация

**Files:** Create `compose.work.yaml`, `.env.work.example`; Modify `.gitignore`, `backend/app/config.py`, `docs/CURRENT_STATE.md`, `README.md`, `docs/Architecture.md`, `Steps.md`, `TEST_RESULTS.md`.

**Interfaces:** Документы называют КУС источником состава, описывают оба Excel-обмена, три месячных источника, исправление закрытого месяца, права и команды проверки.

- [ ] Создать отдельную конфигурацию будущего рабочего контура: Compose-проект `timetrack-work`, собственные PostgreSQL и файловый volumes, собственный `.env.work`, порт 8002 и разрешённый origin. Проверить `docker compose -p timetrack-work -f compose.yaml -f compose.work.yaml config -q`, что пути и volumes не совпадают с демо; реальный контур пока не запускать.
- [ ] На копии демо-БД проверить backup через `pg_dump` и `pg_restore --list`, затем миграции до head и сохранность 169 карточек, включая три `manual:`.
- [ ] Запустить полный backend-набор в корректном тестовом окружении, `npm test`, `npm run build`, затем Docker preview 8001 и browser smoke по HR/УВР/СК/экспорту. Записать точные результаты и ограничения.
- [ ] Обновить документы только подтверждённым поведением; сравнить спецификацию и фактический результат. Зафиксировать `docs: document KUS-led UWR workflow and acceptance`.

## Порядок и пределы

Зависимости: Task 1 → 2/3/4; Task 2 → 5 → 6 → 7; Task 8 после Task 5; Task 9 последним. Каждый коммит должен оставлять существующий preview работоспособным. Новые месячные endpoints включаются после того, как импорт и права протестированы. Старые снимки и колонки удаляются только отдельным будущим этапом после приёмки и резервного копирования.
