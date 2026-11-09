from sqlalchemy import or_, select

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.api.routes.library import Limit, Offset
from app.core.errors import InvalidDifficultyError, NotFoundError
from app.models import Task, TaskLevelPreset
from app.models.enums import DeveloperType, Level, TaskStatus
from app.schemas import SuccessResponse
from app.schemas.common import Page, PositiveID
from app.schemas.domain import (
    TaskDetail,
    TaskPresets,
    TaskRead,
    TaskSave,
    TaskUpdate,
)
from app.services import catalog

router = APIResponseRouter(tags=["tasks"])


@router.get(
    "/tasks",
    response_model=SuccessResponse[Page[TaskRead]],
    summary="Найти опубликованные задания с фильтрами и пагинацией.",
)
async def tasks(
    db: SessionDep,
    limit: Limit = 20,
    offset: Offset = 0,
    q: str | None = None,
    developer_type: DeveloperType | None = None,
    level: Level | None = None,
    difficulty_min: int | None = None,
    difficulty_max: int | None = None,
    parent_task_id: PositiveID | None = None,
):
    if any(
        value is not None and not 0 <= value <= 10
        for value in (difficulty_min, difficulty_max)
    ) or (
        difficulty_min is not None
        and difficulty_max is not None
        and difficulty_min > difficulty_max
    ):
        raise InvalidDifficultyError()
    query = (
        select(Task)
        .where(Task.status == TaskStatus.PUBLISHED, Task.is_hidden.is_(False))
        .order_by(Task.id)
    )
    if q:
        query = query.where(
            or_(
                Task.title.icontains(q, autoescape=True),
                Task.short_description.icontains(q, autoescape=True),
            )
        )
    if developer_type:
        query = query.where(Task.developer_type == developer_type)
    if level:
        query = query.where(
            select(TaskLevelPreset.id)
            .where(TaskLevelPreset.task_id == Task.id, TaskLevelPreset.level == level)
            .exists()
        )
    if difficulty_min is not None:
        query = query.where(Task.difficulty_to >= difficulty_min)
    if difficulty_max is not None:
        query = query.where(Task.difficulty_from <= difficulty_max)
    if parent_task_id is not None:
        query = query.where(Task.parent_task_id == parent_task_id)
    return SuccessResponse(data=await catalog.task_page(db, query, limit, offset))


@router.get(
    "/tasks/by-slug/{slug}",
    response_model=SuccessResponse[TaskDetail],
    summary="Получить опубликованное задание по slug.",
)
async def by_slug(slug: str, db: SessionDep):
    obj = await db.scalar(
        select(Task).where(
            Task.slug == slug,
            Task.status == TaskStatus.PUBLISHED,
            Task.is_hidden.is_(False),
        )
    )
    if obj is None:
        raise NotFoundError("Задание не найдено")
    return SuccessResponse(data=await catalog.detail(db, obj))


@router.get(
    "/tasks/{task_id}/presets",
    response_model=SuccessResponse[TaskPresets],
    summary="Получить все пресеты опубликованного задания с пунктами своего уровня",
)
async def public_presets(task_id: PositiveID, db: SessionDep):
    await catalog.task(db, task_id, public=True)
    return SuccessResponse(data=await catalog.task_presets(db, task_id))


@router.get(
    "/editor/tasks",
    response_model=SuccessResponse[Page[TaskRead]],
    summary="Список заданий всех состояний для администратора.",
)
async def editor_tasks(
    db: SessionDep,
    _admin: CurrentAdmin,
    limit: Limit = 20,
    offset: Offset = 0,
    status: TaskStatus | None = None,
    is_hidden: bool | None = None,
):
    query = select(Task).order_by(Task.id)
    if status:
        query = query.where(Task.status == status)
    if is_hidden is not None:
        query = query.where(Task.is_hidden == is_hidden)
    return SuccessResponse(data=await catalog.task_page(db, query, limit, offset))


@router.get(
    "/editor/tasks/{task_id}",
    response_model=SuccessResponse[TaskDetail],
    summary="Получить опубликованное или архивное задание для редактирования.",
)
async def editor_task(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    return SuccessResponse(
        data=await catalog.detail(db, await catalog.task(db, task_id))
    )


@router.put(
    "/editor/tasks/{task_id}",
    response_model=SuccessResponse[TaskDetail],
    summary="Атомарно сохранить информацию, пресеты и дерево задания",
)
async def save_task(
    task_id: PositiveID, data: TaskSave, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(data=await catalog.save_task(db, task_id, data))


@router.patch(
    "/editor/tasks/{task_id}",
    response_model=SuccessResponse[TaskRead],
    summary="Частично изменить задание с проверкой состава пресетов при публикации.",
)
async def update_task(
    task_id: PositiveID, data: TaskUpdate, db: SessionDep, _admin: CurrentAdmin
):
    obj = await catalog.update_task(
        db, task_id, data.model_dump(exclude_unset=True, mode="json")
    )
    return SuccessResponse(data=(await catalog.read_tasks(db, [obj]))[0])


@router.delete(
    "/editor/tasks/{task_id}",
    response_model=SuccessResponse[None],
    summary="Удалить неиспользуемое архивное задание.",
)
async def delete_task(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    await catalog.delete_task(db, task_id)
    return SuccessResponse()


@router.get(
    "/editor/tasks/{task_id}/presets",
    response_model=SuccessResponse[TaskPresets],
    summary="Получить все пресеты задания с пунктами своего уровня для редактора",
)
async def editor_presets(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    await catalog.task(db, task_id)
    return SuccessResponse(data=await catalog.task_presets(db, task_id))
