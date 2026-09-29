# Результаты проверки — `feature/hr-lifecycle-admin`

Дата актуализации документа: 2026-09-29.

## Подтверждено

| Проверка | Результат | Основание |
| --- | --- | --- |
| Frontend production build | Успешно | `npm.cmd run build`, 2026-09-29; TypeScript и Vite завершились с кодом 0, 55 модулей |
| Компонентные тесты frontend | 57/57 успешно | `npm.cmd test -- --run --maxWorkers=1`, 2026-09-29; 2 test files |
| Backend-набор | 71/71 успешно | Финальный `python -m unittest discover -s backend/tests -v`, 2026-09-29, 146.974 сек. Предупреждения openpyxl/SQLite остались некритичными; ошибок не было. |
| Изолированный work Compose | Успешно, не запущен | `docker compose -p timetrack-work --env-file .env.work.example -f compose.yaml -f compose.work.yaml config -q` завершился с кодом 0 |
| Backup preview PostgreSQL | Создан и проверен | `/var/lib/postgresql/backups/pre-0010-20260929-063257.dump`, 48 693 байта; `pg_restore --list` успешен. Backup и data остаются в именованных томах проекта `timetrack-preview`. |
| Миграция preview PostgreSQL | `0010_kus_card_catalog_admin` | Повторный `migrate` завершился с кодом 0; 169 карточек сохранены, включая 3 `manual:` и 3 записи с фото. История УВР до и после проверки пуста: 0 периодов, 0 версий источников, 0 расчётов. |
| HTTP/API preview | Успешно после финальной пересборки | Health `ok`, версия `0.3.0`; OpenAPI содержит HR, admin catalogs и UWR. Авторизованное чтение/no-op обновление карточки, CRUD временной должности и отказ `409` при удалении используемой должности подтверждены. Временная запись удалена. |
| Права справочников | Успешно | Новый регрессионный тест подтверждает `403` для роли HR и старого `/api/hr/departments`; CRUD выполняет только admin через `/api/admin/catalogs*`. |
| Браузерный reference-check | Успешно | Chrome, viewport 1600×1000: «Офис», кнопка добавления после поиска, 18 отделов в одной строке без обрезания (`intact/oneLine/fits=true`), карточка 1180×760, фото-блок 112×112, открыты четыре административных справочника. |

Компонентный набор покрывает, в частности, вход, импорт пары Excel, фильтрацию, HR CRUD, архив/восстановление, вкладки кадрового модуля, read-only переход из УВР, возврат по Escape, календарные колонки, печать и BI-drill-down.

## Границы проверки

- Автоматизированная браузерная проверка и визуальный просмотр снимков выполнены при 1600×1000. Физическая печать, drag-and-drop и пользовательская проверка на другом масштабе/мониторе остаются частью ручной приёмки.
- Отдельной preview-учётной записи роли `hr` с известным тестовым паролем нет, поэтому живое чтение/обновление карточки выполнено ролью `admin`. Права `hr` на карточку и запрет изменения справочников подтверждены изолированными API-тестами.
- Preview-БД не содержит применённой месячной истории УВР. Сохранность пустой истории подтверждена агрегатами; поведение непустой истории покрывает сервисный тест соединения Plan–факт по UUID, закрепления версий источников и запрета вывода «прогул» по отсутствующей регистрации.

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
