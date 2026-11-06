from typing import Annotated

from fastapi import Depends, File, Form, Query, UploadFile
from starlette.concurrency import run_in_threadpool

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.core.config import settings
from app.models import TaskDraft, TaskResource
from app.models.enums import ResourceType
from app.schemas import SuccessResponse
from app.schemas.common import DownloadURL, PositiveID
from app.schemas.domain import DraftGalleryUpdate, DraftRead, DraftResourceUpdate
from app.services import drafts, photos, resources
from app.services.common import get
from app.services.media import MediaOwner
from app.services.storage import STORAGE_EXCEPTIONS, Storage, get_storage, storage_error

router = APIResponseRouter(
    prefix="/editor/task-drafts/{draft_id}", tags=["task-draft-files"]
)
StorageDep = Annotated[Storage, Depends(get_storage)]
RevisionForm = Annotated[int, Form(gt=0)]
RevisionQuery = Annotated[int, Query(gt=0)]


async def current_draft(db: SessionDep, owner: MediaOwner):
    assert owner.draft_id is not None
    obj = await get(db, TaskDraft, owner.draft_id, owner_id=owner.user_id)
    return await drafts.read(db, obj)


@router.post(
    "/photos",
    response_model=SuccessResponse[DraftRead],
    status_code=201,
    summary="Добавить фотографии в свой черновик и вернуть обновлённую форму.",
)
async def upload_photos(
    draft_id: PositiveID,
    db: SessionDep,
    admin: CurrentAdmin,
    storage: StorageDep,
    revision: RevisionForm,
    files: Annotated[list[UploadFile], File()],
):
    owner = MediaOwner(draft_id=draft_id, user_id=admin.id, revision=revision)
    await photos.upload(db, owner, files, storage)
    return SuccessResponse(data=await current_draft(db, owner))


@router.put(
    "/photos",
    response_model=SuccessResponse[DraftRead],
    summary="Сохранить галерею черновика, первое фото титульное, отсутствующие удаляются.",
)
async def update_photos(
    draft_id: PositiveID, data: DraftGalleryUpdate, db: SessionDep, admin: CurrentAdmin
):
    owner = MediaOwner(draft_id=draft_id, user_id=admin.id, revision=data.revision)
    await photos.replace(db, owner, data.photo_ids)
    return SuccessResponse(data=await current_draft(db, owner))


@router.post(
    "/resources",
    response_model=SuccessResponse[DraftRead],
    status_code=201,
    summary="Прикрепить файл к своему черновику и вернуть обновлённую форму.",
)
async def upload_resource(
    draft_id: PositiveID,
    db: SessionDep,
    admin: CurrentAdmin,
    storage: StorageDep,
    revision: RevisionForm,
    file: Annotated[UploadFile, File()],
    title: Annotated[str | None, Form(min_length=1, max_length=255)] = None,
    type: Annotated[ResourceType, Form()] = ResourceType.OTHER,
):
    owner = MediaOwner(draft_id=draft_id, user_id=admin.id, revision=revision)
    await resources.upload(
        db, owner, file, title or file.filename or "Вложение", type, storage
    )
    return SuccessResponse(data=await current_draft(db, owner))


@router.patch(
    "/resources/{resource_id}",
    response_model=SuccessResponse[DraftRead],
    summary="Изменить название или назначение вложения своего черновика.",
)
async def update_resource(
    draft_id: PositiveID,
    resource_id: PositiveID,
    data: DraftResourceUpdate,
    db: SessionDep,
    admin: CurrentAdmin,
):
    owner = MediaOwner(draft_id=draft_id, user_id=admin.id, revision=data.revision)
    await resources.update(
        db,
        owner,
        resource_id,
        data.model_dump(exclude={"revision"}, exclude_unset=True),
    )
    return SuccessResponse(data=await current_draft(db, owner))


@router.delete(
    "/resources/{resource_id}",
    response_model=SuccessResponse[DraftRead],
    summary="Удалить вложение из своего черновика с проверкой ревизии.",
)
async def delete_resource(
    draft_id: PositiveID,
    resource_id: PositiveID,
    revision: RevisionQuery,
    db: SessionDep,
    admin: CurrentAdmin,
):
    owner = MediaOwner(draft_id=draft_id, user_id=admin.id, revision=revision)
    await resources.delete(db, owner, resource_id)
    return SuccessResponse(data=await current_draft(db, owner))


@router.get(
    "/resources/{resource_id}/download-url",
    response_model=SuccessResponse[DownloadURL],
    summary="Получить временную ссылку на вложение собственного черновика.",
)
async def download_resource(
    draft_id: PositiveID,
    resource_id: PositiveID,
    db: SessionDep,
    admin: CurrentAdmin,
    storage: StorageDep,
):
    owner = MediaOwner(draft_id=draft_id, user_id=admin.id)
    await owner.get(db)
    obj = await get(db, TaskResource, resource_id, **owner.values())
    try:
        await run_in_threadpool(storage.stat, obj.object_key)
        url = await run_in_threadpool(storage.get_download_url, obj.object_key)
    except STORAGE_EXCEPTIONS as exc:
        raise storage_error(exc) from exc
    return SuccessResponse(data=DownloadURL(url=url, expires_in=settings.S3_URL_TTL))
