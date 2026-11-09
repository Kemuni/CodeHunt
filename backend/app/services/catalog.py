from collections import defaultdict
from collections.abc import Sequence

from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    ConstraintViolationError,
    InvalidOrderError,
    InvalidTaskError,
    NotFoundError,
    TaskMustBeArchivedError,
)
from app.models import (
    Task,
    TaskComplication,
    TaskComplicationLink,
    TaskComplicationLinkGroup,
    TaskLevelPreset,
    TaskPhoto,
    TaskResource,
)
from app.models.enums import LEVELS, TaskStatus
from app.schemas.common import Page
from app.schemas.domain import (
    LinkCreate,
    PresetRead,
    TaskCreate,
    TaskDetail,
    TaskPresetRead,
    TaskPresets,
    TaskPublication,
    TaskRead,
)
from app.services import composition, file_cleanup, photos, publication, resources
from app.services.common import (
    Hierarchy,
    assign,
    check_parent,
    commit,
    get,
    lock_hierarchy,
    page,
)
from app.services.composition import confirm_template
from app.services.composition import ensure_publishable as ensure_publishable
from app.services.media import MediaOwner


async def task(
    session: AsyncSession, task_id: int, *, public=False, lock=False
) -> Task:
    obj = await get(session, Task, task_id, lock=lock)
    if public and (obj.status != TaskStatus.PUBLISHED or obj.is_hidden):
        raise NotFoundError("Задание не найдено")
    return obj


async def create_task(session: AsyncSession, values: dict) -> Task:
    obj = await publication.build(session, TaskPublication.model_validate(values))
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
    if obj.status != TaskStatus.ARCHIVED:
        raise TaskMustBeArchivedError()
    keys = await file_cleanup.enqueue_owner(session, MediaOwner(task_id=task_id))
    for model in (
        TaskPhoto,
        TaskResource,
        TaskComplicationLink,
        TaskComplicationLinkGroup,
        TaskLevelPreset,
    ):
        await session.execute(delete(model).where(model.task_id == task_id))
    await session.delete(obj)
    await commit(session)
    await file_cleanup.process_pending(session, keys)


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
    requested_position = (
        values.pop("position", None) if model is TaskComplicationLink else None
    )
    relocated = object_id is None
    if object_id is None:
        obj = model(task_id=task_id, **values)
        session.add(obj)
    else:
        obj = await get(session, model, object_id, task_id=task_id)
        if model is TaskComplicationLink:
            confirm_template(obj, values)
            relocated = any(
                key in values and values[key] != getattr(obj, key)
                for key in ("group_id", "level")
            )
        assign(obj, values)
    if model is TaskComplicationLink:
        with session.no_autoflush:
            await template_reference(session, obj.complication_id)
            if obj.group_id is not None:
                group = await get(
                    session, TaskComplicationLinkGroup, obj.group_id, task_id=task_id
                )
                if group.level != obj.level:
                    raise ConstraintViolationError(
                        "Уровень пункта должен совпадать с уровнем группы"
                    )
        if relocated or requested_position is not None:
            await composition.place_link(session, obj, requested_position)
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
    # Группа относится к исходному заданию, копия создаётся в корне назначения.
    values["group_id"] = None
    values["position"] = None
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
    if model is TaskComplicationLink:
        # Меняем порядок листьев только в их контейнере, сохраняя места групп.
        siblings = defaultdict(list)
        for obj in objects:
            siblings[(obj.level, obj.group_id)].append(obj)
        groups = (
            await session.scalars(
                select(TaskComplicationLinkGroup).where(
                    TaskComplicationLinkGroup.task_id == owner_id
                )
            )
        ).all()
        for group in groups:
            siblings[(group.level, group.parent_group_id)].append(group)
        for items in siblings.values():
            ordered = sorted(
                items,
                key=lambda item: (
                    item.position,
                    isinstance(item, TaskComplicationLink),
                    item.id,
                ),
            )
            links = iter(
                sorted(
                    (item for item in items if isinstance(item, TaskComplicationLink)),
                    key=lambda item: positions[item.id],
                )
            )
            for position, item in enumerate(ordered):
                if isinstance(item, TaskComplicationLink):
                    item = next(links)
                item.position = position
        return
    for obj in objects:
        obj.order_number = positions[obj.id]


async def read_tasks(session: AsyncSession, objects: Sequence[Task]) -> list[TaskRead]:
    covers = await photos.covers(session, [obj.id for obj in objects])
    return [
        TaskRead.model_validate(obj).model_copy(
            update={"cover_photo": covers.get(obj.id)}
        )
        for obj in objects
    ]


async def task_page(
    session: AsyncSession, statement, limit: int, offset: int
) -> Page[TaskRead]:
    result = await page(session, statement, limit, offset)
    result["items"] = await read_tasks(session, result["items"])
    return Page[TaskRead](**result)


async def detail(session: AsyncSession, obj: Task) -> TaskDetail:
    presets = (
        await session.scalars(
            select(TaskLevelPreset)
            .where(TaskLevelPreset.task_id == obj.id)
            .order_by(TaskLevelPreset.id)
        )
    ).all()
    gallery = await photos.read(session, MediaOwner(task_id=obj.id))
    trees = composition.by_level(await composition.read(session, obj.id))
    presets_by_level = {
        preset.level: PresetRead.model_validate(preset) for preset in presets
    }
    return TaskDetail(
        **{key: getattr(obj, key) for key in TaskCreate.model_fields},
        id=obj.id,
        status=obj.status,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
        presets=TaskPresets.model_validate(
            {
                level: TaskPresetRead(
                    preset=presets_by_level.get(level), complications=trees[level]
                )
                for level in LEVELS
            }
        ),
        cover_photo=next((photo for photo in gallery if photo.is_cover), None),
        photos=gallery,
        resources=await resources.read(session, MediaOwner(task_id=obj.id)),
    )
