import logging
from collections.abc import AsyncGenerator, Sequence
from dataclasses import dataclass
from typing import BinaryIO

from anyio import CancelScope
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.errors import DraftRevisionConflictError, NotFoundError
from app.models import Task, TaskDraft, TaskPhoto, TaskResource, User
from app.services.common import get
from app.services.media_cache import MediaCache
from app.services.storage import STORAGE_EXCEPTIONS, Storage, get_storage, storage_error

logger = logging.getLogger(__name__)


async def accessible_file[File: (TaskPhoto, TaskResource)](
    session: AsyncSession, model: type[File], file_id: int, user: User | None
) -> File:
    file = await session.get(model, file_id)
    if file is not None:
        if file.task_id is not None:
            task = await session.get(Task, file.task_id)
            if task is not None and (
                (not task.is_hidden and not task.is_paid)
                or (user is not None and user.is_admin)
            ):
                return file
        elif user is not None and user.is_admin:
            draft = await session.get(TaskDraft, file.draft_id)
            if draft is not None and draft.owner_id == user.id:
                return file
    raise NotFoundError("Файл не найден")


async def close_stream(body: BinaryIO) -> None:
    # Закрываем соединение с S3 и при отмене скачивания клиентом.
    with CancelScope(shield=True):
        await run_in_threadpool(body.close)


async def stream_content(body: BinaryIO) -> AsyncGenerator[bytes]:
    try:
        while chunk := await run_in_threadpool(body.read, 64 * 1024):
            yield chunk
    finally:
        await close_stream(body)


async def content(
    object_key: str, cache: MediaCache, size_bytes: int | None
) -> bytes | BinaryIO:
    # Ключ объекта неизменяемый и содержит тип файла; публикация не меняет кэш.
    key = f"media:v1:{settings.S3_BUCKET}:{object_key}"
    cacheable = (
        size_bytes is not None and 0 <= size_bytes <= settings.MEDIA_CACHE_MAX_BYTES
    )
    if cacheable:
        cached = await cache.get(key)
        if cached is not None:
            return cached
    try:
        store = get_storage()
        body = await run_in_threadpool(store.open, object_key)
    except STORAGE_EXCEPTIONS as exc:
        raise storage_error(exc) from exc
    if not cacheable:
        return body
    try:
        # Даже при ошибочных метаданных размер буфера ограничен.
        data = bytearray()
        while chunk := await run_in_threadpool(
            body.read, min(64 * 1024, settings.MEDIA_CACHE_MAX_BYTES + 1 - len(data))
        ):
            data.extend(chunk)
            if len(data) > settings.MEDIA_CACHE_MAX_BYTES:
                raise storage_error(ValueError("Размер файла отличается от метаданных"))
        result = bytes(data)
        await cache.put(key, result)
        return result
    except STORAGE_EXCEPTIONS as exc:
        raise storage_error(exc) from exc
    finally:
        await close_stream(body)


async def discard_upload(
    session: AsyncSession, storage: Storage, keys: Sequence[str]
) -> None:
    """Откатывает загрузку, сохраняя исходную ошибку даже при сбоях очистки."""
    try:
        await session.rollback()
    except Exception:
        logger.exception("Не удалось откатить транзакцию после неудачной загрузки")
    for key in keys:
        try:
            await run_in_threadpool(storage.delete, key)
        except Exception:
            logger.exception("Не удалось удалить файл после неудачной загрузки %s", key)


@dataclass(frozen=True)
class MediaOwner:
    """Владелец файлов и условия доступа к нему в рамках одной операции."""

    task_id: int | None = None
    draft_id: int | None = None
    user_id: int | None = None
    revision: int | None = None

    def __post_init__(self):
        if (self.task_id is None) == (self.draft_id is None):
            raise ValueError("Нужен ровно один владелец файлов")
        if self.draft_id is not None and self.user_id is None:
            raise ValueError("Для черновика нужен ID администратора")

    def condition(self, model):
        return (
            model.task_id == self.task_id
            if self.task_id is not None
            else model.draft_id == self.draft_id
        )

    def values(self) -> dict:
        return {"task_id": self.task_id, "draft_id": self.draft_id}

    async def get(self, session: AsyncSession, *, lock=False):
        if self.task_id is not None:
            return await get(session, Task, self.task_id, lock=lock)
        assert self.draft_id is not None
        obj = await get(
            session, TaskDraft, self.draft_id, owner_id=self.user_id, lock=lock
        )
        if self.revision is not None and obj.revision != self.revision:
            raise DraftRevisionConflictError()
        return obj

    def touch(self, obj) -> None:
        if self.draft_id is not None:
            obj.revision += 1
        obj.updated_at = func.clock_timestamp()
