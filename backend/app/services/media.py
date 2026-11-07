import logging
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.errors import DraftRevisionConflictError
from app.models import Task, TaskDraft
from app.services.common import get
from app.services.storage import Storage

logger = logging.getLogger(__name__)


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
