import asyncio
import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, union_all
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.models import PendingFileDeletion, TaskPhoto, TaskResource
from app.services import media
from app.services.media import MediaOwner

logger = logging.getLogger(__name__)
RETRY_SECONDS = 60


async def enqueue(session: AsyncSession, keys: Sequence[str]) -> None:
    """Сохраняет очистку в той же транзакции, что и удаление метаданных."""
    if keys:
        await session.execute(
            insert(PendingFileDeletion)
            .values(
                [
                    {"bucket": settings.S3_BUCKET, "object_key": key}
                    for key in sorted(set(keys))
                ]
            )
            .on_conflict_do_nothing()
        )


async def enqueue_owner(session: AsyncSession, owner: MediaOwner) -> list[str]:
    keys = []
    for model in (TaskPhoto, TaskResource):
        keys.extend(
            await session.scalars(
                select(model.object_key).where(owner.condition(model))
            )
        )
    await enqueue(session, keys)
    return keys


async def process_pending(
    session: AsyncSession, keys: Sequence[str] | None = None
) -> None:
    """Вызывается после commit или фоновой задачей с отдельной сессией БД."""
    if keys is not None and not keys:
        return
    try:
        statement = (
            select(PendingFileDeletion)
            .where(
                PendingFileDeletion.bucket == settings.S3_BUCKET,
                PendingFileDeletion.next_attempt_at <= func.now(),
            )
            .order_by(
                PendingFileDeletion.next_attempt_at, PendingFileDeletion.object_key
            )
            .limit(100)
            .with_for_update(skip_locked=True)
        )
        if keys is not None:
            statement = statement.where(PendingFileDeletion.object_key.in_(keys))
        batch = (await session.scalars(statement)).all()
        if not batch:
            await session.commit()
            return

        batch_keys = [pending.object_key for pending in batch]
        # Проверка ссылок для каждого из файлов
        referenced = set(
            await session.scalars(
                union_all(
                    select(TaskPhoto.object_key).where(
                        TaskPhoto.object_key.in_(batch_keys)
                    ),
                    select(TaskResource.object_key).where(
                        TaskResource.object_key.in_(batch_keys)
                    ),
                )
            )
        )
        for pending in batch:
            if pending.object_key not in referenced:
                pending.attempt_count += 1
                try:
                    await run_in_threadpool(
                        media.get_storage().delete, pending.object_key
                    )
                except Exception:
                    pending.next_attempt_at = datetime.now(UTC) + timedelta(
                        seconds=RETRY_SECONDS
                    )
                    logger.exception(
                        "Не удалось удалить объект MinIO %s (попытка %s); очистка будет повторена",
                        pending.object_key,
                        pending.attempt_count,
                    )
                    continue
            await session.delete(pending)
        # Если MinIO удалил файл, а commit не прошёл, повторное удаление безопасно.
        await session.commit()
    except Exception:
        logger.exception("Не удалось обработать очередь удаления файлов")
        try:
            await session.rollback()
        except Exception:
            logger.exception("Не удалось откатить транзакцию очистки файлов")


async def run_worker(factory: async_sessionmaker[AsyncSession]) -> None:
    while True:
        try:
            async with factory() as session:
                await process_pending(session)
        except Exception:
            logger.exception("Не удалось запустить очистку файлов")
        await asyncio.sleep(RETRY_SECONDS)
