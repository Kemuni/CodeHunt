import logging
from typing import Annotated

from fastapi import Depends, File, Form, UploadFile
from sqlalchemy import select

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.models import TaskResource
from app.models.enums import ResourceType
from app.schemas import SuccessResponse
from app.schemas.common import DownloadURL, PositiveID
from app.schemas.domain import ResourcePatch, ResourceRead
from app.services import catalog, resources
from app.services.common import assign, commit, get
from app.services.media import MediaOwner
from app.services.storage import Storage, get_storage

router = APIResponseRouter(tags=["resources"])
StorageDep = Annotated[Storage, Depends(get_storage)]
logger = logging.getLogger(__name__)


async def resource_list(db: SessionDep, task_id: PositiveID):
    return (
        await db.scalars(
            select(TaskResource)
            .where(TaskResource.task_id == task_id)
            .order_by(TaskResource.id)
        )
    ).all()


@router.get(
    "/tasks/{task_id}/resources",
    response_model=SuccessResponse[list[ResourceRead]],
    summary="Список файлов опубликованного задания.",
)
async def public_list(task_id: PositiveID, db: SessionDep):
    await catalog.task(db, task_id, public=True)
    return SuccessResponse(data=await resource_list(db, task_id))


@router.get(
    "/editor/tasks/{task_id}/resources",
    response_model=SuccessResponse[list[ResourceRead]],
    summary="Список файлов задания для администратора.",
)
async def editor_list(task_id: PositiveID, db: SessionDep, _admin: CurrentAdmin):
    await catalog.task(db, task_id)
    return SuccessResponse(data=await resource_list(db, task_id))


@router.post(
    "/editor/tasks/{task_id}/resources",
    response_model=SuccessResponse[ResourceRead],
    status_code=201,
    summary="Загрузить файл в MinIO и сохранить метаданные ресурса.",
)
async def upload(
    task_id: PositiveID,
    db: SessionDep,
    _admin: CurrentAdmin,
    storage: StorageDep,
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form(min_length=1, max_length=255)],
    type: Annotated[ResourceType, Form()],
):
    return SuccessResponse(
        data=await resources.upload(
            db, MediaOwner(task_id=task_id), file, title, type, storage
        )
    )


@router.patch(
    "/editor/tasks/{task_id}/resources/{resource_id}",
    response_model=SuccessResponse[ResourceRead],
    summary="Изменить название или тип ресурса.",
)
async def update(
    task_id: PositiveID,
    resource_id: PositiveID,
    data: ResourcePatch,
    db: SessionDep,
    _admin: CurrentAdmin,
):
    await catalog.task(db, task_id, lock=True)
    obj = await get(db, TaskResource, resource_id, task_id=task_id)
    assign(obj, data.model_dump(exclude_unset=True))
    return SuccessResponse(data=await commit(db, obj))


@router.delete(
    "/editor/tasks/{task_id}/resources/{resource_id}",
    response_model=SuccessResponse[None],
    summary="Удалить привязку ресурса с сохранением файла в хранилище.",
)
async def delete(
    task_id: PositiveID, resource_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    await catalog.task(db, task_id, lock=True)
    await db.delete(await get(db, TaskResource, resource_id, task_id=task_id))
    await commit(db)
    # Физический файл остаётся до отдельной проверки и очистки неиспользуемых объектов.
    return SuccessResponse()


async def download(db: SessionDep, task_id: PositiveID, resource_id: PositiveID):
    obj = await get(db, TaskResource, resource_id, task_id=task_id)
    return resources.download_url(obj)


@router.get(
    "/tasks/{task_id}/resources/{resource_id}/download-url",
    response_model=SuccessResponse[DownloadURL],
    summary="Получить постоянную ссылку на файл опубликованного задания.",
)
async def public_download(task_id: PositiveID, resource_id: PositiveID, db: SessionDep):
    await catalog.task(db, task_id, public=True)
    return SuccessResponse(data=await download(db, task_id, resource_id))


@router.get(
    "/editor/tasks/{task_id}/resources/{resource_id}/download-url",
    response_model=SuccessResponse[DownloadURL],
    summary="Получить постоянную ссылку на файл из редактора.",
)
async def editor_download(
    task_id: PositiveID,
    resource_id: PositiveID,
    db: SessionDep,
    _admin: CurrentAdmin,
):
    await catalog.task(db, task_id)
    return SuccessResponse(data=await download(db, task_id, resource_id))
