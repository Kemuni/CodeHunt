import logging
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, File, Form, UploadFile
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.core.config import settings
from app.core.errors import (
    FileTooLargeError,
    InvalidResourceError,
    UploadSizeMismatchError,
)
from app.models import TaskResource
from app.models.enums import ResourceType
from app.schemas import SuccessResponse
from app.schemas.common import DownloadURL, PositiveID
from app.schemas.domain import ResourcePatch, ResourceRead
from app.services import catalog
from app.services.common import assign, commit, flush, get
from app.services.storage import STORAGE_EXCEPTIONS, Storage, get_storage, storage_error

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
    await catalog.task(db, task_id)
    title = title.strip()
    filename = file.filename or "file"
    if not title or len(filename) > 255 or len(file.content_type or "") > 255:
        raise InvalidResourceError()
    # Starlette сохраняет UploadFile во временный файл. Считаем фактический размер порциями.
    size = 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > settings.MAX_RESOURCE_BYTES:
            raise FileTooLargeError()
    await file.seek(0)
    key = f"tasks/{task_id}/{uuid4().hex}"
    # Освобождаем транзакцию БД перед длительной передачей файла.
    await db.rollback()
    try:
        await run_in_threadpool(
            storage.upload,
            file.file,
            key,
            file.content_type or "application/octet-stream",
        )
        metadata = await run_in_threadpool(storage.stat, key)
        if metadata["ContentLength"] != size:
            raise UploadSizeMismatchError()
        await catalog.task(db, task_id, lock=True)
        obj = TaskResource(
            task_id=task_id,
            title=title,
            type=type,
            object_key=key,
            original_filename=filename,
            content_type=file.content_type,
            size_bytes=size,
        )
        db.add(obj)
        await flush(db)
        await db.refresh(obj)
        await commit(db)
    except Exception as exc:
        await db.rollback()
        try:
            await run_in_threadpool(storage.delete, key)
        except Exception:
            logger.exception("Failed to remove orphaned upload %s", key)
        if isinstance(exc, STORAGE_EXCEPTIONS):
            raise storage_error(exc) from exc
        raise
    return SuccessResponse(data=obj)


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


async def download(
    db: SessionDep, task_id: PositiveID, resource_id: PositiveID, storage: Storage
):
    obj = await get(db, TaskResource, resource_id, task_id=task_id)
    try:
        await run_in_threadpool(storage.stat, obj.object_key)
        url = await run_in_threadpool(storage.get_download_url, obj.object_key)
    except STORAGE_EXCEPTIONS as exc:
        raise storage_error(exc) from exc
    return {"url": url, "expires_in": settings.S3_URL_TTL}


@router.get(
    "/tasks/{task_id}/resources/{resource_id}/download-url",
    response_model=SuccessResponse[DownloadURL],
    summary="Получить временную ссылку на файл опубликованного задания.",
)
async def public_download(
    task_id: PositiveID, resource_id: PositiveID, db: SessionDep, storage: StorageDep
):
    await catalog.task(db, task_id, public=True)
    return SuccessResponse(data=await download(db, task_id, resource_id, storage))


@router.get(
    "/editor/tasks/{task_id}/resources/{resource_id}/download-url",
    response_model=SuccessResponse[DownloadURL],
    summary="Получить временную ссылку на файл из редактора.",
)
async def editor_download(
    task_id: PositiveID,
    resource_id: PositiveID,
    db: SessionDep,
    storage: StorageDep,
    _admin: CurrentAdmin,
):
    await catalog.task(db, task_id)
    return SuccessResponse(data=await download(db, task_id, resource_id, storage))
