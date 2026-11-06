from typing import Annotated

from fastapi import Query
from sqlalchemy import select

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.api.routes.library import Limit, Offset
from app.models import TaskDraft
from app.schemas import SuccessResponse
from app.schemas.common import Page, PositiveID
from app.schemas.domain import (
    DraftCreate,
    DraftPublish,
    DraftRead,
    DraftUpdate,
    TaskDetail,
)
from app.services import drafts
from app.services.common import get, page

router = APIResponseRouter(prefix="/editor/task-drafts", tags=["task-drafts"])


@router.post(
    "",
    response_model=SuccessResponse[DraftRead],
    status_code=201,
    summary="Сохранить неполную форму текущего администратора с актуальными ошибками.",
)
async def create(data: DraftCreate, db: SessionDep, admin: CurrentAdmin):
    return SuccessResponse(data=await drafts.create(db, admin.id, data.payload))


@router.get(
    "",
    response_model=SuccessResponse[Page[DraftRead]],
    summary="Список собственных черновиков с повторной проверкой их ошибок.",
)
async def listing(
    db: SessionDep, admin: CurrentAdmin, limit: Limit = 20, offset: Offset = 0
):
    result = await page(
        db,
        select(TaskDraft)
        .where(TaskDraft.owner_id == admin.id)
        .order_by(TaskDraft.updated_at.desc(), TaskDraft.id.desc()),
        limit,
        offset,
    )
    result["items"] = [await drafts.read(db, obj) for obj in result["items"]]
    return SuccessResponse(data=result)


@router.get(
    "/{draft_id}",
    response_model=SuccessResponse[DraftRead],
    summary="Открыть свой черновик и проверить занятость slug и остальные поля.",
)
async def read(draft_id: PositiveID, db: SessionDep, admin: CurrentAdmin):
    obj = await get(db, TaskDraft, draft_id, owner_id=admin.id)
    return SuccessResponse(data=await drafts.read(db, obj))


@router.patch(
    "/{draft_id}",
    response_model=SuccessResponse[DraftRead],
    summary="Сохранить форму с проверкой revision для защиты от перезаписи.",
)
async def update(
    draft_id: PositiveID, data: DraftUpdate, db: SessionDep, admin: CurrentAdmin
):
    return SuccessResponse(
        data=await drafts.update(db, admin.id, draft_id, data.revision, data.payload)
    )


@router.delete(
    "/{draft_id}",
    response_model=SuccessResponse[None],
    summary="Удалить собственный черновик формы.",
)
async def delete(
    draft_id: PositiveID,
    db: SessionDep,
    admin: CurrentAdmin,
    revision: Annotated[int, Query(gt=0)],
):
    await drafts.delete(db, admin.id, draft_id, revision)
    return SuccessResponse()


@router.post(
    "/{draft_id}/publish",
    response_model=SuccessResponse[TaskDetail],
    status_code=201,
    summary="Опубликовать всё задание и перенести фотографии и вложения одной транзакцией.",
)
async def publish(
    draft_id: PositiveID, data: DraftPublish, db: SessionDep, admin: CurrentAdmin
):
    return SuccessResponse(
        data=await drafts.publish(db, admin.id, draft_id, data.revision)
    )
