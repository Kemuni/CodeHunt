from collections.abc import Sequence

from pydantic import ValidationError
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    InvalidDifficultyError,
    InvalidOrderError,
    InvalidTaskError,
    NotFoundError,
    TaskMustBeArchivedError,
)
from app.models import (
    Task,
    TaskComplicationLink,
    TaskComplicationLinkGroup,
    TaskLevelPreset,
    TaskPhoto,
    TaskResource,
)
from app.models.enums import LEVELS, TaskStatus
from app.schemas.catalog import EditorTaskCatalogQuery, TaskCatalogQuery
from app.schemas.common import Page
from app.schemas.domain import (
    CompositionUpdate,
    PresetRead,
    TaskCreate,
    TaskDetail,
    TaskPresetRead,
    TaskPresets,
    TaskRead,
    TaskSave,
)
from app.services import composition, file_cleanup, photos, resources
from app.services.common import (
    Hierarchy,
    assign,
    check_parent,
    commit,
    get,
    lock_hierarchy,
    page,
)
from app.services.composition import ensure_publishable as ensure_publishable
from app.services.media import MediaOwner


def catalog_query(filters: TaskCatalogQuery, *, public: bool):
    """Общие фильтры до пагинации; ID устраняет неоднозначность при равных значениях сортировки."""
    if any(
        value is not None and not 0 <= value <= 10
        for value in (filters.difficulty_min, filters.difficulty_max)
    ) or (
        filters.difficulty_min is not None
        and filters.difficulty_max is not None
        and filters.difficulty_min > filters.difficulty_max
    ):
        raise InvalidDifficultyError()
    query = select(Task)
    if public:
        query = query.where(
            Task.status == TaskStatus.PUBLISHED, Task.is_hidden.is_(False)
        )
    elif isinstance(filters, EditorTaskCatalogQuery):
        if filters.status:
            query = query.where(Task.status == filters.status)
        if filters.is_hidden is not None:
            query = query.where(Task.is_hidden == filters.is_hidden)
    if q := filters.q.strip():
        query = query.where(
            or_(
                Task.title.icontains(q, autoescape=True),
                Task.short_description.icontains(q, autoescape=True),
            )
        )
    if filters.developer_type:
        query = query.where(Task.developer_type.in_(filters.developer_type))
    if filters.access is not None:
        query = query.where(Task.is_paid.is_(filters.access == "subscription"))
    if filters.level:
        query = query.where(
            select(TaskLevelPreset.id)
            .where(
                TaskLevelPreset.task_id == Task.id,
                TaskLevelPreset.level == filters.level,
            )
            .exists()
        )
    # Диапазон задачи должен пересекаться с выбранным диапазоном сложности.
    if filters.difficulty_min is not None:
        query = query.where(Task.difficulty_to >= filters.difficulty_min)
    if filters.difficulty_max is not None:
        query = query.where(Task.difficulty_from <= filters.difficulty_max)
    if filters.parent_task_id is not None:
        query = query.where(Task.parent_task_id == filters.parent_task_id)
    ordering = {
        "oldest": (Task.created_at.asc(), Task.id.asc()),
        "newest": (Task.created_at.desc(), Task.id.desc()),
        "title": (Task.title.asc(), Task.id.asc()),
        "difficulty_asc": (
            Task.difficulty_from.asc(),
            Task.difficulty_to.asc(),
            Task.id.asc(),
        ),
        "difficulty_desc": (
            Task.difficulty_to.desc(),
            Task.difficulty_from.desc(),
            Task.id.asc(),
        ),
    }
    return query.order_by(*ordering[filters.sort])


async def task(
    session: AsyncSession, task_id: int, *, public=False, lock=False
) -> Task:
    obj = await get(session, Task, task_id, lock=lock)
    if public and (obj.status != TaskStatus.PUBLISHED or obj.is_hidden):
        raise NotFoundError("Задание не найдено")
    return obj


async def public_task_by_slug(session: AsyncSession, slug: str) -> Task:
    obj = await session.scalar(
        select(Task).where(
            Task.slug == slug,
            Task.status == TaskStatus.PUBLISHED,
            Task.is_hidden.is_(False),
        )
    )
    if obj is None:
        raise NotFoundError("Задание не найдено")
    return obj


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


async def save_task(session: AsyncSession, task_id: int, data: TaskSave) -> TaskDetail:
    """Сохраняет поля, пресеты и дерево одним commit, сохраняя ID и снимки решений."""
    await lock_hierarchy(session, Hierarchy.TASKS)
    obj = await task(session, task_id, lock=True)
    await photos.ensure_present(session, task_id)
    await check_parent(session, Task, data.parent_task_id, task_id, "parent_task_id")
    assign(obj, data.model_dump(mode="json", exclude={"items", "presets"}))
    presets = {
        preset.level: preset
        for preset in await session.scalars(
            select(TaskLevelPreset).where(TaskLevelPreset.task_id == task_id)
        )
    }
    for value in data.presets:
        preset = presets.pop(value.level, None)
        if preset is None:
            session.add(TaskLevelPreset(task_id=task_id, **value.model_dump()))
        else:
            assign(preset, value.model_dump())
    for preset in presets.values():
        await session.delete(preset)
    # Проверяем пригодность к публикации после записи всего состава, без промежуточных commit.
    await composition.save(session, obj, CompositionUpdate(items=data.items))
    await session.refresh(obj)
    result = await detail(session, obj)
    await commit(session)
    return result


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


async def task_presets(session: AsyncSession, task_id: int) -> TaskPresets:
    """Общий формат уровней для деталей и отдельного чтения, без накопления пунктов."""
    presets = (
        await session.scalars(
            select(TaskLevelPreset)
            .where(TaskLevelPreset.task_id == task_id)
            .order_by(TaskLevelPreset.id)
        )
    ).all()
    trees = composition.by_level(await composition.read(session, task_id))
    presets_by_level = {
        preset.level: PresetRead.model_validate(preset) for preset in presets
    }
    return TaskPresets.model_validate(
        {
            level: TaskPresetRead(
                preset=presets_by_level.get(level), complications=trees[level]
            )
            for level in LEVELS
        }
    )


async def detail(session: AsyncSession, obj: Task) -> TaskDetail:
    presets = await task_presets(session, obj.id)
    gallery = await photos.read(session, MediaOwner(task_id=obj.id))
    return TaskDetail(
        **{key: getattr(obj, key) for key in TaskCreate.model_fields},
        id=obj.id,
        status=obj.status,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
        presets=presets,
        cover_photo=next((photo for photo in gallery if photo.is_cover), None),
        photos=gallery,
        resources=await resources.read(session, MediaOwner(task_id=obj.id)),
    )
