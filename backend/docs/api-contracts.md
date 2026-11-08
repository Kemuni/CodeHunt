# Контракты backend API

Сверено с маршрутизаторами, схемами и сервисами **08.11.2026**. Общий префикс `/api`, Swagger `/docs`, OpenAPI `/openapi.json`. Таблица в конце составлена по коду зарегистрированных маршрутов. Описание не означает, что все маршруты сейчас проходят тесты.

Оба GET configuration и создание решения используют composition.configuration. Накопительная семантика пресетов сохранена.

## Ответы и доступ

Успешные операции, кроме health-check и бинарных ответов медиапрокси, возвращают `{"success": true, "data": ..., "errors": null}`. Пустой успешный ответ имеет data: null. Ошибка: `success: false`, `data: null`, `errors: {code, message, details}`. Health-check возвращает `{"status": "ok"}` и не проверяет соединение с БД или MinIO.

Постраничный ответ в data: `{items, total, limit, offset}`, limit по умолчанию 20, допустимо 1–100, offset от 0. Полные деревья библиотеки и состава задания не пагинируются.

| Доступ | Правило |
| --- | --- |
| Публичный | Чтение библиотеки, опубликованных нескрытых задач и их файлов, contact-request, health-check |
| Администратор | Все операции редактора и запись категорий/шаблонов, Bearer-сессия и подтверждённый email из ADMIN_EMAILS |
| Владелец черновика | Дополнительно owner_id совпадает с текущим администратором, чужие формы/файлы дают 404 |
| Автор решения | Bearer-сессия обязательна, чтение и изменение только своих решений, чужие дают 404 |

Отсутствующая, истёкшая или отозванная Bearer-сессия — 401; обычный пользователь в редакторе — 403. X-User-ID игнорируется. На публичных маршрутах авторизация не обязательна. Проверка владельца файлов выполняется до Redis и ответа 304.

В PATCH отсутствие поля сохраняет старое значение. null разрешён только для очищаемых полей соответствующей схемы. Неполная форма TaskDraft отдельно допускает предметно невалидные значения. ID положительные, специальные верхние ограничения BIGINT на границе API не вводятся.

## Библиотека

`GET /task-complications/library?q=...&developer_type=frontend` возвращает в data массив `{developer_type, categories}`. Порядок групп: frontend, fullstack. Пустые группы отсутствуют, при отсутствии совпадений — `[]`.

Категория содержит id, title, parent_id, developer_type, complications и children. Шаблон в complications содержит id, category_id, title, description и даты. **Slug шаблона удалён.**

Поиск q применяется к title/description шаблона. Предки сохраняются только в пределах того же developer_type. Категория с родителем другого направления становится корнем своей группы с неизменным parent_id. Без q возвращаются и пустые категории выбранного направления.

Отдельный список категорий поддерживает parent_id, roots_only, developer_type. Отсутствие parent_id означает отсутствие фильтра. `roots_only=true` означает `parent_id IS NULL`. Передавать одновременно roots_only=true и parent_id нельзя. Строка `parent_id=null` в query не является SQL NULL.

Отдельный список шаблонов поддерживает q, category_id, developer_type. Для записи шаблона нужны `{category_id, title, description}`. У используемого шаблона изменение title/description даёт 409 template_in_use.

## Списки и детали Task

Публичный `/tasks` поддерживает q по title/short_description, developer_type, level по существующим пресетам, difficulty_min/max и parent_task_id. Диапазон сложности фильтруется по пересечению, значения 0–10. Возвращаются только published и is_hidden=false.

`/editor/tasks` и `/editor/tasks/all` используют один обработчик, доступны администратору и включают все состояния. Фильтры: status и is_hidden плюс пагинация. Не следует предполагать, что все фильтры публичного каталога есть в редакторе.

`TaskRead` содержит основные поля задачи, status, is_hidden, даты и cover_photo. Cover — объект PhotoRead со стабильным url либо null. У PhotoRead больше нет expires_in. Другие фото в список не включаются. PhotoRead содержит также id, task_id/draft_id, position, is_cover, original_filename, content_type, size_bytes и даты. object_key не возвращается.

`GET /tasks/{id}`, `GET /tasks/by-slug/{slug}`, `GET /editor/tasks/{id}` и публикация черновика возвращают TaskDetail:

| Поле | Содержимое |
| --- | --- |
| Основные поля | Те же, что TaskRead |
| cover_photo | Титульная фотография или null |
| photos | Вся галерея по position, включая титульное фото, или [] |
| resources | Метаданные вложений с постоянным url без expires_in, порядок по id |
| presets.easy | `{preset, complications}` только easy |
| presets.medium | `{preset, complications}` только medium |
| presets.high | `{preset, complications}` только high |

Все три ключа уровня присутствуют всегда. `preset` — метаданные PresetRead либо null. `complications` — смешанное дерево пунктов и групп, включая пустые группы своего уровня. Ветви без пресета не теряются. Верхнеуровневого `complications` больше нет.

Это отличается от `GET .../presets/{preset_id}/configuration`: его data содержит `{preset, complications}` с накопительным составом. Medium выбирает easy+medium, high — все уровни. Пустые ветки конфигурации скрываются. Наличие метаданных нижнего пресета для наследования пунктов не требуется.

## Запись задания и дерева

Для создания готового задания `POST /editor/tasks` принимает TaskPublication. Пример минимальной полной формы с группой:

```json
{
  "slug": "movie-catalog",
  "title": "Каталог фильмов",
  "short_description": "Поиск фильмов",
  "full_description": "Создайте каталог с пагинацией",
  "developer_type": "frontend",
  "difficulty_from": 1,
  "difficulty_to": 4,
  "items": [
    {
      "kind": "group",
      "title": "Каталог",
      "level": "easy",
      "items": [
        {
          "kind": "complication",
          "title": "Пагинация фильмов",
          "description": "Добавьте переключение страниц каталога",
          "acceptance_criteria": "Номер страницы сохраняется в URL",
          "level": "easy",
          "is_required": true
        }
      ]
    }
  ],
  "presets": [
    {"level": "easy", "description": "Базовый каталог"}
  ]
}
```

Новые группы и пункты не имеют ID БД. complication_id можно указать для связи с существующим шаблоном. Пресеты имеют обязательные level/description и необязательный average_days_to_complete. Хотя бы один пресет с непустым накопительным составом обязателен. Ответ создания — TaskRead, не TaskDetail.

`PUT /editor/tasks/{id}/composition` принимает `{items}` в этом же формате, у существующих узлов передаётся id. Это полная замена дерева с сохранением идентификаторов. Порядок массива задаёт порядок соседей, вложенность — родителя. В группе level обязателен и одинаков у всех потомков. Ограничения: 10 уровней и 1000 элементов. Пропущенные пункты и группы удаляются, но используемое решением требование удалить нельзя. При ошибке весь запрос откатывается.

Для изменения текста связанного пункта требуется явный complication_id: прежний, другой либо null. Это действует для полного PUT и точечного PATCH, проверяется смена title/description/acceptance_criteria. Общий текст шаблона не подставляется вместо конкретного.

Группы редактируются через composition, отдельного CRUD групп нет. Точечные маршруты пунктов и пресетов сохранены. Copy требования принимает source_link_id и необязательные title/level/position, создаёт новый пункт в корне целевого задания. Маршрут order принимает все ID соответствующего текущего плоского списка ровно один раз, для дерева предпочтителен PUT composition.

PATCH Task не принимает items/presets. Он меняет основные поля, status и is_hidden. Опубликованное задание должно оставаться пригодным к публикации после изменений. Удаление требует archived и отсутствия защищённых внешних ссылок.

## TaskDraft: форма, файлы, публикация

1. POST `/editor/task-drafts` с `{}` или `{"payload": {...}}` создаёт форму текущего администратора.
2. PATCH `/{id}` принимает `{revision, payload}`. Ключи верхнего уровня объединяются, массивы items/presets заменяются целиком. Допустимы неполные и некорректные значения, неизвестные верхнеуровневые ключи отклоняются. Лимит JSON — 256000 байт.
3. Ответ DraftRead содержит id, owner_id, payload, revision, даты, validation_errors, is_valid, photos и resources. Ошибки `{field, code, message}` пересчитываются по текущей БД при каждом чтении/сохранении. Файлы находятся рядом с payload.
4. POST `/{id}/publish` с `{revision}` повторно проверяет форму, создаёт Task и его состав, переносит привязки файлов и удаляет черновик одной транзакцией. Ответ 201 с TaskDetail. При ошибке транзакции форма и привязки остаются. Объекты MinIO не копируются.

Например, ошибка `{"field":"slug","code":"slug_taken","message":"Этот slug уже используется заданием"}` находится в data.validation_errors, а не errors успешного сохранения. Ошибки вложенных полей имеют путь вида items.0.items.0.complication_id. При публикации невалидной формы возвращается 422 draft_invalid с errors.details. Проверка не резервирует slug.

Revision увеличивается при любом успешном изменении формы или её файлов. Старое значение даёт 409 draft_revision_conflict. Для DELETE формы передаётся query revision. При публикации после удаления формы повторный запрос даёт 404, ключа идемпотентности пока нет.

## Фотографии и вложения

| Действие | Task | TaskDraft |
| --- | --- | --- |
| Добавить фото | POST /editor/tasks/{id}/photos, multipart files | POST /editor/task-drafts/{id}/photos, multipart files и revision |
| Сохранить порядок/удалить фото | PUT .../photos, JSON photo_ids | PUT .../photos, JSON photo_ids и revision |
| Добавить вложение | POST .../resources, multipart file, title, type | То же плюс revision, title/type необязательны |
| Изменить вложение | PATCH .../resources/{id}, title/type | То же плюс revision в JSON |
| Удалить вложение | DELETE .../resources/{id} | То же плюс revision в query |
| Получить ссылку | GET .../resources/{id}/download-url | То же, доступ только своему администратору |

Для файловых мутаций TaskDraft ответ — вся обновлённая DraftRead. У Task операции фото возвращают массив PhotoRead, POST/PATCH ресурса — ResourceRead, DELETE — пустой успешный ответ. Отдельный GET списка ресурсов Task возвращает метаданные без URL, URL включён в агрегированные TaskDetail/DraftRead либо выдаётся download-url.

Максимум четыре фото, первое в photo_ids титульное. Отсутствующие ID удаляются, `[]` очищает галерею. JPEG/PNG/WebP статичные, до 10 МиБ и 20 млн пикселей, проверяется реальное содержимое Pillow. Вложения до 50 МиБ, MIME хранится как метаданные. Для черновика title по умолчанию имя файла, type=other.

Тип ресурса: design/specification/asset/other. Файлы могут принадлежать только одному Task или TaskDraft. Успешная публикация сохраняет ID и ключи объектов. Неудачная загрузка компенсируется удалением только новых объектов. Обычное удаление метаданных оставляет файл для будущей очистки.

URL вложения — `/api/media/resources/{id}`. DownloadURL содержит только url, expires_in удалён. Ссылки сохраняются после публикации черновика. Каждый запрос байтов, HEAD или If-None-Match проверяет владельца и видимость; скрытие Task запрещает публичную выдачу даже из кеша. download-url проверяет принадлежность записи в БД; отсутствие объекта в MinIO обнаруживается при скачивании, если байтов нет в Redis.

## Решения

Контракт старта: `POST /tasks/{id}/solutions` с `{author_id, task_level_preset_id}` и необязательным массивом excluded_complication_link_ids. Автор должен совпадать с пользователем сессии. Описание, GitHub и рейтинг при старте не передаются. Можно исключить все пункты, включая is_required. Текущая регрессия этого маршрута отмечена в начале документа.

Сервер сохраняет независимые снимки постановки, пресета и выбранных пунктов. Новый пользовательский пункт создаётся через POST `/solutions/{id}/complications`, его original_complication_link_id всегда null. Поле implementation_description описывает способ реализации.

PUT completion устанавливает resolved_at, повторный PUT сохраняет дату. DELETE completion очищает дату. Завершение решения не требует завершения пунктов и наоборот. Статус in_progress/completed вычисляет БД. GitHub и difficulty_rating необязательны, рейтинг 0–10.

GET /solutions фильтрует только решения текущего автора, дополнительно task_id/author_id/status. Параметр author_id не открывает доступ к чужим решениям. Удаления решения целиком в API сейчас нет, хотя FK допускает каскадное удаление его пунктов на уровне БД.

## Ошибки для интерфейса

| Код | HTTP | Значение |
| --- | --- | --- |
| validation_error | 422 | Структура/тип запроса, сообщения собраны в errors.message |
| draft_invalid | 422 | Форма не готова к публикации, подробности в errors.details |
| draft_revision_conflict | 409 | Нужно перечитать форму перед новой записью |
| template_confirmation_required | 422 | Нужно явно подтвердить complication_id |
| template_in_use | 409 | Нельзя менять смысл используемого шаблона |
| already_exists | 409 | Нарушена уникальность, в том числе конкурентная публикация slug |
| reference_conflict | 409 | Объект связан с другими записями или ссылка отсутствует |
| constraint_violation | 422 | Нарушено ограничение БД, например уровень группы |
| photo_limit | 409 | Больше четырёх фото |
| file_too_large | 413 | Превышен размер файла |
| invalid_photo | 422 | Неподдерживаемое или повреждённое изображение |
| upload_size_mismatch | 503 | Размер после загрузки не совпал |
| storage_not_configured / storage_unavailable | 503 | Настройки или доступность хранилища |
| file_not_found | 404 | Объект отсутствует в хранилище при stat |

Live validation черновика использует также коды slug_taken, parent_not_found, template_not_found, duplicate_level, empty_configuration. Сообщения Pydantic могут быть на английском, обязательна обработка полей и кодов, а не разбор текста.

## Полный перечень маршрутов

Пути ниже включают `/api`. Значок † отмечает вызовы, затронутые известной регрессией configuration. Доступ «автор» или «владелец» включает проверку существующего пользователя через Bearer-сессию.

| Метод | Путь | Доступ | Назначение |
| --- | --- | --- | --- |
| POST | `/api/contact-request/candidate` | публичный | Создание запроса на связь от соискателя |
| POST | `/api/contact-request/employer` | публичный | Создание запроса на связь от работодателя |
| GET | `/api/editor/task-drafts` | владелец | Список собственных черновиков с повторной проверкой их ошибок. |
| POST | `/api/editor/task-drafts` | владелец | Сохранить неполную форму текущего администратора с актуальными ошибками. |
| DELETE | `/api/editor/task-drafts/{draft_id}` | владелец | Удалить собственный черновик формы. |
| GET | `/api/editor/task-drafts/{draft_id}` | владелец | Открыть свой черновик и проверить занятость slug и остальные поля. |
| PATCH | `/api/editor/task-drafts/{draft_id}` | владелец | Сохранить форму с проверкой revision для защиты от перезаписи. |
| POST | `/api/editor/task-drafts/{draft_id}/photos` | владелец | Добавить фотографии в свой черновик и вернуть обновлённую форму. |
| PUT | `/api/editor/task-drafts/{draft_id}/photos` | владелец | Сохранить галерею черновика, первое фото титульное, отсутствующие удаляются. |
| POST | `/api/editor/task-drafts/{draft_id}/publish` | владелец | Опубликовать всё задание и перенести фотографии и вложения одной транзакцией. |
| POST | `/api/editor/task-drafts/{draft_id}/resources` | владелец | Прикрепить файл к своему черновику и вернуть обновлённую форму. |
| DELETE | `/api/editor/task-drafts/{draft_id}/resources/{resource_id}` | владелец | Удалить вложение из своего черновика с проверкой ревизии. |
| PATCH | `/api/editor/task-drafts/{draft_id}/resources/{resource_id}` | владелец | Изменить название или назначение вложения своего черновика. |
| GET | `/api/editor/task-drafts/{draft_id}/resources/{resource_id}/download-url` | владелец | Получить постоянную ссылку на вложение собственного черновика. |
| GET | `/api/editor/tasks` | админ | Список заданий всех состояний для администратора. |
| POST | `/api/editor/tasks` | админ | Создать готовое опубликованное задание с требованиями и пресетами. |
| GET | `/api/editor/tasks/all` | админ | Получить все задания для администратора, включая скрытые и архивные. |
| DELETE | `/api/editor/tasks/{task_id}` | админ | Удалить неиспользуемое архивное задание. |
| GET | `/api/editor/tasks/{task_id}` | админ | Получить опубликованное или архивное задание для редактирования. |
| PATCH | `/api/editor/tasks/{task_id}` | админ | Частично изменить задание с проверкой состава пресетов при публикации. |
| GET | `/api/editor/tasks/{task_id}/complications` | админ | Показать требования задания в порядке отображения. |
| POST | `/api/editor/tasks/{task_id}/complications` | админ | Добавить конкретное требование, при необходимости связав его с шаблоном. |
| POST | `/api/editor/tasks/{task_id}/complications/copy` | админ | Скопировать готовое требование в это задание. |
| PUT | `/api/editor/tasks/{task_id}/complications/order` | админ | Установить порядок требований по полному списку ID без повторов. |
| DELETE | `/api/editor/tasks/{task_id}/complications/{link_id}` | админ | Удалить требование, если на него не ссылаются решения. |
| GET | `/api/editor/tasks/{task_id}/complications/{link_id}` | админ | Получить отдельное требование задания. |
| PATCH | `/api/editor/tasks/{task_id}/complications/{link_id}` | админ | Изменить требование с явным подтверждением связанного шаблона при смене текста. |
| GET | `/api/editor/tasks/{task_id}/composition` | админ | Получить единое дерево групп и требований задания. |
| PUT | `/api/editor/tasks/{task_id}/composition` | админ | Атомарно сохранить дерево групп и требований, сохраняя ID существующих пунктов. |
| POST | `/api/editor/tasks/{task_id}/photos` | админ | Добавить фотографии задания, первая фотография становится титульной. |
| PUT | `/api/editor/tasks/{task_id}/photos` | админ | Сохранить список фотографий, первая титульная, отсутствующие в списке удаляются. |
| GET | `/api/editor/tasks/{task_id}/presets` | админ | Показать пресеты задания в редакторе. |
| POST | `/api/editor/tasks/{task_id}/presets` | админ | Добавить пресет с уникальным для задания уровнем. |
| DELETE | `/api/editor/tasks/{task_id}/presets/{preset_id}` | админ | Удалить пресет, если он не используется решениями. |
| GET | `/api/editor/tasks/{task_id}/presets/{preset_id}` | админ | Получить описание и оценку времени пресета. |
| PATCH | `/api/editor/tasks/{task_id}/presets/{preset_id}` | админ | Частично изменить уровень, описание или оценку времени пресета. |
| GET | `/api/editor/tasks/{task_id}/presets/{preset_id}/configuration` | админ | Предварительно посмотреть накопительный состав пресета. † |
| GET | `/api/editor/tasks/{task_id}/resources` | админ | Список файлов задания для администратора. |
| POST | `/api/editor/tasks/{task_id}/resources` | админ | Загрузить файл в MinIO и сохранить метаданные ресурса. |
| DELETE | `/api/editor/tasks/{task_id}/resources/{resource_id}` | админ | Удалить привязку ресурса с сохранением файла в хранилище. |
| PATCH | `/api/editor/tasks/{task_id}/resources/{resource_id}` | админ | Изменить название или тип ресурса. |
| GET | `/api/editor/tasks/{task_id}/resources/{resource_id}/download-url` | админ | Получить постоянную ссылку на файл из редактора. |
| GET | `/api/health-check/` | публичный | Проверить доступность API. |
| GET | `/api/solutions` | автор | Список решений текущего пользователя с фильтрами. |
| DELETE | `/api/solutions/{solution_id}` | автор | Удалить своё решение вместе с его чек-листом. |
| GET | `/api/solutions/{solution_id}` | автор | Получить своё решение с чек-листом и количеством выполненных пунктов. |
| PATCH | `/api/solutions/{solution_id}` | автор | Заполнить описание подхода, ссылку на репозиторий или оценку сложности. |
| DELETE | `/api/solutions/{solution_id}/completion` | автор | Вернуть решение в работу, очистив дату завершения. |
| PUT | `/api/solutions/{solution_id}/completion` | автор | Отметить решение завершённым независимо от состояния чек-листа. |
| GET | `/api/solutions/{solution_id}/complications` | автор | Получить независимый чек-лист своего решения. |
| POST | `/api/solutions/{solution_id}/complications` | автор | Добавить собственное требование в решение. |
| PUT | `/api/solutions/{solution_id}/complications/order` | автор | Установить порядок пунктов чек-листа, передав все их ID. |
| DELETE | `/api/solutions/{solution_id}/complications/{link_id}` | автор | Убрать любой пункт из своего чек-листа. |
| GET | `/api/solutions/{solution_id}/complications/{link_id}` | автор | Получить конкретный пункт своего чек-листа. |
| PATCH | `/api/solutions/{solution_id}/complications/{link_id}` | автор | Изменить текст пункта или описание его реализации. |
| DELETE | `/api/solutions/{solution_id}/complications/{link_id}/completion` | автор | Снять отметку выполнения пункта без изменения статуса решения. |
| PUT | `/api/solutions/{solution_id}/complications/{link_id}/completion` | автор | Отметить пункт выполненным с сохранением даты при повторном запросе. |
| GET | `/api/task-complication-categories` | публичный | Список категорий с фильтрами, включая выбор корней через roots_only. |
| POST | `/api/task-complication-categories` | админ | Создать категорию требований от имени администратора. |
| DELETE | `/api/task-complication-categories/{category_id}` | админ | Удалить категорию, если она не используется. |
| GET | `/api/task-complication-categories/{category_id}` | публичный | Получить категорию по идентификатору. |
| PATCH | `/api/task-complication-categories/{category_id}` | админ | Изменить поля категории с проверкой циклов иерархии. |
| GET | `/api/task-complications` | публичный | Найти общие требования по тексту, категории или направлению. |
| GET/HEAD | `/api/media/photos/{photo_id}` | публичный / владелец | Байты фотографии по стабильному URL, доступ проверяется перед кэшем и 304. |
| GET/HEAD | `/api/editor/media/photos/{photo_id}` | админ | Фото задания или собственного черновика. |
| GET/HEAD | `/api/media/resources/{resource_id}` | публичный / владелец | Вложение по стабильному URL, доступ проверяется перед кешем и 304. |
| GET/HEAD | `/api/editor/media/resources/{resource_id}` | админ | Скачать вложение задания или собственного черновика. |
| POST | `/api/task-complications` | админ | Добавить общий шаблон требования в библиотеку. |
| GET | `/api/task-complications/library` | публичный | Получить библиотеку требований по направлениям разработки с деревом категорий. |
| DELETE | `/api/task-complications/{template_id}` | админ | Удалить шаблон, на который нет ссылок. |
| GET | `/api/task-complications/{template_id}` | публичный | Получить общий шаблон требования. |
| PATCH | `/api/task-complications/{template_id}` | админ | Изменить шаблон с защитой текста уже используемых шаблонов. |
| GET | `/api/tasks` | публичный | Найти опубликованные задания с фильтрами и пагинацией. |
| GET | `/api/tasks/by-slug/{slug}` | публичный | Получить опубликованное задание по slug. |
| GET | `/api/tasks/{task_id}` | публичный | Получить опубликованное задание по идентификатору. |
| GET | `/api/tasks/{task_id}/presets` | публичный | Показать доступные уровни опубликованного задания. |
| GET | `/api/tasks/{task_id}/presets/{preset_id}/configuration` | публичный | Получить требования пресета, включая все нижние уровни. † |
| GET | `/api/tasks/{task_id}/resources` | публичный | Список файлов опубликованного задания. |
| GET | `/api/tasks/{task_id}/resources/{resource_id}/download-url` | публичный | Получить постоянную ссылку на файл опубликованного задания. |
| POST | `/api/tasks/{task_id}/solutions` | автор | Начать решение из пресета с возможностью исключить любые пункты. † |

Всего 76 операций в маршрутизаторах приложения. Служебные /docs и /openapi.json в таблицу не включены.

## Нумерация пунктов и стабильные фотографии

- `LinkRead.order_number` и `ComplicationItem.order_number` — вычисляемый при чтении номер от 1 внутри своего уровня. В БД поля order_number у пунктов и групп нет. Детали, конфигурация пресета, плоский список, отдельный пункт и ответы POST/PATCH/copy используют один обход дерева. Счётчик начинается заново для easy, medium, high; обход depth-first соответствует чтению сверху вниз. Любая глубина вложенности не меняет это правило.
- У группы order_number отсутствует и в БД, и в API; она не расходует номер. position хранит порядок соседей одного уровня и родителя, начиная с 0; допустимы пропуски. GET composition возвращает уровни в порядке easy → medium → high, внутри — по position.
- PUT composition задаёт позиции порядком элементов массивов. POST/PATCH отдельных пунктов и copy принимают position вместо прежнего входного order_number. POST без position добавляет пункт в конец своего контейнера. PUT complications/order меняет порядок пунктов внутри их контейнеров; перестановку самих групп выполняйте через composition. Изменение порядка выполняется под блокировкой Task в одной транзакции. PUT complications/order переставляет листья внутри их контейнеров, сохраняя места групп. После удаления пункта оставшиеся строки не перенумеровываются. Чтение вычисляет номера без записи в БД.
- Frontend публичной задачи показывает order_number из API. Только редактор пересчитывает локальные номера до сохранения. Превью первых четырёх пунктов не меняет номера ответа API.
- `PhotoRead.url` — постоянный относительный путь `/api/media/photos/{id}` без expires_in. При публикации черновика ID и URL сохраняются. `ResourceDownloadRead.url` и `DownloadURL.url` — `/api/media/resources/{id}`, также без expires_in.
- GET/HEAD `/api/media/photos/{id}` доступны без авторизации для опубликованных нескрытых задач; администратору доступны и остальные задачи, фото черновика — только его владельцу-администратору. GET/HEAD `/api/editor/media/photos/{id}` требуют администратора. Недоступное фото возвращает 404.
- Успешный GET возвращает байты JPEG/PNG/WebP с ETag, Cache-Control: private, no-cache и X-Content-Type-Options: nosniff. HEAD возвращает те же метаданные без тела. If-None-Match даёт 304 только после проверки доступа. Ошибки возвращаются стандартным JSON с no-store.
- Redis хранит только байты, ключ зависит от неизменяемого object_key, TTL задаётся MEDIA_CACHE_TTL (PHOTO_CACHE_TTL поддерживается как прежнее имя). Чтение/запись Redis при сбое пропускаются. Удаление записи или изменение видимости запрещают выдачу даже при наличии байтов в Redis.
- Вложения используют ту же проверку доступа, ETag, HEAD и `private, no-cache`, что и фото. Дополнительно возвращается `Content-Disposition: attachment` с исходным UTF-8 именем файла. Публичный frontend и редактор скачивают через свой `/api/backend/...` прокси, сохраняющий заголовки кеша и скачивания.


## GitHub OAuth

- `POST /api/auth/github` принимает `{access_token}` GitHub. Backend проверяет токен через `/applications/{client_id}/token`, затем получает `/user/emails` со scope `user:email`. Клиентские email, ID и роли не принимаются. Возвращает `data: {token, expires_at, user: {id, email, is_admin}}`, Cache-Control: no-store.
- `GET /api/auth/me` требует `Authorization: Bearer <token>`, возвращает текущего пользователя и актуальную роль.
- `POST /api/auth/logout` отзывает текущую сессию; повторный выход допустим.
- Сессия живёт 24 часа, в БД хранится SHA-256 хеш случайного 256-битного токена. GitHub access token не сохраняется. Удаление из ADMIN_EMAILS после перезапуска backend действует на действующие сессии; подтверждённые адреса обновляются при входе.
- GitHub ID — постоянный ключ идентичности. Аккаунты автоматически не объединяются по email. Совпадение email с другой/старой записью — 409 account_conflict; нет подтверждённых адресов — 403 verified_email_required; ошибка GitHub/настройки — 503 github_unavailable.
- NextAuth хранит backend-токен только в зашифрованной HttpOnly cookie. `/api/auth/session` не отдаёт его JavaScript. Прокси берёт идентичность исключительно из cookie; произвольные Authorization и X-User-ID клиента не пересылает. Мутации через прокси требуют совпадающего Origin, маршруты `/auth/*` через него закрыты.
