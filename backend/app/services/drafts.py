from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    DraftRevisionConflictError,
    InvalidDraftError,
    InvalidDraftPayloadError,
)
from app.models import Task, TaskDraft
from app.schemas.common import PositiveID, ValidationIssue
from app.schemas.domain import DraftCreate, DraftRead, TaskCreate
from app.services.common import check_parent, commit, get


async def validate(session: AsyncSession, payload: dict) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    try:
        TaskCreate.model_validate(payload)
    except ValidationError as exc:
        for error in exc.errors():
            issues.append(
                ValidationIssue(
                    field=".".join(map(str, error["loc"])) or "difficulty_from",
                    code=error["type"],
                    message=error["msg"],
                )
            )
    # Проверяем актуальные ссылки, даже если другие обязательные поля ещё не заполнены.
    slug = payload.get("slug")
    if isinstance(slug, str) and await session.scalar(
        select(Task.id).where(Task.slug == slug.strip())
    ):
        issues.append(
            ValidationIssue(
                field="slug",
                code="slug_taken",
                message="Этот slug уже используется заданием",
            )
        )
    try:
        parent_id = TypeAdapter(PositiveID | None).validate_python(
            payload.get("parent_task_id")
        )
    except ValidationError:
        parent_id = None  # Ошибка значения уже добавлена при проверке полей выше.
    if parent_id is not None:
        if await session.get(Task, parent_id) is None:
            issues.append(
                ValidationIssue(
                    field="parent_task_id",
                    code="parent_not_found",
                    message="Родительское задание больше не существует",
                )
            )
    return issues


async def read(session: AsyncSession, obj: TaskDraft) -> DraftRead:
    errors = await validate(session, obj.payload)
    return DraftRead(
        id=obj.id,
        owner_id=obj.owner_id,
        payload=obj.payload,
        schema_version=obj.schema_version,
        revision=obj.revision,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
        validation_errors=errors,
        is_valid=not errors,
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
    merged = {**obj.payload, **payload}
    try:
        DraftCreate(payload=merged)
    except ValidationError as exc:
        raise InvalidDraftPayloadError() from exc
    obj.payload = merged
    obj.revision += 1
    await commit(session, obj)
    return await read(session, obj)


async def materialize(
    session: AsyncSession, owner_id: int, draft_id: int, revision: int
):
    obj = await get(session, TaskDraft, draft_id, lock=True, owner_id=owner_id)
    revision_matches(obj, revision)
    errors = await validate(session, obj.payload)
    if errors:
        raise InvalidDraftError(details=[error.model_dump() for error in errors])
    values = TaskCreate.model_validate(obj.payload).model_dump(mode="json")
    await check_parent(
        session, Task, values.get("parent_task_id"), None, "parent_task_id"
    )
    result = Task(**values)
    session.add(result)
    await session.delete(obj)
    # Ограничения БД защищают от конкурентного занятия slug после проверки.
    await commit(session, result)
    return result
