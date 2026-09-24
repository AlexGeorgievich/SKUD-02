# Результаты проверки — `feature/hr-lifecycle-admin`

Дата актуализации документа: 2026-09-24.

## Подтверждено

| Проверка | Результат | Основание |
| --- | --- | --- |
| Frontend production build | Успешно | `npm run build`, 2026-09-24; TypeScript и Vite завершились без ошибки |
| Компонентные тесты frontend | Последний полный прогон: 49/49 успешно | `src/tests/components.test.tsx` во время последней итерации UI |
| HTTP предпросмотра | Ранее успешно | `http://127.0.0.1:8001/` возвращал `200` после пересборок HR UI |

Компонентный набор покрывает, в частности, вход, импорт пары Excel, фильтрацию, HR CRUD, архив/восстановление, вкладки кадрового модуля, read-only переход из УВР, возврат по Escape, календарные колонки, печать и BI-drill-down.

## Не повторено в дату актуализации

- Backend/API-набор `python -m unittest discover -s backend/tests -t . -v`.
- Docker/PostgreSQL smoke-набор и создание backup.
- Реальная браузерная проверка мышью, печать на физическое устройство, drag-and-drop и визуальная адаптация на целевом мониторе.

Причина: в момент обновления документации локальная `.venv` отсутствовала, а Docker daemon был недоступен. Это не означает сбой тестов и не является подтверждением их актуального прохождения.

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
