from typing import Annotated

from fastapi import Query
from sqlalchemy import select

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.core.errors import TemplateInUseError
from app.models import TaskComplication, TaskComplicationCategory, TaskComplicationLink
from app.models.enums import DeveloperType
from app.schemas import SuccessResponse
from app.schemas.common import PositiveID
from app.schemas.domain import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    DeveloperLibrary,
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
)
from app.services.library import grouped_templates

router = APIResponseRouter(tags=["complication-library"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get(
    "/task-complications/library",
    response_model=SuccessResponse[list[DeveloperLibrary]],
    summary="Получить библиотеку требований по направлениям разработки с деревом категорий.",
)
async def library(
    db: SessionDep, q: str | None = None, developer_type: DeveloperType | None = None
):
    return SuccessResponse(data=await grouped_templates(db, q, developer_type))


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
