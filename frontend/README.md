# CodeHunt frontend

Интерфейс каталога задач и административного редактора на Next.js App Router, React, TypeScript, TanStack Query и Tailwind CSS. Компоненты используют Base UI, React Hook Form/Zod и dnd-kit. Версии фиксируются в package-lock.json.

## Запуск

```sh
npm ci
npm run dev
```

В `.env.local` задайте GITHUB_ID, GITHUB_SECRET, NEXTAUTH_SECRET и NEXTAUTH_URL. BACKEND_API_URL — внутренний адрес FastAPI, по умолчанию используется NEXT_PUBLIC_API_URL или localhost:8000. Настройка OAuth и инфраструктуры описана в [руководстве backend](../backend/docs/development.md#github-oauth). Секреты не должны быть NEXT_PUBLIC.

| Маршрут | Назначение |
| --- | --- |
| / | Главная и форма связи |
| /for-company | Страница для компаний и контактная форма |
| /tasks | Каталог с фильтрами и пагинацией |
| /tasks/[slug] | ТЗ, уровни, галерея и вложения |
| /admin/tasks | Задачи, личные черновики и библиотека требований |
| /admin/tasks/editor | Создание/редактирование через параметры taskId или draftId |
| /login | Вход через GitHub |

## Авторизация, SSR и данные

NextAuth хранит backend-токен в зашифрованной HttpOnly cookie. Клиентская сессия его не содержит. Backend определяет администратора по подтверждённым email и ADMIN_EMAILS. Серверный layout защищает административные страницы, backend повторно проверяет каждую операцию. Прокси игнорирует клиентские Authorization/X-User-ID и проверяет Origin мутаций.

`lib/api/server-tasks.ts` получает задачу на сервере с сессией и no-store, мемоизирует только внутри одного рендера. `/tasks/[slug]` формирует HTML с содержимым, metadata и HTTP 404 для отсутствующей/недоступной задачи. HTML не ждёт клиентского запроса за начальным TaskDetail; JavaScript добавляет интерактивность и обновление данных. Общего кеша персональных ТЗ нет. Платные задачи доступны только администраторам и имеют noindex; скрытые задачи открываются через редактор. Каталог пока загружает данные на клиенте.

`lib/tasks/query-keys.ts` задаёт ключ публичной задачи по slug. Мутации инвалидируют каталог и все публичные детали, включая старый slug; router.refresh обновляет серверные данные. Первое изображение загружается сразу, последующие — с loading=lazy. Варианты изображений и CDN не добавлены.

## Редактор

- `lib/api/task-contract.ts` описывает API. У Task есть is_hidden и is_paid, статуса нет. `parent_task_id` сохранён. `lib/api/request.ts` преобразует ошибки в ApiError, сохраняя HTTP-код, прикладной код и `{field, code, message}`.
- TaskDetail содержит объект presets.easy/medium/high; каждый блок содержит preset и собственные complications уровня. Запись использует массив presets и дерево items. Преобразования находятся в `lib/tasks/editor-model.ts`.
- Дерево обслуживают task-tree.ts, task-items-state.ts и use-task-items.ts. Группы имеют один уровень с потомками, максимум три уровня групп. Для идентичности используется nodeKey: ID группы может совпадать с ID пункта.
- `hooks/tasks/use-task-editor.ts` связывает форму, сохранение и файлы. `lib/tasks/draft-coordinator.ts` последовательно выполняет автосохранение, файлы и публикацию с актуальной revision. Только draft_revision_conflict блокирует дальнейшие записи до разрешения конфликта; прочие 409 сохраняют возможность повторить действие. Нетронутая пустая форма не создаёт черновик.
- Готовая задача сохраняет основные поля/состав одним PUT, фотографии и вложения меняются сразу. Удаление выполняется одним DELETE после подтверждения, без предварительного архивирования. Внешние ссылки проверяет backend.
- Отдельные GET пресетов сохранены на backend; экран уже получает эти данные в TaskDetail и не делает лишний запрос. API решений сохранён для будущего интерфейса.

## Файлы и общий UI

Загрузки выполняют существующие компоненты галереи и ресурсов редактора. Старые use-file-upload, табличный FileUpload и неиспользуемая Table удалены. Общая функция форматирования размера находится в `lib/format-bytes.ts`.

Одно фото — до 5 МиБ, галерея — до четырёх фото. При сохранении/публикации задачи нужно хотя бы одно; черновик допускает пустую галерею. Статичные JPEG/PNG/WebP проверяет backend; JPG принимается и при пустом MIME браузера. Вложение — до 50 МиБ, подпись меняется через ResourceTitleEditor.

`taskMediaUrl(url)` направляет постоянный URL через `/api/backend/media/...`. `lib/backend-proxy.ts` передаёт запросы потоками, ограничивает фактическое тело и ожидание backend. Лимиты JSON/multipart описаны в `lib/request-limits.ts` и [API](../backend/docs/api-contracts.md). Медиа сохраняют ETag и private,no-cache: права проверяются даже перед 304. Next Image Optimization отключён у этих изображений.

Общие компоненты пунктов/групп находятся в tasks/task-requirement-card.tsx и task-requirement-group.tsx; формы внутри свёрнутых групп остаются смонтированными. ResponsiveModal выбирает Dialog/Drawer, ConfirmDialog отвечает за подтверждение. PageLayoutHeader принимает backHref для явной ссылки возврата. На публичной странице сначала видны четыре пункта каждого уровня; вложения открываются в адаптивном окне.

## Проверки

```sh
npm run lint
npm run typecheck
npm test
npm run build
E2E_ISOLATED_AUTH=1 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --grep-invert @live
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e:live
```

Typecheck запускает next typegen перед tsc: переименование маршрутов не должно оставлять проверку на старых сгенерированных типах. Изолированные E2E запускают Next.js и тестовый auth-backend, включая серверные фикстуры ТЗ; live-команда поднимает одноразовые настоящие FastAPI/PostgreSQL/MinIO/Redis и копию frontend без рабочего .env. Нужны Docker и Chrome. Подробности и альтернативные команды — в [development.md](../backend/docs/development.md#тесты-и-статические-проверки).

Единственная сводка актуальных результатов проверок — в [CONTEXT.md](../backend/CONTEXT.md). При изменении контракта обновляйте API-типы, преобразования и фикстуры вместе.
