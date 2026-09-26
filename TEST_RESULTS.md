# Результаты проверки — `feature/hr-lifecycle-admin`

Дата актуализации документа: 2026-09-26.

## Подтверждено

| Проверка | Результат | Основание |
| --- | --- | --- |
| Frontend production build | Успешно | `npm.cmd run build`, 2026-09-26; TypeScript и Vite завершились с кодом 0 |
| Компонентные тесты frontend | 52/52 успешно | `npm.cmd test -- --run`, 2026-09-26 |
| Backend-набор | 63/63 успешно | `python -m unittest discover -s backend/tests -v`, 2026-09-26, 144.8 сек. Появлялись предупреждения openpyxl об условном форматировании demo-файла и `ResourceWarning` sqlite-соединений; ошибок не было. |
| Миграции preview PostgreSQL | До `0009_uwr_period_history` | `0008` и `0009` применены; перед миграцией создан и проверен `pg_restore --list` backup на томе Postgres |
| HTTP health preview | Успешно после финальной пересборки | `http://127.0.0.1:8001/api/health` вернул `{"status":"ok","version":"0.3.0"}`, Docker app Up, PostgreSQL healthy; OpenAPI содержит текущие `/api/uvr/periods/*` routes |

Компонентный набор покрывает, в частности, вход, импорт пары Excel, фильтрацию, HR CRUD, архив/восстановление, вкладки кадрового модуля, read-only переход из УВР, возврат по Escape, календарные колонки, печать и BI-drill-down.

## Не подтверждено в дату актуализации

- Реальная браузерная проверка мышью, печать на физическое устройство, drag-and-drop и визуальная адаптация на целевом мониторе. В текущей сессии in-app browser был недоступен.

Сервисный тест месячного расчёта проверяет соединение Plan–факт по UUID, привязку точных версий источников, числовые поля отчёта СК и запрет вывода «прогул» по отсутствующей регистрации. Контейнер и OpenAPI проверены, но браузерный smoke не был возможен.

## Команды перед приёмкой

```powershell
# frontend
Set-Location frontend
npm ci
npm test
npm run build

# backend и PostgreSQL
Set-Location ..
docker compose up -d --build
docker compose exec -T app python -m unittest discover -s backend/tests -t . -v

# изолированный предпросмотр ветки
docker compose -p timetrack-preview -f compose.yaml -f compose.preview.yaml up -d --build
```

Подробный пользовательский чек-лист: [Steps.md](Steps.md). Функциональные границы и нерешённые пункты: [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).
