# HR Lifecycle and Administration Implementation Plan

> Historical implementation plan. Its completed and outstanding work is superseded by the current status document: [../../CURRENT_STATE.md](../../CURRENT_STATE.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an independent personnel module with a one-time Plan bootstrap, safe editable employee cards, read-only TimeTrack drill-down, and administrator operations for users, audit, and PostgreSQL backup.

**Architecture:** Keep TimeTrack snapshot data in the current file repository and place HR records, administrative records, and audit trails in PostgreSQL through focused repositories. The React workspace becomes a module launcher: HR is the first module, TimeTrack is the second, and administration is visible only to admins. The backend remains authoritative for role checks, module mode, archive state, import lifecycle, and restore confirmation.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy/Alembic, PostgreSQL 16, React, TypeScript, Vite, Vitest, Docker Compose, PowerShell 5.1-compatible scripts.

**Spec:** `docs/superpowers/specs/2026-09-11-hr-personnel-module-design.md`

## Global Constraints

- Store only approved work HR and SKUD fields; never add passport, SNILS, INN, address, scans, photo, personal contacts, or arbitrary custom fields.
- PostgreSQL is the only personnel-data store; no HR data in browser `localStorage` or prototype demo fixtures.
- The first successful Plan import is the only automatic HR bootstrap. All later Plan imports must leave HR data unchanged.
- Deleting an employee means archival only; historical TimeTrack data and audit records must remain intact.
- TimeTrack employee cards are always read-only, including for an `admin` or `hr` user; `Esc` returns to the invoking TimeTrack view and selection.
- HR and admin mutations are server-authorized, audited, CSRF/origin-protected by the existing middleware, and never expose environment secrets.
- Backup/restore works only for `admin`; restore needs a distinct explicit confirmation and is logged.
- Preserve the existing Russian UI terminology: `Офис — Отдел — Сотрудник`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `backend/app/hr/models.py` | HR records, bootstrap marker, archive metadata, and HR audit entities. |
| `backend/app/hr/schemas.py` | Allowlisted create/update/import/read DTOs and validated status values. |
| `backend/app/hr/repository.py` | PostgreSQL queries for active/archive employee cards, filters, bootstrap state, and HR audit. |
| `backend/app/hr/service.py` | One-time bootstrap, explicit HR import preview/apply, card lifecycle, calendar and analytics aggregations. |
| `backend/app/admin/models.py`, `repository.py`, `service.py`, `schemas.py` | User/role lifecycle, operational audit, backup catalog, and restore confirmation workflow. |
| `backend/app/api/routes/hr.py` | HR registry, cards, archive/restore, safe import, analytics/calendar, and TimeTrack read-only API endpoints. |
| `backend/app/api/routes/admin.py` | Admin-only user, log, backup, and restore endpoints. |
| `backend/app/services/imports.py` | Calls HR bootstrap only when the database marker says it has not yet run. |
| `backend/app/container.py`, `backend/app/main.py` | Compose HR/admin services and register router. |
| `backend/alembic/versions/0002_hr_lifecycle_admin.py` | Additive migration for the expanded schema; never drops existing personnel data. |
| `backend/tests/test_hr_*.py`, `backend/tests/test_admin_api.py` | Unit/API coverage for authorization, archival, bootstrap, imports, and backups. |
| `frontend/src/features/hr/*` | Focused registry, safe-card modal, calendar, analytics, and import screens. |
| `frontend/src/features/admin/*` | Admin users, logs, backup and restore-confirmation screens. |
| `frontend/src/features/personnel/ReadOnlyCard.tsx` | Reusable TimeTrack drill-down card with no mutation controls. |
| `frontend/src/app/Workspace.tsx`, `frontend/src/shared/types.ts` | Module-first navigation, view types, role-specific menu, and Escape restoration. |
| `frontend/src/tests/components.test.tsx` | Interaction tests for menu order, cards, Escape, and role-hidden controls. |
| `README.md`, `Steps.md` | Safe operating instructions for initial bootstrap, HR import, archive/restore, admin backup, and Docker launch. |

### Task 1: Add schema and migration for HR lifecycle

**Files:**
- Modify: `backend/app/hr/models.py`
- Modify: `backend/app/hr/schemas.py`
- Create: `backend/alembic/versions/0002_hr_lifecycle_admin.py`
- Modify: `backend/tests/test_hr_repository.py`

**Interfaces:**
- Produces `HrEmployee` fields `office`, `department`, `department_status`, `gender`, `birth_year`, `hire_date`, `work_schedule`, `department_head_id`, `deputy_id`, `deputy_from`, `deputy_until`, `archived_at`, `archived_by`.
- Produces `HrBootstrapState(key='plan_initial_load')` and allowed `DEPARTMENT_STATUSES` constant.
- Consumes current `HrEmployee.plan_*` identity fields without renaming or destroying them.

- [ ] **Step 1: Write failing model/repository tests**

```python
def test_archive_preserves_card_and_plan_identity(self):
    employee = self.repo.create_from_initial_plan('plan-1', 'Иванов Иван', 'LAW', '2026-08')
    self.repo.archive_employee(employee.id, 'hr-user')
    self.assertIsNone(self.repo.get_active_employee(employee.id))
    archived = self.repo.get_employee(employee.id, include_archived=True)
    self.assertEqual(archived.plan_employee_id, 'plan-1')
    self.assertEqual(archived.archived_by, 'hr-user')

def test_update_schema_rejects_sensitive_and_unknown_fields(self):
    with self.assertRaises(ValidationError):
        HrEmployeeUpdate.model_validate({'passport': '1234'})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest backend.tests.test_hr_repository -v`

Expected: FAIL because `create_from_initial_plan`, archival metadata, and strict DTO validation do not exist.

- [ ] **Step 3: Add additive SQLAlchemy model and DTO fields**

```python
DEPARTMENT_STATUSES = {
    'Сотрудник', 'Руководитель отдела',
    'Заместитель руководителя', 'Временно исполняющий обязанности',
}

class HrEmployeeUpdate(BaseModel):
    plan_name: str | None = Field(default=None, max_length=255)
    department: str | None = Field(default=None, max_length=255)
    office: str | None = Field(default=None, max_length=255)
    department_status: Literal[
        'Сотрудник', 'Руководитель отдела',
        'Заместитель руководителя', 'Временно исполняющий обязанности'
    ] | None = None
    gender: Literal['Не указан', 'Женский', 'Мужской'] | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    hire_date: date | None = None
```

Use an `HrBootstrapState` table with a unique textual key and timestamp/author, rather than inferring bootstrap completion from whether employee rows happen to exist. In migration `upgrade`, add nullable columns and create the new table/indexes; `downgrade` drops only objects created by revision `0002`.

- [ ] **Step 4: Run model/repository tests and migration check**

Run: `python -m unittest backend.tests.test_hr_repository -v; alembic -c backend/alembic.ini upgrade head`

Expected: PASS; migration upgrades an existing database without deleting `hr_employees`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/hr/models.py backend/app/hr/schemas.py backend/alembic/versions/0002_hr_lifecycle_admin.py backend/tests/test_hr_repository.py
git commit -m "feat: add HR card lifecycle schema"
```

### Task 2: Make Plan bootstrap one-time and implement safe HR lifecycle

**Files:**
- Modify: `backend/app/hr/repository.py`
- Modify: `backend/app/hr/service.py`
- Modify: `backend/app/services/imports.py`
- Modify: `backend/tests/test_hr_service.py`
- Modify: `backend/tests/test_hr_repository.py`

**Interfaces:**
- Produces `HrService.bootstrap_from_plan(rows, period, author) -> dict`.
- Produces `HrService.create_employee(payload, author)`, `update_employee(employee_id, payload, author)`, `archive_employee(employee_id, author)`, and `restore_employee(employee_id, author)`.
- `ImportService.run()` invokes `bootstrap_from_plan` only when `repository.is_bootstrap_complete()` is false.

- [ ] **Step 1: Write failing lifecycle tests**

```python
def test_second_plan_import_does_not_change_hr_card(self):
    self.service.bootstrap_from_plan([{'id': 'a', 'name': 'Иванов Иван', 'department': 'LAW'}], '2026-08', 'admin')
    self.service.update_employee(self.repository.get_employee('a').id, {'department': 'Legal'}, 'hr-user')
    result = self.service.bootstrap_from_plan([{'id': 'a', 'name': 'Иванов И.И.', 'department': 'Changed'}], '2026-09', 'admin')
    self.assertEqual(result['status'], 'skipped')
    self.assertEqual(self.repository.get_employee('a').department, 'Legal')

def test_restore_returns_archived_employee_to_active_registry(self):
    employee = self.service.create_employee({'plan_name': 'Петров Пётр', 'department': 'HR'}, 'hr-user')
    self.service.archive_employee(employee.id, 'hr-user')
    self.service.restore_employee(employee.id, 'admin')
    self.assertEqual(self.repository.list_employees()[0].id, employee.id)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest backend.tests.test_hr_service backend.tests.test_hr_repository -v`

Expected: FAIL because Plan still updates existing cards and no archive/restore service exists.

- [ ] **Step 3: Implement lifecycle semantics**

```python
def bootstrap_from_plan(self, rows: list[dict], period: str, author: str) -> dict:
    if self.repository.is_bootstrap_complete():
        return {'status': 'skipped', 'created': 0}
    created = [self.repository.create_from_initial_plan(row['id'], row['name'], row['department'], period) for row in rows]
    self.repository.mark_bootstrap_complete(author, period)
    self.repository.add_audit(author, 'initial_plan_bootstrap', 'registry', period, {'created': len(created)}, 'plan')
    return {'status': 'applied', 'created': len(created)}
```

Explicit HR import remains `preview` then `apply`, matches an existing employee by immutable `id` or `plan_employee_id`, and may create a manual HR card only when a safe `plan_name` and `department` are supplied. It must never re-enable a Plan-triggered automatic synchronization.

- [ ] **Step 4: Run lifecycle tests**

Run: `python -m unittest backend.tests.test_hr_service backend.tests.test_hr_repository -v`

Expected: PASS; second Plan import reports `skipped`, archived employees are excluded by default, restoration works, and all mutations have audit rows.

- [ ] **Step 5: Commit**

```bash
git add backend/app/hr/repository.py backend/app/hr/service.py backend/app/services/imports.py backend/tests/test_hr_service.py backend/tests/test_hr_repository.py
git commit -m "feat: enforce one-time HR plan bootstrap"
```

### Task 3: Expand HR API with role and mode enforcement

**Files:**
- Modify: `backend/app/api/routes/hr.py`
- Modify: `backend/tests/test_hr_api.py`

**Interfaces:**
- Produces `GET /api/hr/employees?office=&department=&status=&hire_from=&hire_to=&archived=`.
- Produces `POST /api/hr/employees`, `PATCH /api/hr/employees/{id}`, `POST /api/hr/employees/{id}/archive`, and `POST /api/hr/employees/{id}/restore`.
- Produces `GET /api/hr/employees/{id}/read-only?source=timetrack`; response has `mode: 'read-only'` and no mutation affordances.
- `admin`/`hr` mutate; manager sees own department; employee sees own card; TimeTrack source is read-only regardless of role.

- [ ] **Step 1: Write failing endpoint tests**

```python
def test_timetrack_read_only_card_cannot_be_used_to_edit(self):
    response = self.client.get(f'/api/hr/employees/{self.employee.id}/read-only?source=timetrack')
    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json()['mode'], 'read-only')
    self.assertEqual(self.client.patch(f'/api/hr/employees/{self.employee.id}?source=timetrack', json={'position': 'Юрист'}).status_code, 403)

def test_hr_can_archive_but_manager_cannot_restore(self):
    self.login('hr')
    self.assertEqual(self.client.post(f'/api/hr/employees/{self.employee.id}/archive').status_code, 200)
    self.login('manager')
    self.assertEqual(self.client.post(f'/api/hr/employees/{self.employee.id}/restore').status_code, 403)
```

- [ ] **Step 2: Run API tests to verify they fail**

Run: `python -m unittest backend.tests.test_hr_api -v`

Expected: FAIL because lifecycle routes, filters, and the enforced TimeTrack mode do not exist.

- [ ] **Step 3: Add API handlers and response projections**

Use an explicit `source` parameter only for the read-only endpoint. Mutation handlers reject `source=timetrack` before parsing a mutation. Serialize only safe columns, add `mode`, `archived`, and `source_labels`, and return `404` for unavailable employee records instead of leaking existence outside a user’s scope.

- [ ] **Step 4: Run HR API tests**

Run: `python -m unittest backend.tests.test_hr_api -v`

Expected: PASS with 200 for authorized HR actions, 403 for unauthorized/mode-violating actions, and 404 outside allowed scope.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/hr.py backend/tests/test_hr_api.py
git commit -m "feat: expose safe HR card lifecycle API"
```

### Task 4: Add calendar and personnel analytics read models

**Files:**
- Modify: `backend/app/hr/repository.py`
- Modify: `backend/app/hr/service.py`
- Modify: `backend/app/api/routes/hr.py`
- Modify: `backend/tests/test_hr_service.py`

**Interfaces:**
- Produces `HrService.calendar_events(month: str, scope: HrScope) -> list[HrCalendarEvent]`.
- Produces `HrService.analytics(scope: HrScope) -> HrAnalytics` with office/department totals, status distribution, incomplete cards, missing deputies, and aggregated card statuses.
- Produces `GET /api/hr/calendar?month=YYYY-MM` and `GET /api/hr/analytics`.

- [ ] **Step 1: Write failing read-model tests**

```python
def test_analytics_counts_incomplete_cards_and_missing_deputies(self):
    self.service.create_employee({'plan_name': 'Иванова Анна', 'department': 'HR', 'department_status': 'Руководитель отдела'}, 'hr')
    result = self.service.analytics(self.admin_scope)
    self.assertEqual(result['incomplete_cards'], 1)
    self.assertEqual(result['departments_without_deputy'], ['HR'])

def test_calendar_emits_hire_anniversary_without_personal_contact_data(self):
    employee = self.service.create_employee({'plan_name': 'Петров Пётр', 'department': 'LAW', 'hire_date': '2020-09-11'}, 'hr')
    event = self.service.calendar_events('2026-09', self.admin_scope)[0]
    self.assertEqual(event['employee_id'], employee.id)
    self.assertEqual(event['kind'], 'hire_anniversary')
    self.assertNotIn('work_phone', event)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest backend.tests.test_hr_service -v`

Expected: FAIL because calendar and analytics methods are absent.

- [ ] **Step 3: Implement scoped aggregations**

Build aggregates from active HR records only unless caller is admin and explicitly asks for archived totals. Interpret a blank field as “not completed”; never fabricate a birth date from a birth year. Return only names, department/office, dates needed for the event, and safe card status.

- [ ] **Step 4: Run service and API tests**

Run: `python -m unittest backend.tests.test_hr_service backend.tests.test_hr_api -v`

Expected: PASS; manager and employee scopes cannot see cross-department event/card data.

- [ ] **Step 5: Commit**

```bash
git add backend/app/hr/repository.py backend/app/hr/service.py backend/app/api/routes/hr.py backend/tests/test_hr_service.py
git commit -m "feat: add personnel calendar and analytics"
```

### Task 5: Introduce administrator domain and audited operational backup

**Files:**
- Create: `backend/app/admin/__init__.py`
- Create: `backend/app/admin/models.py`
- Create: `backend/app/admin/schemas.py`
- Create: `backend/app/admin/repository.py`
- Create: `backend/app/admin/service.py`
- Create: `backend/app/api/routes/admin.py`
- Modify: `backend/app/container.py`
- Modify: `backend/app/main.py`
- Modify: `backend/alembic/versions/0002_hr_lifecycle_admin.py`
- Create: `backend/tests/test_admin_api.py`

**Interfaces:**
- Produces `AdminService.list_users()`, `create_user()`, `block_user()`, `archive_user()`, `set_user_scope()`, `list_operations()`.
- Produces `AdminService.create_backup(author) -> BackupRecord`, `verify_backup(backup_id) -> BackupRecord`, `request_restore(backup_id, author) -> RestoreRequest`, `confirm_restore(request_id, confirmation, author)`.
- Produces admin-only `/api/admin/users`, `/api/admin/operations`, `/api/admin/backups`, and `/api/admin/restore-requests` endpoints.

- [ ] **Step 1: Write failing admin authorization and backup tests**

```python
def test_hr_cannot_create_backup_or_manage_users(self):
    self.login('hr')
    self.assertEqual(self.client.post('/api/admin/backups').status_code, 403)
    self.assertEqual(self.client.get('/api/admin/users').status_code, 403)

def test_restore_requires_exact_confirmation_and_is_audited(self):
    backup = self.admin_service.create_backup('admin')
    request = self.admin_service.request_restore(backup.id, 'admin')
    with self.assertRaises(ServiceError):
        self.admin_service.confirm_restore(request.id, 'NO', 'admin')
    self.admin_service.confirm_restore(request.id, f'RESTORE {backup.id}', 'admin')
    self.assertIn('restore_confirmed', self.admin_service.list_operations()[0].action)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest backend.tests.test_admin_api -v`

Expected: FAIL because the admin service and routes do not exist.

- [ ] **Step 3: Implement safe admin operations**

Move user records from the current file repository into an additive PostgreSQL admin table through a migration/one-time compatibility import, retaining password hashes and salts but never returning either field through API. Store backup metadata (path, byte size, SHA-256, author, time, verified status) in PostgreSQL. Implement backup by calling `pg_dump` with an environment-provided database URL and a bounded backup directory outside the static frontend; validate with `pg_restore --list`. Restore accepts only a catalogued, verified backup and a one-use confirmation token; emit an operation record before and after the process. Do not return shell command lines, connection strings, or any environment value to the browser.

- [ ] **Step 4: Run focused admin tests**

Run: `python -m unittest backend.tests.test_admin_api -v`

Expected: PASS; only admin can manage users/backups and restore rejects missing/wrong confirmation.

- [ ] **Step 5: Commit**

```bash
git add backend/app/admin backend/app/api/routes/admin.py backend/app/container.py backend/app/main.py backend/alembic/versions/0002_hr_lifecycle_admin.py backend/tests/test_admin_api.py
git commit -m "feat: add audited administration and backups"
```

### Task 6: Build focused HR frontend screens and editable safe card

**Files:**
- Create: `frontend/src/features/hr/HrRegistry.tsx`
- Create: `frontend/src/features/hr/HrEmployeeCard.tsx`
- Create: `frontend/src/features/hr/HrCalendar.tsx`
- Create: `frontend/src/features/hr/HrAnalytics.tsx`
- Create: `frontend/src/features/hr/HrImport.tsx`
- Modify: `frontend/src/features/hr/HrPage.tsx`
- Modify: `frontend/src/shared/types.ts`
- Modify: `frontend/src/tests/components.test.tsx`

**Interfaces:**
- Produces `HrEmployeeCard({ employee, editable, onSaved, onClose })` and never renders `<input>` fields as editable when `editable` is false.
- Produces `HrPage({ role, notify })` tabs: registry, calendar, analytics, import.
- Consumes the safe HR API response and uses server-returned fields rather than client-side role assumptions.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('shows only safe card fields and allows HR to archive a card', async () => {
  render(<HrPage role="hr" notify={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', {name: 'Иванов Иван'}))
  expect(screen.getByLabelText('Офис')).toBeTruthy()
  expect(screen.queryByLabelText(/паспорт/i)).toBeNull()
  await userEvent.click(screen.getByRole('button', {name: 'Архивировать'}))
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/archive'), expect.anything())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because current `HrPage` only edits position and has no archive/card tabs.

- [ ] **Step 3: Implement HR UI in focused components**

Render compact filterable registry columns: FIO, office, department, position, department status, hire date, and SKUD state. The edit card has exactly five tabs from the spec and only allowlisted controls. Hide `Импорт HR`, edit, archive, and restore controls from non-HR roles. Show archived records only through an HR/admin archived filter, visually labelled as archived. Use the existing modal and `Esc` handling pattern, restoring focus to the invoking registry row.

- [ ] **Step 4: Run frontend unit tests and build**

Run: `npx vitest run --pool=threads --maxWorkers=1 --minWorkers=1 --reporter=dot; npm run build`

Expected: PASS; production build has no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/hr frontend/src/shared/types.ts frontend/src/tests/components.test.tsx
git commit -m "feat: add safe editable HR employee cards"
```

### Task 7: Reframe navigation as HR, TimeTrack, and Administration modules

**Files:**
- Modify: `frontend/src/app/Workspace.tsx`
- Modify: `frontend/src/shared/types.ts`
- Modify: `frontend/src/tests/components.test.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces sidebar groups `Кадровый учёт`, `TimeTrack`, and conditional `Администрирование`.
- Keeps legacy TimeTrack views unchanged inside the TimeTrack group.
- Visible navigation is role-filtered, but all access decisions remain backend checks.

- [ ] **Step 1: Write failing menu-order tests**

```tsx
it('places HR before TimeTrack and hides administration from HR', async () => {
  render(<Workspace user={{username:'hr', role:'hr', role_label:'HR-служба'}} onLogout={vi.fn()} />)
  await screen.findByText(/Загруженный период/)
  const groups = screen.getAllByRole('group').map(group => group.getAttribute('aria-label'))
  expect(groups).toEqual(['Кадровый учёт', 'TimeTrack'])
  expect(screen.queryByRole('button', {name:'Администрирование'})).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because current sidebar retains three TimeTrack-oriented groups.

- [ ] **Step 3: Implement module-first sidebar**

Make `Кадровый учёт` the first visual group and open it as the default for role `hr`; `TimeTrack` remains a visibly separate second group with Plan/Fact/analytics/service imports/logs. Add the admin group and route only for `admin`. Preserve existing compact visual blocks, borders, sticky headers, and Russian labels.

- [ ] **Step 4: Run workspace tests and build**

Run: `npx vitest run src/tests/components.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1; npm run build`

Expected: PASS; no non-admin route/link to administration is rendered.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/Workspace.tsx frontend/src/shared/types.ts frontend/src/styles.css frontend/src/tests/components.test.tsx
git commit -m "feat: organize workspace into HR and TimeTrack modules"
```

### Task 8: Add TimeTrack read-only employee drill-down

**Files:**
- Create: `frontend/src/features/personnel/ReadOnlyCard.tsx`
- Modify: `frontend/src/app/Workspace.tsx`
- Modify: `frontend/src/tests/components.test.tsx`

**Interfaces:**
- Produces `ReadOnlyCard({ employeeId, returnFocus, onClose })` fetching `/api/hr/employees/{id}/read-only?source=timetrack`.
- `Workspace` retains an `HTMLElement | null` origin ref and calls `origin.focus()` after card close.

- [ ] **Step 1: Write failing drill-down tests**

```tsx
it('opens a read-only HR card from TimeTrack and restores the source row by Escape', async () => {
  renderWorkspace()
  const row = await screen.findByRole('row', {name: /Иванов Иван/})
  await userEvent.click(within(row).getByRole('button', {name:'Иванов Иван'}))
  expect(await screen.findByText('Карточка сотрудника')).toBeTruthy()
  expect(screen.queryByRole('button', {name:'Сохранить'})).toBeNull()
  await userEvent.keyboard('{Escape}')
  expect(document.activeElement).toBe(row)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because TimeTrack currently opens its reconciliation modal only.

- [ ] **Step 3: Implement drill-down without changing TimeTrack records**

Route employee-name activation in TimeTrack tables and reconciliation modal to the read-only card. Keep existing day/reconciliation details reachable separately. The card has no editable inputs, no import/archive controls, and no API mutation calls. `Esc` first closes the card and restores table selection/focus, then preserves the existing dashboard-level Escape behavior.

- [ ] **Step 4: Run relevant frontend tests and build**

Run: `npx vitest run --pool=threads --maxWorkers=1 --minWorkers=1 --reporter=dot; npm run build`

Expected: PASS; TimeTrack interaction remains read-only for every role.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/personnel/ReadOnlyCard.tsx frontend/src/app/Workspace.tsx frontend/src/tests/components.test.tsx
git commit -m "feat: add read-only HR drill-down in TimeTrack"
```

### Task 9: Build administrator UI, document operations, and complete acceptance

**Files:**
- Create: `frontend/src/features/admin/AdminPage.tsx`
- Create: `frontend/src/features/admin/UserManagement.tsx`
- Create: `frontend/src/features/admin/BackupPanel.tsx`
- Create: `frontend/src/features/admin/OperationsLog.tsx`
- Modify: `frontend/src/app/Workspace.tsx`
- Modify: `frontend/src/tests/components.test.tsx`
- Modify: `README.md`
- Modify: `Steps.md`

**Interfaces:**
- Produces admin tabs `Пользователи и доступ`, `Резервные копии`, `Журнал эксплуатации`.
- Uses the `AdminService` API only; browser never receives DB credentials, dump content, or raw backup paths.

- [ ] **Step 1: Write failing UI test**

```tsx
it('shows backup restore confirmation only to admin', async () => {
  render(<Workspace user={{username:'admin', role:'admin', role_label:'Системный администратор'}} onLogout={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', {name:'Администрирование'}))
  await userEvent.click(screen.getByRole('button', {name:'Восстановить'}))
  expect(screen.getByText(/RESTORE/)).toBeTruthy()
  expect(screen.getByRole('button', {name:'Подтвердить восстановление'})).toBeDisabled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because administration UI does not exist.

- [ ] **Step 3: Implement admin UI and procedures**

Create user create/block/archive and scoped-role controls; do not display password hashes, salts, or passwords after entry. Show backup date, author, checksum verification state, and size. Restore requires the typed server-issued phrase and a clear warning that PostgreSQL will be replaced. Document: creating the initial admin, one-time Plan bootstrap, explicit HR import, archive/restore employee, backup verification, restore confirmation, Docker launch from project root, and test commands. Do not document real `.env` values.

- [ ] **Step 4: Run full verification**

Run:

```powershell
python -m unittest discover -s backend/tests -v
Set-Location frontend
npx vitest run --pool=threads --maxWorkers=1 --minWorkers=1 --reporter=dot
npm run build
Set-Location ..
docker compose up -d --build
docker compose ps
```

Expected: all backend/frontend tests pass; frontend build succeeds; `migrate` completes successfully; `postgres` is healthy; `app` is running on port 8000.

- [ ] **Step 5: Perform browser acceptance using the local app**

Verify as admin: HR appears before TimeTrack; one-time Plan re-import does not alter HR card; HR creates/edits/archives/restores a safe card; TimeTrack opens read-only card and Esc returns focus; admin creates a verified backup, rejects an incorrect restore phrase, and displays an audit event. Verify as HR: no administration menu/endpoint. Verify as manager/employee: scope restrictions return 403/404 as applicable.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/admin frontend/src/app/Workspace.tsx frontend/src/tests/components.test.tsx README.md Steps.md
git commit -m "feat: add admin operations workspace"
```

## Plan Self-Review

- **Spec coverage:** Tasks 1-4 implement safe HR data, one-time Plan bootstrap, lifecycle, imports, registry, calendar and analytics. Tasks 5 and 9 implement admin accounts, roles, logs, backup and controlled restore. Tasks 6-8 implement the two-module UI, editable HR cards, TimeTrack read-only drill-down and Escape behavior.
- **No sensitive-field gap:** every DTO/API/UI task uses an allowlist and tests reject sensitive data; no proposed file stores prototype images, scans, contacts, or localStorage data.
- **Type consistency:** `HrEmployee`, `HrEmployeeUpdate`, `HrService`, `AdminService`, and frontend card interfaces are introduced before their consumers. All mutations are described as API calls authorized by backend roles.
- **Operational safety:** migration is additive; archive replaces delete; Plan bootstrap has an explicit state marker; backup verifies with PostgreSQL tooling and restore has a typed confirmation plus audit.
