from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.errors import (
    FileTooLargeError,
    InvalidResourceError,
    UploadSizeMismatchError,
)
from app.models import TaskResource
from app.models.enums import ResourceType
from app.schemas.common import DownloadURL
from app.schemas.domain import ResourceDownloadRead, ResourceRead
from app.services import file_cleanup
from app.services.common import assign, commit, flush, get
from app.services.media import MediaOwner, discard_upload
from app.services.storage import STORAGE_EXCEPTIONS, Storage, storage_error


def download_url(resource: TaskResource) -> DownloadURL:
    return DownloadURL(url=f"/api/media/resources/{resource.id}")


async def read(session: AsyncSession, owner: MediaOwner) -> list[ResourceDownloadRead]:
    objects = (
        await session.scalars(
            select(TaskResource)
            .where(owner.condition(TaskResource))
            .order_by(TaskResource.id)
        )
    ).all()
    return [
        ResourceDownloadRead(
            **ResourceRead.model_validate(obj).model_dump(),
            url=download_url(obj).url,
        )
        for obj in objects
    ]


async def upload(
    session: AsyncSession,
    owner: MediaOwner,
    file: UploadFile,
    title: str,
    resource_type: ResourceType,
    storage: Storage,
):
    await owner.get(session)
    title = title.strip()
    filename = file.filename or "file"
    if (
        not title
        or len(title) > 255
        or len(filename) > 255
        or len(file.content_type or "") > 255
    ):
        raise InvalidResourceError()
    size = 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > settings.MAX_RESOURCE_BYTES:
            raise FileTooLargeError()
    await file.seek(0)
    key = f"resources/{uuid4().hex}"
    await session.rollback()
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
        parent = await owner.get(session, lock=True)
        obj = TaskResource(
            **owner.values(),
            title=title,
            type=resource_type,
            object_key=key,
            original_filename=filename,
            content_type=file.content_type,
            size_bytes=size,
        )
        session.add(obj)
        owner.touch(parent)
        await flush(session)
        await session.refresh(obj)
        await commit(session)
        return obj
    except Exception as exc:
        await discard_upload(session, storage, [key])
        if isinstance(exc, STORAGE_EXCEPTIONS):
            raise storage_error(exc) from exc
        raise


async def update(
    session: AsyncSession, owner: MediaOwner, resource_id: int, values: dict
):
    parent = await owner.get(session, lock=True)
    obj = await get(session, TaskResource, resource_id, **owner.values())
    assign(obj, values)
    owner.touch(parent)
    return await commit(session, obj)


async def delete(session: AsyncSession, owner: MediaOwner, resource_id: int):
    parent = await owner.get(session, lock=True)
    obj = await get(session, TaskResource, resource_id, **owner.values())
    keys = [obj.object_key]
    await file_cleanup.enqueue(session, keys)
    await session.delete(obj)
    owner.touch(parent)
    await commit(session)
    await file_cleanup.process_pending(session, keys)
