import logging
from typing import Annotated

from fastapi import Depends, File, Form, UploadFile

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.models import TaskResource
from app.models.enums import ResourceType
from app.schemas import SuccessResponse
from app.schemas.common import PositiveID
from app.schemas.domain import ResourceDownloadRead, ResourcePatch
from app.services import catalog, resources
from app.services.common import assign, commit, get
from app.services.media import MediaOwner
from app.services.storage import Storage, get_storage

router = APIResponseRouter(tags=["resources"])
StorageDep = Annotated[Storage, Depends(get_storage)]
logger = logging.getLogger(__name__)


@router.post(
    "/editor/tasks/{task_id}/resources",
    response_model=SuccessResponse[ResourceDownloadRead],
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
    obj = await resources.upload(
        db, MediaOwner(task_id=task_id), file, title, type, storage
    )
    return SuccessResponse(data=resources.resource_response(obj))


@router.patch(
    "/editor/tasks/{task_id}/resources/{resource_id}",
    response_model=SuccessResponse[ResourceDownloadRead],
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
    await commit(db, obj)
    return SuccessResponse(data=resources.resource_response(obj))


@router.delete(
    "/editor/tasks/{task_id}/resources/{resource_id}",
    response_model=SuccessResponse[None],
    summary="Удалить вложение и его файл из хранилища",
)
async def delete(
    task_id: PositiveID, resource_id: PositiveID, db: SessionDep, _admin: CurrentAdmin
):
    await resources.delete(db, MediaOwner(task_id=task_id), resource_id)
    return SuccessResponse()
