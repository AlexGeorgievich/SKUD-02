# KUS Card and Admin Catalogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder and validate the KUS employee card, normalize positions, and move full catalog management into the administrator module without breaking existing employee UUIDs, photos, Excel compatibility, or UWR links.

**Architecture:** Extend the additive PostgreSQL HR schema with `birth_place` and `position_id`, reuse `hr_catalog_values(kind="position")`, and keep legacy display columns for compatibility. Keep read-only catalog delivery under `/api/hr/catalogs`, put catalog mutations under `/api/admin/catalogs/*`, and split the React card into focused personal/work tab components while the existing schedule/access tabs remain behaviorally unchanged.

**Tech Stack:** Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL 16, unittest/TestClient, React 19, TypeScript 5, Vite 7, Vitest/Testing Library, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-27-kus-card-admin-catalogs-design.md`

## Global Constraints

- Work only in `feature/hr-lifecycle-admin`; do not merge to `main` or push unless separately requested.
- Preserve employee UUIDs, all three manual demo cards, photographs, UWR links, monthly source versions, and calculation history.
- KUS remains the roster source; Plan/СКУД/СК imports must never create or rewrite KUS cards.
- `Распорядок`, `СКУД и доступ`, and the photo panel retain their existing behavior.
- Every date field in this change uses a full `YYYY-MM-DD` value and a browser calendar control.
- Only `admin` mutates catalogs; `hr` may read catalog values and edit employee cards.
- Deleting a referenced catalog item returns `409`; never cascade-delete or silently clear references.
- Before applying migration `0010` to preview PostgreSQL, create and verify a fresh database backup; never use `docker compose down -v`.
- Do not stage or overwrite the pre-existing local modification to `demo/Demo-control.xlsx`.
- Implement each behavior test-first and commit each task separately.

## Review Focus

- Legacy cards containing an unknown gender or old work-format label must remain readable and unchanged until HR explicitly selects a supported value; pin this in Task 1 migration and Task 2 API tests.
- Case-only or whitespace-only duplicate catalog names must be rejected without modifying the existing item; pin this in Task 3 repository/API tests.
- A referenced office, department, legal entity, or position must return `409` on delete and leave all rows intact; pin this in Task 3 API tests.
- Changing the office while retaining a department from another office must not save an inconsistent card; pin backend rejection and frontend department reset in Tasks 2 and 4.
- Partial/invalid date ranges (`probation_end_date < hire_date`, `deputy_until < deputy_from`) must fail with the card left open; pin server validation and visible frontend error behavior in Tasks 2 and 4.

---

### Task 1: Additive KUS Schema and Position Backfill

**Files:**
- Create: `backend/alembic/versions/0010_kus_card_catalog_admin.py`
- Modify: `backend/app/hr/models.py`
- Modify: `backend/app/hr/repository.py`
- Test: `backend/tests/test_kus_migration.py`

**Interfaces:**
- Produces: `HrEmployee.birth_place: str | None`, `HrEmployee.position_id: str | None` referencing `hr_catalog_values.id`.
- Produces: catalog values with `kind="position"`; existing `HrEmployee.position` remains the readable compatibility value.
- Consumes: migration head `0009_uwr_period_history` and current catalog tables from `0008_kus_catalogs`.

- [ ] **Step 1: Write failing migration tests**

Add `test_0010_adds_birth_place_and_position_reference_without_changing_employee_identity` and `test_0010_backfills_distinct_trimmed_positions_and_preserves_unknown_catalog_values`. Assert that UUID/`plan_employee_id` are unchanged, duplicate textual positions produce one `position` catalog item, employees receive `position_id`, and pre-existing unknown gender/work-format rows are untouched.

- [ ] **Step 2: Run the migration tests and verify RED**

Run: `python -m unittest backend.tests.test_kus_migration -v`

Expected: FAIL because revision `0010` and the two model columns do not exist.

- [ ] **Step 3: Implement migration `0010_kus_card_catalog_admin`**

Add nullable `birth_place` and indexed nullable `position_id`, foreign-key it to `hr_catalog_values.id`, insert one normalized `kind="position"` value per unique non-empty legacy position, and backfill links. Make downgrade remove only the new FK/index/columns and generated position rows only when they are unreferenced; never alter employee identity or unrelated catalog values.

- [ ] **Step 4: Extend the ORM and repository projections**

Add both fields to `HrEmployee`, add them to `SAFE_FIELDS`, include `position_id` validation in `validate_card_values`, resolve `position` from the selected catalog in employee/export projections, and include `positions` in the `/api/hr/catalogs` response while retaining `values` for compatibility.

- [ ] **Step 5: Run migration tests and verify GREEN**

Run: `python -m unittest backend.tests.test_kus_migration -v`

Expected: all migration tests PASS with no lost rows.

- [ ] **Step 6: Commit Task 1**

Run: `git add backend/alembic/versions/0010_kus_card_catalog_admin.py backend/app/hr/models.py backend/app/hr/repository.py backend/tests/test_kus_migration.py`

Run: `git commit -m "feat: normalize KUS positions and birth place"`

### Task 2: Employee Card Validation and Canonical Display Name

**Files:**
- Modify: `backend/app/hr/schemas.py`
- Modify: `backend/app/hr/service.py`
- Modify: `backend/app/hr/repository.py`
- Modify: `backend/app/api/routes/hr.py`
- Test: `backend/tests/test_kus_api.py`
- Test: `backend/tests/test_hr_service.py`
- Test: `backend/tests/test_hr_xlsx.py`

**Interfaces:**
- Consumes: `birth_place`, `position_id`, and `positions` from Task 1.
- Produces: `HrEmployeeUpdate.birth_place`, `position_id`, strict full-date range validation, fixed gender/work-format validation, and canonical `plan_name = "{family_name} {given_name}"`.
- Produces: detailed employee JSON containing readable `position` plus `position_id`; private-field scoping remains server-side.

- [ ] **Step 1: Write failing API/service tests**

Add tests asserting: `plan_name` is read-only input in structured create/update and becomes `Иванова Анна` without patronymic; `birth_place` round-trips; only «Мужской/Женский» and fixed/free/flexible catalog values are accepted; mismatched office/department, archived/wrong-department leader, probation end before hire, and deputy end before start are rejected. Confirm an untouched legacy unknown gender/work-format card is still readable.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `python -m unittest backend.tests.test_kus_api backend.tests.test_hr_service -v`

Expected: FAIL on missing fields/name rule/date range checks.

- [ ] **Step 3: Implement schema and service rules**

Add fields to `HrEmployeeUpdate`; exclude client `plan_name` from structured-name saves; implement `display_name(family_name: str, given_name: str) -> str`; require the two name parts on new structured cards; validate date ranges before repository mutation; enforce `gender` labels and work-format labels `fixed/free/flexible` mapped to «Фиксированный/Свободный/Гибкий».

- [ ] **Step 4: Preserve HR Excel compatibility**

Keep the original 25-column export/import contract: export resolved readable position and full dates; import legacy position text through the position catalog and continue preview/apply rather than changing headers.

- [ ] **Step 5: Run targeted tests and verify GREEN**

Run: `python -m unittest backend.tests.test_kus_api backend.tests.test_hr_service backend.tests.test_hr_xlsx -v`

Expected: all targeted tests PASS.

- [ ] **Step 6: Commit Task 2**

Run: `git add backend/app/hr/schemas.py backend/app/hr/service.py backend/app/hr/repository.py backend/app/api/routes/hr.py backend/tests/test_kus_api.py backend/tests/test_hr_service.py backend/tests/test_hr_xlsx.py`

Run: `git commit -m "feat: validate structured KUS card fields"`

### Task 3: Administrator Catalog CRUD and Dependency Guards

**Files:**
- Create: `backend/app/admin/catalog_service.py`
- Modify: `backend/app/api/routes/admin.py`
- Modify: `backend/app/hr/repository.py`
- Modify: `backend/app/hr/schemas.py`
- Test: `backend/tests/test_admin_catalogs.py`

**Interfaces:**
- Produces: `GET /api/admin/catalogs`, `POST /api/admin/catalogs/{kind}`, `PATCH /api/admin/catalogs/{kind}/{item_id}`, and `DELETE /api/admin/catalogs/{kind}/{item_id}`.
- Produces: kinds `legal_entities`, `offices`, `departments`, `positions`; item JSON includes `id`, `name`, `employee_count`, plus `office_id`, `head_id`, and `department_count` where applicable.
- Consumes: HR repository models and Task 1 `position` catalog values.

- [ ] **Step 1: Write failing admin catalog API tests**

Cover admin list/create/rename/delete for all four kinds; HR receives `403`; blank/trimmed/case-insensitive duplicates receive `409`; deleting each referenced kind receives `409` with dependency counts and leaves employees/departments unchanged; an unreferenced item is deleted. Include an office used only by a department and a department with a structural head.

- [ ] **Step 2: Run the new test module and verify RED**

Run: `python -m unittest backend.tests.test_admin_catalogs -v`

Expected: FAIL with missing routes/service.

- [ ] **Step 3: Implement repository catalog operations**

Add `catalog_usage(kind: str, item_id: str) -> dict`, `create_catalog_item(kind: str, values: dict)`, `update_catalog_item(kind: str, item_id: str, values: dict)`, and `delete_catalog_item(kind: str, item_id: str)`. Use transactions, normalized uniqueness checks, and explicit dependency queries; never cascade or clear employee fields.

- [ ] **Step 4: Implement admin service and routes**

Centralize kind/model mapping and safe Russian error messages in `AdminCatalogService`; call existing `require_admin`; translate missing items to `404`, validation to `400`, duplicate/dependency conflicts to `409`; add audit rows containing field names and IDs, not private employee values.

- [ ] **Step 5: Run admin and regression API tests**

Run: `python -m unittest backend.tests.test_admin_catalogs backend.tests.test_admin_api backend.tests.test_kus_api -v`

Expected: all tests PASS.

- [ ] **Step 6: Commit Task 3**

Run: `git add backend/app/admin/catalog_service.py backend/app/api/routes/admin.py backend/app/hr/repository.py backend/app/hr/schemas.py backend/tests/test_admin_catalogs.py`

Run: `git commit -m "feat: manage HR catalogs from administration"`

### Task 4: Rebuild Personal and Work Tabs

**Files:**
- Create: `frontend/src/features/hr/HrPersonalFields.tsx`
- Create: `frontend/src/features/hr/HrWorkFields.tsx`
- Create: `frontend/src/features/hr/contactFormat.ts`
- Modify: `frontend/src/features/hr/HrEmployeeCard.tsx`
- Modify: `frontend/src/features/hr/HrPage.tsx`
- Modify: `frontend/src/features/hr/hrTypes.ts`
- Modify: `frontend/src/shared/styles/react.css`
- Test: `frontend/src/tests/components.test.tsx`

**Interfaces:**
- Consumes: employee/catalog JSON from Tasks 1–2.
- Produces: `formatPersonalPhone(value: string) -> string` and `normalizePersonalPhoneInput(value: string) -> string` for `+7 (___) ___-__-__` editing.
- Produces: ordered personal/work tab components receiving `{draft, disabled, catalogs, employees, onChange}`; schedule/access and photo panel remain in `HrPage` unchanged.

- [ ] **Step 1: Write failing component tests for exact card behavior**

Assert the exact label order in both tabs; FIO is disabled/read-only and changes to `Иванова Анна` when surname/name change while patronymic does not affect it; all six date fields use `type=date`; gender has only «Мужской/Женский»; phone renders the agreed mask; Telegram/email expose their templates; office change clears an incompatible department; department leaders are scoped; photo panel remains; schedule/access controls remain present and unchanged. Assert API error text stays visible without closing the dialog.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm.cmd test -- --run src/tests/components.test.tsx`

Expected: FAIL on field order, missing place/position selector, editable FIO, and absent mask.

- [ ] **Step 3: Implement phone formatting as a pure utility**

Accept digits with or without Russian prefix, cap at 11 digits, render progressively as `+7 (999) 123-45-67`, and submit the normalized form already accepted by backend validation. Add direct utility assertions in the component test module or a focused `contactFormat.test.ts`.

- [ ] **Step 4: Implement focused personal/work components**

Render labels exactly as the spec orders them. Use read-only FIO; full-date controls; fixed gender/work-format options; catalog selectors for legal entity/office/department/position; conditional probation date; and department-filtered head/deputy lists. Remove duplicate comments/responsibility from schedule rendering without changing its remaining controls; leave access rendering byte-for-byte behaviorally equivalent.

- [ ] **Step 5: Update draft/payload types and save behavior**

Add `birth_place`, `position_id`, and `positions`; compute FIO from only family/given name; omit stale department IDs after office change; keep old readable fields for display; preserve photo upload and read-only modes.

- [ ] **Step 6: Run component tests and production build**

Run: `npm.cmd test -- --run`

Expected: all frontend tests PASS.

Run: `npm.cmd run build`

Expected: TypeScript and Vite exit `0`.

- [ ] **Step 7: Commit Task 4**

Run: `git add frontend/src/features/hr/HrPersonalFields.tsx frontend/src/features/hr/HrWorkFields.tsx frontend/src/features/hr/contactFormat.ts frontend/src/features/hr/HrEmployeeCard.tsx frontend/src/features/hr/HrPage.tsx frontend/src/features/hr/hrTypes.ts frontend/src/shared/styles/react.css frontend/src/tests/components.test.tsx`

Run: `git commit -m "feat: reorganize KUS employee card"`

### Task 5: Move Catalog Management into Administration

**Files:**
- Create: `frontend/src/features/admin/AdminCatalogs.tsx`
- Modify: `frontend/src/features/admin/AdminPage.tsx`
- Modify: `frontend/src/features/hr/HrPage.tsx`
- Delete: `frontend/src/features/hr/HrCatalogs.tsx`
- Modify: `frontend/src/shared/styles/react.css`
- Test: `frontend/src/tests/components.test.tsx`

**Interfaces:**
- Consumes: Task 3 `/api/admin/catalogs*` routes.
- Produces: administrator sub-tabs `Пользователи`, `Справочники`, `Резервные копии`; `AdminCatalogs` handles four catalog kinds and refreshes after successful mutation.

- [ ] **Step 1: Write failing navigation and CRUD component tests**

Assert HR no longer sees «Справочники» in KUS; admin opens the new admin sub-tab; each kind supports add/edit/delete; delete asks for explicit confirmation; a `409` dependency message remains visible and does not remove the row; department form offers office/head; usage counts render.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm.cmd test -- --run src/tests/components.test.tsx`

Expected: FAIL because catalogs still live in HR and admin has no catalog UI.

- [ ] **Step 3: Implement `AdminCatalogs`**

Use the shared API client, explicit edit/create state, safe confirmation for delete, and refresh only after successful mutation. Do not offer force-delete. Render the server dependency message verbatim through `notify` and retain the current list.

- [ ] **Step 4: Integrate admin sub-tabs and remove HR catalog mutation entry points**

Keep users/backups behavior intact, place «Выгрузить КУС в Excel» in the HR registry `.hr-module-actions` beside «Печать / PDF» and «Обновить», remove HR `catalogs` section state and inline department creation modal, and ensure HR continues loading `/api/hr/catalogs` for card selectors.

- [ ] **Step 5: Run frontend tests and build**

Run: `npm.cmd test -- --run`

Expected: all frontend tests PASS.

Run: `npm.cmd run build`

Expected: all tests PASS and build exits `0`.

- [ ] **Step 6: Commit Task 5**

Run: `git add frontend/src/features/admin/AdminCatalogs.tsx frontend/src/features/admin/AdminPage.tsx frontend/src/features/hr/HrPage.tsx frontend/src/shared/styles/react.css frontend/src/tests/components.test.tsx`

Run: `git add -u frontend/src/features/hr/HrCatalogs.tsx`

Run: `git commit -m "feat: move HR catalogs to administration"`

### Task 6: Apply Registry Visual Corrections

**Files:**
- Modify: `frontend/src/features/hr/HrPage.tsx`
- Modify: `frontend/src/shared/styles/react.css`
- Test: `frontend/src/tests/components.test.tsx`
- Test: `frontend/scripts/hr-reference-check.mjs`

**Interfaces:**
- Consumes: existing KUS registry and browser reference-check script.
- Produces: metric label `Офис`, add button after the search input, one-line department strip with larger type, smaller padding, intact labels, and horizontal overflow fallback.

- [ ] **Step 1: Write failing layout contract tests**

Assert «Группы» is absent and «Офис» present; `＋ Добавить` follows the search input in DOM order and is absent from `.hr-system-actions`; CSS contract includes `flex-wrap:nowrap`, `overflow-x:auto`, `white-space:nowrap`, font size at least `10px`, compact padding no larger than `4px 6px`, and no ellipsis/max-width clipping.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm.cmd test -- --run src/tests/components.test.tsx`

Expected: FAIL on old label/button placement and current 7px/hidden department strip.

- [ ] **Step 3: Implement markup and responsive CSS**

Move the add button without changing its role guard or handler. Use an isolated horizontal scroll container with keyboard/wheel accessibility; keep all buttons one line, enlarge text, reduce padding, and preserve selected/hover states.

- [ ] **Step 4: Run automated frontend verification**

Run: `npm.cmd test -- --run`

Expected: all frontend tests PASS.

Run: `npm.cmd run build`

Expected: all tests PASS and build exits `0`.

- [ ] **Step 5: Run the browser reference check when browser automation is available**

Run from `frontend`: `$env:TIMETRACK_TEST_PASSWORD='<local test password>'; node scripts/hr-reference-check.mjs`

Expected: screenshots show the photo panel, full non-clipped card, and one-line department strip at the target viewport. Never print or commit the password. If browser automation is unavailable, record the boundary in `TEST_RESULTS.md` and require user visual acceptance.

- [ ] **Step 6: Commit Task 6**

Run: `git add frontend/src/features/hr/HrPage.tsx frontend/src/shared/styles/react.css frontend/src/tests/components.test.tsx frontend/scripts/hr-reference-check.mjs`

Run: `git commit -m "fix: refine KUS registry layout"`

### Task 7: Documentation, Full Regression, Migration and Preview Acceptance

**Files:**
- Modify: `docs/CURRENT_STATE.md`
- Modify: `docs/Architecture.md`
- Modify: `README.md`
- Modify: `Steps.md`
- Modify: `TEST_RESULTS.md`
- Modify: `backend/README.md`
- Modify: `frontend/README.md`

**Interfaces:**
- Consumes: all Tasks 1–6.
- Produces: verified operational record and a running `timetrack-preview` on port `8001`; does not start the isolated work contour on `8002`.

- [ ] **Step 1: Update documentation to match implemented behavior**

Describe exact card fields, admin-only catalog CRUD and delete guards, position migration, KUS/UWR identity compatibility, photo preservation, revised registry layout, and remaining admin/UI acceptance boundaries. Remove superseded claims that HR manages catalogs or that FIO is directly editable.

- [ ] **Step 2: Run clean full local verification**

Run: `python -m unittest discover -s backend/tests -v`

Expected: all backend tests PASS.

Run from `frontend`: `npm.cmd test -- --run` then `npm.cmd run build`

Expected: all frontend tests PASS and build exits `0`.

Run: `git diff --check`

Expected: exit `0`; CRLF warnings are informational, whitespace errors are not.

- [ ] **Step 3: Validate isolated work Compose configuration without starting it**

Run: `docker compose -p timetrack-work --env-file .env.work.example -f compose.yaml -f compose.work.yaml config -q`

Expected: exit `0`; no secret output and no work containers started.

- [ ] **Step 4: Back up preview PostgreSQL before migration**

Create a new timestamped custom-format dump inside the existing preview backup volume and verify it with `pg_restore --list`. Record only its non-secret path, size/check result, and preview Compose provenance; do not delete prior backups.

- [ ] **Step 5: Apply migration and rebuild the preview**

Run: `docker compose -p timetrack-preview -f compose.yaml -f compose.preview.yaml run --rm --build --no-deps migrate`

Expected: Alembic advances from `0009_uwr_period_history` to `0010_kus_card_catalog_admin`.

Run: `docker compose -p timetrack-preview -f compose.yaml -f compose.preview.yaml up -d --build`

Expected: app is Up on `8001`; PostgreSQL is healthy; no volume replacement.

- [ ] **Step 6: Verify live identity and API surface**

Check `/api/health`, `/openapi.json`, authenticated HR card read/update, admin catalog CRUD with an unreferenced test item, and a rejected delete for a referenced item. Verify aggregate employee count, three manual cards, revision `0010`, and existing UWR period counts without printing PII.

- [ ] **Step 7: Perform visual acceptance or record its boundary**

Verify the supplied reference conditions at the target viewport: photo block present; fields visible and scrollable; one-line department strip with increased font and compact padding; `Офис` metric; add button after search; admin catalogs usable. If CUA/browser is unavailable, state this explicitly and do not claim visual acceptance.

- [ ] **Step 8: Commit Task 7**

Run: `git add docs/CURRENT_STATE.md docs/Architecture.md README.md Steps.md TEST_RESULTS.md backend/README.md frontend/README.md`

Run: `git commit -m "docs: record KUS card and catalog acceptance"`

- [ ] **Step 9: Final branch review**

Run: `git status --short`, `git log --oneline --decorate -12`, and compare every item in the spec readiness checklist to fresh evidence. Do not stage `demo/Demo-control.xlsx`; do not push or merge without a separate user request.
