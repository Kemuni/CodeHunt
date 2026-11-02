from http import HTTPStatus
from typing import ClassVar


class DomainError(Exception):
    """Ожидаемая ошибка бизнес-операции, которую API преобразует в HTTP-ответ."""

    status: ClassVar[HTTPStatus] = HTTPStatus.INTERNAL_SERVER_ERROR
    code: ClassVar[str] = "domain_error"
    default_message: ClassVar[str] = "Не удалось выполнить операцию"

    def __init__(
        self, message: str | None = None, *, details: list[dict] | None = None
    ):
        self.message = self.default_message if message is None else message
        self.details = details
        super().__init__(self.message)


class NotFoundError(DomainError):
    status = HTTPStatus.NOT_FOUND
    code = "not_found"
    default_message = "Объект не найден"


class AlreadyExistsError(DomainError):
    status = HTTPStatus.CONFLICT
    code = "already_exists"
    default_message = "Запись с такими уникальными значениями уже существует"


class ReferenceConflictError(DomainError):
    status = HTTPStatus.CONFLICT
    code = "reference_conflict"
    default_message = "Объект отсутствует или используется другими записями"


class ConstraintViolationError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "constraint_violation"
    default_message = "Значения нарушают ограничения модели"


class ParentCycleError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "parent_cycle"
    default_message = "Иерархия не может содержать цикл"


class UnknownUserError(DomainError):
    status = HTTPStatus.UNAUTHORIZED
    code = "unknown_user"
    default_message = "Пользователь не найден"


class AdminRequiredError(DomainError):
    status = HTTPStatus.FORBIDDEN
    code = "admin_required"
    default_message = "Требуется администратор"


class MissingPresetsError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "empty_presets"
    default_message = "Для публикации нужен хотя бы один пресет"


class EmptyConfigurationError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "empty_configuration"
    default_message = "Пресет не содержит требований"


class TaskMustBeArchivedError(DomainError):
    status = HTTPStatus.CONFLICT
    code = "archive_task"
    default_message = "Опубликованное задание нужно архивировать"


class InvalidOrderError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "invalid_order"
    default_message = "Передайте каждый ID текущего списка ровно один раз"


class InvalidTaskError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "invalid_task"
    default_message = "Некорректные поля задания"


class TemplateConfirmationRequiredError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "template_confirmation_required"
    default_message = "Укажите complication_id явно: текущий шаблон, другой или null"


class DraftRevisionConflictError(DomainError):
    status = HTTPStatus.CONFLICT
    code = "draft_revision_conflict"
    default_message = "Черновик изменён в другой вкладке. Загрузите текущую версию"


class InvalidDraftError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "draft_invalid"
    default_message = "Исправьте ошибки черновика"


class InvalidDraftPayloadError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "invalid_payload"
    default_message = (
        "Объединённый черновик превышает размер или содержит неизвестные поля"
    )


class StorageUnavailableError(DomainError):
    status = HTTPStatus.SERVICE_UNAVAILABLE
    code = "storage_unavailable"
    default_message = "Хранилище файлов временно недоступно"


class FileNotFoundInStorageError(DomainError):
    status = HTTPStatus.NOT_FOUND
    code = "file_not_found"
    default_message = "Файл отсутствует в хранилище"


class StorageNotConfiguredError(DomainError):
    status = HTTPStatus.SERVICE_UNAVAILABLE
    code = "storage_not_configured"
    default_message = "Хранилище файлов не настроено"


class SolutionAuthorMismatchError(DomainError):
    status = HTTPStatus.FORBIDDEN
    code = "author_mismatch"
    default_message = "Нельзя создавать решение от имени другого пользователя"


class InvalidExclusionsError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "invalid_exclusions"
    default_message = "Исключения должны принадлежать выбранной конфигурации"


class InvalidDifficultyError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "invalid_difficulty"
    default_message = "Неверный интервал сложности"


class ConflictingFiltersError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "conflicting_filters"
    default_message = "roots_only и parent_id несовместимы"


class TemplateInUseError(DomainError):
    status = HTTPStatus.CONFLICT
    code = "template_in_use"
    default_message = "Для изменения смысла используемого шаблона создайте новый"


class InvalidResourceError(DomainError):
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "invalid_resource"
    default_message = "Некорректное название или метаданные файла"


class FileTooLargeError(DomainError):
    status = HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    code = "file_too_large"
    default_message = "Файл превышает допустимый размер"


class UploadSizeMismatchError(DomainError):
    status = HTTPStatus.SERVICE_UNAVAILABLE
    code = "upload_size_mismatch"
    default_message = "Не удалось проверить загруженный файл"
