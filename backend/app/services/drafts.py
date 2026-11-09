from pydantic import ValidationError
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    DraftRevisionConflictError,
    InvalidDraftError,
    InvalidDraftPayloadError,
)
from app.models import TaskDraft, TaskPhoto
from app.schemas.common import Page, ValidationIssue
from app.schemas.domain import DraftCreate, DraftRead, DraftSummary, TaskPublication
from app.services import catalog, file_cleanup, photos, publication, resources
from app.services.common import commit, flush, get
from app.services.media import MediaOwner
from app.services.publication import validate as validate


async def read(session: AsyncSession, obj: TaskDraft) -> DraftRead:
    errors = await validate(session, obj.payload)
    owner = MediaOwner(draft_id=obj.id, user_id=obj.owner_id)
    gallery = await photos.read(session, owner)
    if not gallery:
        errors.append(
            ValidationIssue(
                field="photos",
                code="missing_photo",
                message="Добавьте хотя бы одну фотографию задачи",
            )
        )
    return DraftRead(
        id=obj.id,
        owner_id=obj.owner_id,
        payload=obj.payload,
        revision=obj.revision,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
        validation_errors=errors,
        is_valid=not errors,
        photos=gallery,
        resources=await resources.read(session, owner),
    )


async def listing(
    session: AsyncSession, owner_id: int, limit: int, offset: int
) -> Page[DraftSummary]:
    # В список не загружаем всё JSON-дерево, вложения и ошибки валидации каждого черновика.
    def text_field(name: str):
        value = TaskDraft.payload[name]
        return case(
            (func.jsonb_typeof(value) == "string", value.astext), else_=""
        ).label(name)

    total = await session.scalar(
        select(func.count())
        .select_from(TaskDraft)
        .where(TaskDraft.owner_id == owner_id)
    )
    rows = (
        (
            await session.execute(
                select(
                    TaskDraft.id,
                    TaskDraft.revision,
                    TaskDraft.created_at,
                    TaskDraft.updated_at,
                    text_field("title"),
                    text_field("short_description"),
                )
                .where(TaskDraft.owner_id == owner_id)
                .order_by(TaskDraft.updated_at.desc(), TaskDraft.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .mappings()
        .all()
    )
    covers = {}
    if rows:
        covers = {
            photo.draft_id: photos.photo_response(photo)
            for photo in await session.scalars(
                select(TaskPhoto).where(
                    TaskPhoto.draft_id.in_([row["id"] for row in rows]),
                    TaskPhoto.position == 1,
                )
            )
        }
    return Page[DraftSummary](
        items=[DraftSummary(**row, cover_photo=covers.get(row["id"])) for row in rows],
        total=total or 0,
        limit=limit,
        offset=offset,
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
    errors = (await read(session, obj)).validation_errors
    if errors:
        raise InvalidDraftError(details=[error.model_dump() for error in errors])
    result = await publication.build(
        session, TaskPublication.model_validate(obj.payload), draft_id=draft_id
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
    keys = await file_cleanup.enqueue_owner(
        session, MediaOwner(draft_id=draft_id, user_id=owner_id)
    )
    await session.delete(obj)
    await commit(session)
    await file_cleanup.process_pending(session, keys)
