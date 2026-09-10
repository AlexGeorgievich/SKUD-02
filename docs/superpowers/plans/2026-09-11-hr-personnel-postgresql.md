# HR Personnel PostgreSQL Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Docker-hosted PostgreSQL personnel registry to TimeTrack Pro while keeping plan data authoritative for employee name and department.

**Architecture:** The current JSON snapshot repository remains the source for plan/SKUD calculations. A separate SQLAlchemy PostgreSQL module stores safe HR attributes, imports, plan synchronizations and audit entries. FastAPI exposes RBAC-protected HR routes; React gets an independent `features/hr` module and does not store personnel records in localStorage.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, psycopg 3, PostgreSQL 16, Docker Compose, React 19, TypeScript, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-11-hr-personnel-postgresql-design.md`

## Global Constraints

- Never store passport, SNILS, INN, home address, document scans, or arbitrary `customFields`.
- Plan is authoritative for employee name and department in phase one; UI and HR Excel must not overwrite them.
- Only `admin` and `hr` may create, edit or import personnel data; all authorization is enforced server-side.
- A missing SKUD registration is a review record, not a кадровое взыскание or absence classification.
- PostgreSQL data must survive `docker compose down` followed by `docker compose up -d`; only `down -v` removes the named volume.
- Secrets belong in `.env`; commit `.env.example` only.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `compose.yaml`, `Dockerfile`, `.env.example` | Local app/PostgreSQL/migration deployment without committed credentials |
| `backend/app/hr/models.py` | SQLAlchemy schema for HR employee, plan sync, import batch and audit |
| `backend/app/hr/schemas.py` | Pydantic request/response models with allowlisted safe fields |
| `backend/app/hr/repository.py` | Transactional PostgreSQL reads/writes and audit persistence |
| `backend/app/hr/service.py` | RBAC, plan synchronization, CSV/XLSX preview and apply rules |
| `backend/app/api/routes/hr.py` | HTTP boundary for registry, card, Excel preview/apply and events |
| `backend/alembic/` | Reproducible database migration environment and initial revision |
| `frontend/src/features/hr/` | Registry, card modal, importer, events and HR analytics views |
| `frontend/src/shared/types.ts` | HR API contracts and navigation types |
| `frontend/src/app/Workspace.tsx` | New navigation block and access-aware HR page mounting |
| `backend/tests/test_hr_*.py`, `frontend/src/tests/hr.test.tsx`, `frontend/playwright/hr.spec.ts` | Backend, component and browser acceptance tests |

## Task 1: Containerized PostgreSQL and migration bootstrap

**Files:**
- Create: `compose.yaml`, `Dockerfile`, `.env.example`, `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/0001_hr_initial.py`
- Modify: `.gitignore`, `backend/requirements.txt`, `backend/app/config.py`
- Test: `backend/tests/test_hr_settings.py`

**Interfaces:**
- Produces `Settings.database_url: str` and `Settings.database_required: bool`.
- Produces Compose services `postgres`, `migrate`, `app` and volume `timetrack_postgres_data`.

- [ ] **Step 1: Write the failing settings test**

```python
def test_settings_read_database_url_from_environment(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql+psycopg://u:p@db:5432/timetrack')
    from backend.app.config import Settings
    assert Settings().database_url == 'postgresql+psycopg://u:p@db:5432/timetrack'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv\Scripts\python.exe -m unittest backend.tests.test_hr_settings -v`

Expected: FAIL because `Settings` has no `database_url`.

- [ ] **Step 3: Add configuration and deployment files**

```python
database_url: str = field(default_factory=lambda: os.environ.get('DATABASE_URL', ''))
database_required: bool = field(default_factory=lambda: os.environ.get('DATABASE_REQUIRED') == '1')
```

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env_file: .env
    volumes: [timetrack_postgres_data:/var/lib/postgresql/data]
  migrate:
    build: .
    env_file: .env
    command: ["alembic", "upgrade", "head"]
    depends_on: [postgres]
  app:
    build: .
    env_file: .env
    ports: ["8000:8000"]
    depends_on: [migrate]
volumes:
  timetrack_postgres_data: {}
```

Use `SQLAlchemy>=2,<3`, `alembic>=1.14,<2` and `psycopg[binary]>=3,<4`; add `.env` to `.gitignore` if absent.

- [ ] **Step 4: Run configuration and Compose validation**

Run: `.venv\Scripts\python.exe -m unittest backend.tests.test_hr_settings -v` and `docker compose config -q`

Expected: PASS and Compose exits `0` without printing secret values.

- [ ] **Step 5: Commit**

```powershell
git add compose.yaml Dockerfile .env.example .gitignore backend
git commit -m "feat: add PostgreSQL runtime bootstrap"
```

## Task 2: HR relational schema and repository

**Files:**
- Create: `backend/app/hr/__init__.py`, `backend/app/hr/models.py`, `backend/app/hr/repository.py`, `backend/tests/test_hr_repository.py`
- Modify: `backend/alembic/env.py`, `backend/alembic/versions/0001_hr_initial.py`

**Interfaces:**
- Produces `HrEmployee`, `HrPlanSync`, `HrImportBatch`, `HrAuditLog` models.
- Produces `HrRepository.upsert_plan_employee(plan_id, name, department, period) -> HrEmployee` and `HrRepository.get_employee(hr_id) -> HrEmployee | None`.

- [ ] **Step 1: Write the failing repository tests**

```python
def test_plan_sync_creates_card_and_never_overwrites_hr_position(hr_repo):
    card = hr_repo.upsert_plan_employee('emp-1', 'Иванов Иван', 'HR', '2026-08')
    hr_repo.update_safe_fields(card.id, {'position': 'Рекрутер'}, actor='hr_user')
    synced = hr_repo.upsert_plan_employee('emp-1', 'Иванов Иван', 'HR', '2026-09')
    assert synced.position == 'Рекрутер'
    assert synced.plan_department == 'HR'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m unittest backend.tests.test_hr_repository -v`

Expected: FAIL because the HR module does not exist.

- [ ] **Step 3: Implement models, revision and transactional repository**

Use UUID primary keys. Add unique `plan_employee_id` to `hr_employees`; prohibit `name` and `department` in `update_safe_fields`. Store `before_json` and `after_json` only for allowlisted safe fields in `hr_audit_log`.

```python
SAFE_FIELDS = {'personnel_number', 'position', 'schedule_type', 'schedule_hours',
               'employment_status', 'work_email', 'work_phone', 'card_rfid',
               'card_status', 'access_levels', 'work_zones'}
```

- [ ] **Step 4: Run repository tests against PostgreSQL**

Run: `docker compose up -d postgres migrate; .venv\Scripts\python.exe -m unittest backend.tests.test_hr_repository -v`

Expected: PASS; created card has a UUID, HR fields survive a plan re-sync, and audit has one update event.

- [ ] **Step 5: Commit**

```powershell
git add backend/alembic backend/app/hr backend/tests/test_hr_repository.py
git commit -m "feat: add HR PostgreSQL schema and repository"
```

## Task 3: Service rules, plan synchronization and HR Excel preview

**Files:**
- Create: `backend/app/hr/service.py`, `backend/app/hr/excel.py`, `backend/tests/test_hr_service.py`
- Modify: `backend/app/services/imports.py`, `backend/app/container.py`

**Interfaces:**
- Produces `HrService.sync_plan(result, actor) -> int`.
- Produces `HrService.preview_import(content: bytes, actor: dict) -> dict` and `apply_import(batch_id: UUID, actor: dict) -> dict`.
- `ImportService.run()` invokes `hr_service.sync_plan(result, user)` only after `save_snapshot()` succeeds.

- [ ] **Step 1: Write failing service tests**

```python
def test_excel_preview_rejects_plan_owned_column(hr_service, hr_user, workbook_bytes):
    preview = hr_service.preview_import(workbook_bytes([
        ['plan_employee_id', 'department', 'position'], ['emp-1', 'Sales', 'Analyst']
    ]), hr_user)
    assert preview['errors'] == ['Столбец department управляется планом и не импортируется']

def test_non_hr_cannot_apply_personnel_import(hr_service, manager_user, valid_workbook):
    with self.assertRaisesRegex(ServiceError, 'Нет права'):
        hr_service.preview_import(valid_workbook, manager_user)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m unittest backend.tests.test_hr_service -v`

Expected: FAIL because `HrService` is absent.

- [ ] **Step 3: Implement allowlisted XLSX processing and sync**

Require columns `plan_employee_id` and one or more safe fields. Reject duplicates, missing plan links, unknown columns and any of `name`, `department`, `passport`, `snils`, `inn`, `address`. Preview creates an `hr_import_batches` row in `previewed` state; apply writes one transaction and audits every affected card.

- [ ] **Step 4: Run service and existing import tests**

Run: `.venv\Scripts\python.exe -m unittest backend.tests.test_hr_service backend.tests.test_api -v`

Expected: PASS; a failed HR sync does not replace the existing calculation snapshot.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/services/imports.py backend/app/container.py backend/app/hr backend/tests/test_hr_service.py
git commit -m "feat: sync HR cards from plan and preview HR imports"
```

## Task 4: RBAC-protected HR API

**Files:**
- Create: `backend/app/api/routes/hr.py`, `backend/app/hr/schemas.py`, `backend/tests/test_hr_api.py`
- Modify: `backend/app/main.py`, `backend/app/api/routes/__init__.py`

**Interfaces:**
- `GET /api/hr/employees?department=&status=&q=` returns scoped cards.
- `GET /api/hr/employees/{id}`, `PATCH /api/hr/employees/{id}`.
- `POST /api/hr/imports/preview`, `POST /api/hr/imports/{batch_id}/apply`.
- `GET /api/hr/events`, `GET /api/hr/analytics`.

- [ ] **Step 1: Write failing API tests**

```python
def test_manager_receives_only_own_department(client, manager_cookie):
    response = client.get('/api/hr/employees', cookies=manager_cookie)
    assert response.status_code == 200
    assert {row['plan_department'] for row in response.json()['items']} == {'HR'}

def test_manager_cannot_patch_employee(client, manager_cookie, hr_card_id):
    response = client.patch(f'/api/hr/employees/{hr_card_id}', json={'position': 'Lead'}, cookies=manager_cookie)
    assert response.status_code == 403
```

- [ ] **Step 2: Run API tests to verify they fail**

Run: `.venv\Scripts\python.exe -m unittest backend.tests.test_hr_api -v`

Expected: FAIL with route not found.

- [ ] **Step 3: Implement routes and scope helper**

Use the current authenticated user dependency. `admin` and `hr` may mutate; managers are constrained by `user.department`; employees are constrained by `user.employee_id`; all read responses omit any fields outside the safe Pydantic response schema.

- [ ] **Step 4: Run API suite**

Run: `.venv\Scripts\python.exe -m unittest backend.tests.test_hr_api backend.tests.test_api -v`

Expected: PASS with 403 for write attempts and no unsafe field names in JSON.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/api backend/app/main.py backend/app/hr backend/tests/test_hr_api.py
git commit -m "feat: expose RBAC protected HR API"
```

## Task 5: React contracts and registry page

**Files:**
- Create: `frontend/src/features/hr/HrRegistry.tsx`, `frontend/src/features/hr/HrCardModal.tsx`, `frontend/src/tests/hr.test.tsx`
- Modify: `frontend/src/shared/types.ts`, `frontend/src/app/Workspace.tsx`, `frontend/src/shared/styles/react.css`

**Interfaces:**
- Adds `HrEmployee`, `HrEmployeePatch`, `HrAnalytics`, and view `'Кадровый учёт'`.
- `HrRegistry({user}: {user: User})` loads `/api/hr/employees` and opens `HrCardModal`.

- [ ] **Step 1: Write failing component tests**

```tsx
it('shows plan-owned name and department as read-only for HR', async () => {
  render(<HrRegistry user={{username:'hr1', role:'hr', role_label:'HR-служба'}} />)
  await userEvent.click(await screen.findByRole('button', {name:'Иванов Иван'}))
  expect(screen.getByLabelText('ФИ из плана')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('Отдел из плана')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('Должность')).not.toHaveAttribute('readonly')
})
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm test -- --run src/tests/hr.test.tsx`

Expected: FAIL because `HrRegistry` is missing.

- [ ] **Step 3: Implement registry and card**

Use the existing `api` client and `Modal`. Add a dedicated sidebar group «Кадровый учёт» visible to roles that may read HR data. Add filters `q`, `department`, `employment_status`, `schedule_type`, `card_status`; keep plan name and department read-only in the card. Only show save controls for `admin` and `hr`.

- [ ] **Step 4: Run component tests and production build**

Run: `npm test -- --run src/tests/hr.test.tsx` and `npm run build`

Expected: PASS and TypeScript emits no errors.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/features/hr frontend/src/shared/types.ts frontend/src/app/Workspace.tsx frontend/src/shared/styles/react.css frontend/src/tests/hr.test.tsx
git commit -m "feat: add HR registry and safe employee card"
```

## Task 6: HR Excel import, events and analytics UI

**Files:**
- Create: `frontend/src/features/hr/HrImport.tsx`, `frontend/src/features/hr/HrEvents.tsx`, `frontend/src/features/hr/HrAnalytics.tsx`
- Modify: `frontend/src/features/hr/HrRegistry.tsx`, `frontend/src/tests/hr.test.tsx`, `frontend/src/shared/styles/react.css`

**Interfaces:**
- `HrImport` posts a selected XLSX to `/api/hr/imports/preview` then applies only the returned batch ID.
- `HrEvents` consumes `/api/hr/events`; `HrAnalytics` consumes `/api/hr/analytics`.

- [ ] **Step 1: Write failing UI tests**

```tsx
it('does not apply an HR Excel import until the user confirms preview', async () => {
  render(<HrImport user={hrUser} />)
  await userEvent.upload(screen.getByLabelText('Кадровый Excel'), validXlsx)
  await userEvent.click(screen.getByRole('button', {name:'Проверить файл'}))
  expect(await screen.findByText('Готово к применению: 2 обновления')).toBeTruthy()
  expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/apply/), expect.anything())
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/tests/hr.test.tsx`

Expected: FAIL because `HrImport` is absent.

- [ ] **Step 3: Implement preview/apply and read-only views**

Keep the two-step flow explicit. Render event lists only from safe fields such as hire date, probation end and card expiry. Render analytics as counts by department/status/schedule/card state; do not expose sensitive or unrelated SKUD records.

- [ ] **Step 4: Run frontend verification**

Run: `npm test -- --run src/tests/hr.test.tsx` and `npm run build`

Expected: PASS; only `admin`/`hr` can see apply controls.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/features/hr frontend/src/tests/hr.test.tsx frontend/src/shared/styles/react.css
git commit -m "feat: add HR import events and analytics UI"
```

## Task 7: End-to-end persistence, documentation and release verification

**Files:**
- Create: `frontend/playwright/hr.spec.ts`, `scripts/hr-smoke.ps1`
- Modify: `README.md`, `Steps.md`, `docs/Architecture.md`, `frontend/README.md`, `TEST_RESULTS.md`
- Test: `frontend/playwright/hr.spec.ts`, `backend/tests/test_hr_*.py`

**Interfaces:**
- `scripts/hr-smoke.ps1` performs authenticated HR create/edit, container restart without volumes, and readback.

- [ ] **Step 1: Write failing Playwright scenario**

```ts
test('HR updates a plan-linked card and manager only views own department', async ({page}) => {
  await login(page, 'hr_user', process.env.HR_TEST_PASSWORD!)
  await page.getByRole('button', {name:'Кадровый учёт'}).click()
  await page.getByRole('button', {name:'Иванов Иван'}).click()
  await page.getByLabel('Должность').fill('Рекрутер')
  await page.getByRole('button', {name:'Сохранить'}).click()
  await expect(page.getByText('Рекрутер')).toBeVisible()
})
```

- [ ] **Step 2: Run browser test to verify it fails**

Run: `npx playwright test playwright/hr.spec.ts --workers=1`

Expected: FAIL until the HR route and UI exist.

- [ ] **Step 3: Implement smoke test and update operating documentation**

Document Docker first start, backup with `docker compose down` without `-v`, restore rules, HR Excel template columns, permissions and the explicit exclusion of sensitive fields. In `scripts/hr-smoke.ps1`, call `docker compose up -d --build`, exercise only synthetic test users/data, then `docker compose down` and `docker compose up -d` without `-v` before readback.

- [ ] **Step 4: Run release verification**

Run:

```powershell
docker compose config -q
docker compose up -d --build
.venv\Scripts\python.exe -m unittest discover -s backend/tests -t . -v
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend exec playwright test playwright/hr.spec.ts --workers=1
.\scripts\hr-smoke.ps1
```

Expected: all applicable checks pass; the smoke test confirms HR data survives a restart without `-v`.

- [ ] **Step 5: Commit**

```powershell
git add README.md Steps.md docs frontend/README.md scripts/hr-smoke.ps1 frontend/playwright/hr.spec.ts TEST_RESULTS.md
git commit -m "docs: document PostgreSQL HR operations"
```

## Plan self-review

- Spec coverage: Tasks 1–2 implement Docker/PostgreSQL and all four relational records; Tasks 3–4 implement plan authority, Excel preview and RBAC; Tasks 5–6 implement every approved screen; Task 7 verifies persistence and documentation.
- Placeholder scan: no task defers validation or testing; every task includes a concrete failing test, execution command, expected result and commit.
- Type consistency: `HrRepository` is introduced before `HrService`; `HrService` before the routes; routes before React consumers; `HrEmployee` response is introduced before `HrRegistry` uses it.
