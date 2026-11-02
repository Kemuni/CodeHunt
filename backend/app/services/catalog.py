from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    EmptyConfigurationError,
    InvalidOrderError,
    InvalidTaskError,
    MissingPresetsError,
    NotFoundError,
    TaskMustBeArchivedError,
    TemplateConfirmationRequiredError,
)
from app.models import (
    Task,
    TaskComplication,
    TaskComplicationLink,
    TaskLevelPreset,
    TaskResource,
)
from app.models.enums import LEVELS, TaskStatus
from app.schemas.domain import LinkCreate, TaskCreate
from app.services.common import (
    Hierarchy,
    assign,
    check_parent,
    commit,
    flush,
    get,
    lock_hierarchy,
)


async def task(
    session: AsyncSession, task_id: int, *, public=False, lock=False
) -> Task:
    obj = await get(session, Task, task_id, lock=lock)
    if public and obj.status != TaskStatus.PUBLISHED:
        raise NotFoundError("Задание не найдено")
    return obj


async def configuration(session: AsyncSession, task_id: int, preset_id: int):
    preset = await get(session, TaskLevelPreset, preset_id, task_id=task_id)
    levels = LEVELS[: LEVELS.index(preset.level) + 1]
    links = (
        await session.scalars(
            select(TaskComplicationLink)
            .where(
                TaskComplicationLink.task_id == task_id,
                TaskComplicationLink.level.in_(levels),
            )
            .order_by(TaskComplicationLink.order_number, TaskComplicationLink.id)
        )
    ).all()
    return {"preset": preset, "complications": links}


async def ensure_publishable(session: AsyncSession, obj: Task):
    await flush(session)
    if obj.status != TaskStatus.PUBLISHED:
        return
    presets = (
        await session.scalars(
            select(TaskLevelPreset).where(TaskLevelPreset.task_id == obj.id)
        )
    ).all()
    if not presets:
        raise MissingPresetsError()
    for preset in presets:
        if not (await configuration(session, obj.id, preset.id))["complications"]:
            raise EmptyConfigurationError(
                f"Пресет {preset.level} не содержит требований"
            )


async def create_task(session: AsyncSession, values: dict) -> Task:
    await check_parent(
        session, Task, values.get("parent_task_id"), None, "parent_task_id"
    )
    obj = Task(**values)
    session.add(obj)
    return await commit(session, obj)


async def update_task(session: AsyncSession, task_id: int, values: dict) -> Task:
    if "parent_task_id" in values:
        await lock_hierarchy(session, Hierarchy.TASKS)
    obj = await task(session, task_id, lock=True)
    merged = {key: getattr(obj, key) for key in TaskCreate.model_fields}
    merged.update({key: value for key, value in values.items() if key != "status"})
    try:
        TaskCreate.model_validate(merged)
    except ValidationError as exc:
        raise InvalidTaskError(
            details=[
                {
                    "field": ".".join(map(str, error["loc"])),
                    "code": error["type"],
                    "message": error["msg"],
                }
                for error in exc.errors()
            ]
        ) from exc
    await check_parent(
        session, Task, merged["parent_task_id"], task_id, "parent_task_id"
    )
    assign(obj, values)
    await ensure_publishable(session, obj)
    return await commit(session, obj)


async def delete_task(session: AsyncSession, task_id: int):
    obj = await task(session, task_id, lock=True)
    if obj.status != TaskStatus.DRAFT:
        raise TaskMustBeArchivedError()
    for model in (TaskResource, TaskComplicationLink, TaskLevelPreset):
        await session.execute(delete(model).where(model.task_id == task_id))
    await session.delete(obj)
    await commit(session)


async def template_reference(session: AsyncSession, template_id: int | None):
    if template_id is not None:
        await get(session, TaskComplication, template_id, lock=True)


async def save_child(
    session: AsyncSession,
    task_id: int,
    model,
    values: dict,
    object_id: int | None = None,
):
    parent = await task(session, task_id, lock=True)
    if object_id is None:
        obj = model(task_id=task_id, **values)
        session.add(obj)
    else:
        obj = await get(session, model, object_id, task_id=task_id)
        if model is TaskComplicationLink and obj.complication_id is not None:
            changed = any(
                key in values and values[key] != getattr(obj, key)
                for key in ("title", "description", "acceptance_criteria")
            )
            if changed and "complication_id" not in values:
                raise TemplateConfirmationRequiredError()
        assign(obj, values)
    if model is TaskComplicationLink:
        with session.no_autoflush:
            await template_reference(session, obj.complication_id)
    parent.updated_at = func.clock_timestamp()
    await ensure_publishable(session, parent)
    return await commit(session, obj)


async def remove_child(session: AsyncSession, task_id: int, model, object_id: int):
    parent = await task(session, task_id, lock=True)
    obj = await get(session, model, object_id, task_id=task_id)
    await session.delete(obj)
    parent.updated_at = func.clock_timestamp()
    await ensure_publishable(session, parent)
    await commit(session)


async def copy_link(
    session: AsyncSession, task_id: int, source_id: int, overrides: dict
):
    # Блокируем задания по возрастанию ID, чтобы встречное копирование не вызвало deadlock.
    source = await get(session, TaskComplicationLink, source_id)
    for parent_id in sorted({task_id, source.task_id}):
        await task(session, parent_id, lock=True)
    await session.refresh(source)
    values = {key: getattr(source, key) for key in LinkCreate.model_fields}
    values.update({key: value for key, value in overrides.items() if value is not None})
    return await save_child(session, task_id, TaskComplicationLink, values)


async def reorder(
    session: AsyncSession, model, owner_field: str, owner_id: int, ids: list[int]
):
    objects = (
        await session.scalars(
            select(model).where(getattr(model, owner_field) == owner_id)
        )
    ).all()
    if len(set(ids)) != len(ids) or set(ids) != {obj.id for obj in objects}:
        raise InvalidOrderError()
    positions = {object_id: index for index, object_id in enumerate(ids)}
    for obj in objects:
        obj.order_number = positions[obj.id]
