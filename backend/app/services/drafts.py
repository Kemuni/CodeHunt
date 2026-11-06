from pydantic import ValidationError
from sqlalchemy import update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    DraftRevisionConflictError,
    InvalidDraftError,
    InvalidDraftPayloadError,
)
from app.models import TaskDraft, TaskPhoto, TaskResource
from app.schemas.domain import DraftCreate, DraftRead, TaskPublication
from app.services import catalog, photos, publication, resources
from app.services.common import commit, flush, get
from app.services.media import MediaOwner
from app.services.publication import validate as validate


async def read(session: AsyncSession, obj: TaskDraft) -> DraftRead:
    errors = await validate(session, obj.payload)
    owner = MediaOwner(draft_id=obj.id, user_id=obj.owner_id)
    return DraftRead(
        id=obj.id,
        owner_id=obj.owner_id,
        payload=obj.payload,
        revision=obj.revision,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
        validation_errors=errors,
        is_valid=not errors,
        photos=await photos.read(session, owner),
        resources=await resources.read(session, owner),
    )


def revision_matches(obj: TaskDraft, revision: int):
    if obj.revision != revision:
        raise DraftRevisionConflictError()


async def create(session: AsyncSession, owner_id: int, payload: dict):
    obj = TaskDraft(owner_id=owner_id, payload=payload)
    session.add(obj)
    await commit(session, obj)
    return await read(session, obj)


async def update(
    session: AsyncSession, owner_id: int, draft_id: int, revision: int, payload: dict
):
    obj = await get(session, TaskDraft, draft_id, lock=True, owner_id=owner_id)
    revision_matches(obj, revision)
    # Поля задания объединяются, массивы требований и пресетов заменяются целиком.
    merged = {**obj.payload, **payload}
    try:
        DraftCreate(payload=merged)
    except ValidationError as exc:
        raise InvalidDraftPayloadError() from exc
    obj.payload = merged
    obj.revision += 1
    await commit(session, obj)
    return await read(session, obj)


async def publish(session: AsyncSession, owner_id: int, draft_id: int, revision: int):
    obj = await get(session, TaskDraft, draft_id, lock=True, owner_id=owner_id)
    revision_matches(obj, revision)
    errors = await validate(session, obj.payload)
    if errors:
        raise InvalidDraftError(details=[error.model_dump() for error in errors])
    result = await publication.build(
        session, TaskPublication.model_validate(obj.payload)
    )
    # Обе ссылки меняются одним UPDATE, поэтому ограничение владельца всегда выполнено.
    for model in (TaskPhoto, TaskResource):
        await session.execute(
            sql_update(model)
            .where(model.draft_id == draft_id)
            .values(task_id=result.id, draft_id=None)
        )
    await session.delete(obj)
    await flush(session)
    await session.refresh(result)
    # Формируем ответ до commit, чтобы ошибка чтения файлов также сохраняла черновик.
    response = await catalog.detail(session, result)
    await commit(session)
    return response


async def delete(session: AsyncSession, owner_id: int, draft_id: int, revision: int):
    obj = await get(session, TaskDraft, draft_id, lock=True, owner_id=owner_id)
    revision_matches(obj, revision)
    # FK удаляют только оставшиеся привязки черновика, опубликованные файлы уже принадлежат Task.
    await session.delete(obj)
    await commit(session)
