from sqlalchemy import func, or_, select

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.api.routes.library import Limit, Offset
from app.core.errors import InvalidDifficultyError, NotFoundError
from app.models import Task, TaskComplicationLink, TaskLevelPreset
from app.models.enums import DeveloperType, Level, TaskStatus
from app.schemas import SuccessResponse
from app.schemas.common import Page, PositiveID
from app.schemas.domain import (
    CompositionItem,
    CompositionUpdate,
    Configuration,
    LinkCopy,
    LinkCreate,
    LinkRead,
    LinkUpdate,
    OrderInput,
    PresetCreate,
    PresetRead,
    PresetUpdate,
    TaskDetail,
    TaskPublication,
    TaskRead,
    TaskUpdate,
)
from app.services import catalog, composition
from app.services.common import commit, get, page

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
    return SuccessResponse(data=await page(db, query, limit, offset))


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
    "/tasks/{task_id}",
    response_model=SuccessResponse[TaskDetail],
    summary="Получить опубликованное задание по идентификатору.",
)
async def public_task(task_id: PositiveID, db: SessionDep):
    return SuccessResponse(
        data=await catalog.detail(db, await catalog.task(db, task_id, public=True))
    )


@router.get(
    "/tasks/{task_id}/presets",
    response_model=SuccessResponse[list[PresetRead]],
    summary="Показать доступные уровни опубликованного задания.",
)
async def public_presets(task_id: PositiveID, db: SessionDep):
    await catalog.task(db, task_id, public=True)
    return SuccessResponse(
        data=(
            await db.scalars(
                select(TaskLevelPreset)
                .where(TaskLevelPreset.task_id == task_id)
                .order_by(TaskLevelPreset.id)
            )
        ).all()
    )


@router.get(
    "/tasks/{task_id}/presets/{preset_id}/configuration",
    response_model=SuccessResponse[Configuration],
    summary="Получить требования пресета, включая все нижние уровни.",
)
async def public_configuration(
    task_id: PositiveID, preset_id: PositiveID, db: SessionDep
):
    await catalog.task(db, task_id, public=True)
    return SuccessResponse(data=await catalog.configuration(db, task_id, preset_id))


@router.get(
    "/editor/tasks/all",
    response_model=SuccessResponse[Page[TaskRead]],
    summary="Получить все задания для администратора, включая скрытые и архивные.",
)
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
    return SuccessResponse(data=await page(db, query, limit, offset))


@router.post(
    "/editor/tasks",
    response_model=SuccessResponse[TaskRead],
    status_code=201,
    summary="Создать готовое опубликованное задание с требованиями и пресетами.",
)
async def create_task(data: TaskPublication, db: SessionDep, _admin: CurrentAdmin):
    return SuccessResponse(
        data=await catalog.create_task(db, data.model_dump(mode="json"))
    )


@router.get(
    "/editor/tasks/{task_id}",
    response_model=SuccessResponse[TaskDetail],
    summary="Получить опубликованное или архивное задание для редактирования.",
)
async def editor_task(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    return SuccessResponse(
        data=await catalog.detail(db, await catalog.task(db, task_id))
    )


@router.patch(
    "/editor/tasks/{task_id}",
    response_model=SuccessResponse[TaskRead],
    summary="Частично изменить задание с проверкой состава пресетов при публикации.",
)
async def update_task(
    task_id: PositiveID, data: TaskUpdate, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(
        data=await catalog.update_task(
            db, task_id, data.model_dump(exclude_unset=True, mode="json")
        )
    )


@router.delete(
    "/editor/tasks/{task_id}",
    response_model=SuccessResponse[None],
    summary="Удалить неиспользуемое архивное задание.",
)
async def delete_task(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    await catalog.delete_task(db, task_id)
    return SuccessResponse()


@router.get(
    "/editor/tasks/{task_id}/complications",
    response_model=SuccessResponse[list[LinkRead]],
    summary="Показать требования задания в порядке отображения.",
)
async def links(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    await catalog.task(db, task_id)
    return SuccessResponse(
        data=(
            await db.scalars(
                select(TaskComplicationLink)
                .where(TaskComplicationLink.task_id == task_id)
                .order_by(TaskComplicationLink.order_number, TaskComplicationLink.id)
            )
        ).all()
    )


@router.post(
    "/editor/tasks/{task_id}/complications",
    response_model=SuccessResponse[LinkRead],
    status_code=201,
    summary="Добавить конкретное требование, при необходимости связав его с шаблоном.",
)
async def create_link(
    task_id: PositiveID, data: LinkCreate, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(
        data=await catalog.save_child(
            db, task_id, TaskComplicationLink, data.model_dump()
        )
    )


@router.post(
    "/editor/tasks/{task_id}/complications/copy",
    response_model=SuccessResponse[LinkRead],
    status_code=201,
    summary="Скопировать готовое требование в это задание.",
)
async def copy_link(
    task_id: PositiveID, data: LinkCopy, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(
        data=await catalog.copy_link(
            db,
            task_id,
            data.source_link_id,
            data.model_dump(exclude={"source_link_id"}),
        )
    )


@router.put(
    "/editor/tasks/{task_id}/complications/order",
    response_model=SuccessResponse[None],
    summary="Установить порядок требований по полному списку ID без повторов.",
)
async def order_links(
    task_id: PositiveID, data: OrderInput, db: SessionDep, _admin: CurrentAdmin
):
    obj = await catalog.task(db, task_id, lock=True)
    await catalog.reorder(db, TaskComplicationLink, "task_id", task_id, data.ids)
    obj.updated_at = func.clock_timestamp()
    await commit(db)
    return SuccessResponse()


@router.get(
    "/editor/tasks/{task_id}/complications/{link_id}",
    response_model=SuccessResponse[LinkRead],
    summary="Получить отдельное требование задания.",
)
async def link(
    task_id: PositiveID, link_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(
        data=await get(db, TaskComplicationLink, link_id, task_id=task_id)
    )


@router.patch(
    "/editor/tasks/{task_id}/complications/{link_id}",
    response_model=SuccessResponse[LinkRead],
    summary="Изменить требование с явным подтверждением связанного шаблона при смене текста.",
)
async def update_link(
    task_id: PositiveID,
    link_id: PositiveID,
    data: LinkUpdate,
    db: SessionDep,
    _admin: CurrentAdmin,
):
    return SuccessResponse(
        data=await catalog.save_child(
            db,
            task_id,
            TaskComplicationLink,
            data.model_dump(exclude_unset=True),
            link_id,
        )
    )


@router.delete(
    "/editor/tasks/{task_id}/complications/{link_id}",
    response_model=SuccessResponse[None],
    summary="Удалить требование, если на него не ссылаются решения.",
)
async def delete_link(
    task_id: PositiveID, link_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    await catalog.remove_child(db, task_id, TaskComplicationLink, link_id)
    return SuccessResponse()


@router.get(
    "/editor/tasks/{task_id}/presets",
    response_model=SuccessResponse[list[PresetRead]],
    summary="Показать пресеты задания в редакторе.",
)
async def presets(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    await catalog.task(db, task_id)
    return SuccessResponse(
        data=(
            await db.scalars(
                select(TaskLevelPreset)
                .where(TaskLevelPreset.task_id == task_id)
                .order_by(TaskLevelPreset.id)
            )
        ).all()
    )


@router.post(
    "/editor/tasks/{task_id}/presets",
    response_model=SuccessResponse[PresetRead],
    status_code=201,
    summary="Добавить пресет с уникальным для задания уровнем.",
)
async def create_preset(
    task_id: PositiveID, data: PresetCreate, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(
        data=await catalog.save_child(db, task_id, TaskLevelPreset, data.model_dump())
    )


@router.get(
    "/editor/tasks/{task_id}/presets/{preset_id}",
    response_model=SuccessResponse[PresetRead],
    summary="Получить описание и оценку времени пресета.",
)
async def preset(
    task_id: PositiveID, preset_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(
        data=await get(db, TaskLevelPreset, preset_id, task_id=task_id)
    )


@router.patch(
    "/editor/tasks/{task_id}/presets/{preset_id}",
    response_model=SuccessResponse[PresetRead],
    summary="Частично изменить уровень, описание или оценку времени пресета.",
)
async def update_preset(
    task_id: PositiveID,
    preset_id: PositiveID,
    data: PresetUpdate,
    db: SessionDep,
    _admin: CurrentAdmin,
):
    return SuccessResponse(
        data=await catalog.save_child(
            db, task_id, TaskLevelPreset, data.model_dump(exclude_unset=True), preset_id
        )
    )


@router.delete(
    "/editor/tasks/{task_id}/presets/{preset_id}",
    response_model=SuccessResponse[None],
    summary="Удалить пресет, если он не используется решениями.",
)
async def delete_preset(
    task_id: PositiveID, preset_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    await catalog.remove_child(db, task_id, TaskLevelPreset, preset_id)
    return SuccessResponse()


@router.get(
    "/editor/tasks/{task_id}/presets/{preset_id}/configuration",
    response_model=SuccessResponse[Configuration],
    summary="Предварительно посмотреть накопительный состав пресета.",
)
async def editor_configuration(
    task_id: PositiveID, preset_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    await catalog.task(db, task_id)
    return SuccessResponse(data=await catalog.configuration(db, task_id, preset_id))


@router.get(
    "/editor/tasks/{task_id}/composition",
    response_model=SuccessResponse[list[CompositionItem]],
    summary="Получить единое дерево групп и требований задания.",
)
async def read_composition(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    await catalog.task(db, task_id)
    return SuccessResponse(data=await composition.read(db, task_id))


@router.put(
    "/editor/tasks/{task_id}/composition",
    response_model=SuccessResponse[list[CompositionItem]],
    summary="Атомарно сохранить дерево групп и требований, сохраняя ID существующих пунктов.",
)
async def replace_composition(
    task_id: PositiveID, data: CompositionUpdate, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(data=await composition.replace(db, task_id, data))
