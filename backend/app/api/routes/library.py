from typing import Annotated

from fastapi import Query
from sqlalchemy import or_, select

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.core.errors import ConflictingFiltersError, TemplateInUseError
from app.models import TaskComplication, TaskComplicationCategory, TaskComplicationLink
from app.models.enums import ComplicationGroup, DeveloperType
from app.schemas import SuccessResponse
from app.schemas.common import Page, PositiveID
from app.schemas.domain import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    TemplateCreate,
    TemplateRead,
    TemplateUpdate,
)
from app.services.common import (
    Hierarchy,
    assign,
    check_parent,
    commit,
    get,
    lock_hierarchy,
    page,
)

router = APIResponseRouter(tags=["complication-library"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get(
    "/task-complication-categories",
    response_model=SuccessResponse[Page[CategoryRead]],
    summary="Список категорий с фильтрами, включая выбор корней через roots_only.",
)
async def categories(
    db: SessionDep,
    limit: Limit = 20,
    offset: Offset = 0,
    parent_id: PositiveID | None = None,
    roots_only: bool = False,
    developer_type: DeveloperType | None = None,
    group: ComplicationGroup | None = None,
):
    if roots_only and parent_id is not None:
        raise ConflictingFiltersError()
    query = select(TaskComplicationCategory).order_by(TaskComplicationCategory.id)
    if roots_only:
        query = query.where(TaskComplicationCategory.parent_id.is_(None))
    elif parent_id is not None:
        query = query.where(TaskComplicationCategory.parent_id == parent_id)
    if developer_type:
        query = query.where(TaskComplicationCategory.developer_type == developer_type)
    if group:
        query = query.where(TaskComplicationCategory.group == group)
    return SuccessResponse(data=await page(db, query, limit, offset))


@router.post(
    "/task-complication-categories",
    response_model=SuccessResponse[CategoryRead],
    status_code=201,
    summary="Создать категорию требований от имени администратора.",
)
async def create_category(data: CategoryCreate, db: SessionDep, _admin: CurrentAdmin):
    await check_parent(db, TaskComplicationCategory, data.parent_id, None, "parent_id")
    obj = TaskComplicationCategory(**data.model_dump())
    db.add(obj)
    return SuccessResponse(data=await commit(db, obj))


@router.get(
    "/task-complication-categories/{category_id}",
    response_model=SuccessResponse[CategoryRead],
    summary="Получить категорию по идентификатору.",
)
async def category(category_id: PositiveID, db: SessionDep):
    return SuccessResponse(data=await get(db, TaskComplicationCategory, category_id))


@router.patch(
    "/task-complication-categories/{category_id}",
    response_model=SuccessResponse[CategoryRead],
    summary="Изменить поля категории с проверкой циклов иерархии.",
)
async def update_category(
    category_id: PositiveID, data: CategoryUpdate, db: SessionDep, _admin: CurrentAdmin
):
    if "parent_id" in data.model_fields_set:
        await lock_hierarchy(db, Hierarchy.CATEGORIES)
    obj = await get(db, TaskComplicationCategory, category_id, lock=True)
    values = data.model_dump(exclude_unset=True)
    await check_parent(
        db,
        TaskComplicationCategory,
        values.get("parent_id", obj.parent_id),
        obj.id,
        "parent_id",
    )
    assign(obj, values)
    return SuccessResponse(data=await commit(db, obj))


@router.delete(
    "/task-complication-categories/{category_id}",
    response_model=SuccessResponse[None],
    summary="Удалить категорию, если она не используется.",
)
async def delete_category(
    category_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    await db.delete(await get(db, TaskComplicationCategory, category_id, lock=True))
    await commit(db)
    return SuccessResponse()


@router.get(
    "/task-complications",
    response_model=SuccessResponse[Page[TemplateRead]],
    summary="Найти общие требования по тексту, категории, направлению или группе.",
)
async def templates(
    db: SessionDep,
    limit: Limit = 20,
    offset: Offset = 0,
    q: str | None = None,
    category_id: PositiveID | None = None,
    developer_type: DeveloperType | None = None,
    group: ComplicationGroup | None = None,
):
    query = (
        select(TaskComplication)
        .join(TaskComplicationCategory)
        .order_by(TaskComplication.id)
    )
    if q:
        query = query.where(
            or_(
                TaskComplication.title.icontains(q, autoescape=True),
                TaskComplication.description.icontains(q, autoescape=True),
            )
        )
    if category_id is not None:
        query = query.where(TaskComplication.category_id == category_id)
    if developer_type:
        query = query.where(TaskComplicationCategory.developer_type == developer_type)
    if group:
        query = query.where(TaskComplicationCategory.group == group)
    return SuccessResponse(data=await page(db, query, limit, offset))


@router.post(
    "/task-complications",
    response_model=SuccessResponse[TemplateRead],
    status_code=201,
    summary="Добавить общий шаблон требования в библиотеку.",
)
async def create_template(data: TemplateCreate, db: SessionDep, _admin: CurrentAdmin):
    await get(db, TaskComplicationCategory, data.category_id)
    obj = TaskComplication(**data.model_dump())
    db.add(obj)
    return SuccessResponse(data=await commit(db, obj))


@router.get(
    "/task-complications/{template_id}",
    response_model=SuccessResponse[TemplateRead],
    summary="Получить общий шаблон требования.",
)
async def template(template_id: PositiveID, db: SessionDep):
    return SuccessResponse(data=await get(db, TaskComplication, template_id))


@router.patch(
    "/task-complications/{template_id}",
    response_model=SuccessResponse[TemplateRead],
    summary="Изменить шаблон с защитой текста уже используемых шаблонов.",
)
async def update_template(
    template_id: PositiveID, data: TemplateUpdate, db: SessionDep, _admin: CurrentAdmin
):
    obj = await get(db, TaskComplication, template_id, lock=True)
    values = data.model_dump(exclude_unset=True)
    if any(
        key in values and values[key] != getattr(obj, key)
        for key in ("title", "description")
    ):
        if await db.scalar(
            select(TaskComplicationLink.id)
            .where(TaskComplicationLink.complication_id == template_id)
            .limit(1)
        ):
            raise TemplateInUseError()
    if "category_id" in values:
        await get(db, TaskComplicationCategory, values["category_id"])
    assign(obj, values)
    return SuccessResponse(data=await commit(db, obj))


@router.delete(
    "/task-complications/{template_id}",
    response_model=SuccessResponse[None],
    summary="Удалить шаблон, на который нет ссылок.",
)
async def delete_template(
    template_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    await db.delete(await get(db, TaskComplication, template_id, lock=True))
    await commit(db)
    return SuccessResponse()
