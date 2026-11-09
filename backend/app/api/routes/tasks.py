from typing import Annotated

from fastapi import Query

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, OptionalUser, SessionDep
from app.schemas import SuccessResponse
from app.schemas.catalog import EditorTaskCatalogQuery, TaskCatalogQuery
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
    db: SessionDep, user: OptionalUser, filters: Annotated[TaskCatalogQuery, Query()]
):
    query = catalog.catalog_query(filters, public=True, user=user)
    return SuccessResponse(
        data=await catalog.task_page(db, query, filters.limit, filters.offset)
    )


@router.get(
    "/tasks/by-slug/{slug}",
    response_model=SuccessResponse[TaskDetail],
    summary="Получить опубликованное задание по slug.",
)
async def by_slug(slug: str, db: SessionDep, user: OptionalUser):
    obj = await catalog.public_task_by_slug(db, slug, user)
    return SuccessResponse(data=await catalog.detail(db, obj))


@router.get(
    "/tasks/by-slug/{slug}/presets",
    response_model=SuccessResponse[TaskPresets],
    summary="Получить все пресеты опубликованного задания с пунктами своего уровня",
)
async def public_presets(slug: str, db: SessionDep, user: OptionalUser):
    obj = await catalog.public_task_by_slug(db, slug, user)
    return SuccessResponse(data=await catalog.task_presets(db, obj.id))


@router.get(
    "/editor/tasks",
    response_model=SuccessResponse[Page[TaskRead]],
    summary="Список заданий всех состояний для администратора.",
)
async def editor_tasks(
    db: SessionDep,
    _admin: CurrentAdmin,
    filters: Annotated[EditorTaskCatalogQuery, Query()],
):
    query = catalog.catalog_query(filters, public=False)
    return SuccessResponse(
        data=await catalog.task_page(db, query, filters.limit, filters.offset)
    )


@router.get(
    "/editor/tasks/{task_id}",
    response_model=SuccessResponse[TaskDetail],
    summary="Получить задание для редактирования",
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
    summary="Удалить неиспользуемое задание и его файлы",
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
