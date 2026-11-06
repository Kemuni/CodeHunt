from typing import Annotated

from fastapi import Depends, File, UploadFile

from app.api.base import APIResponseRouter
from app.api.deps import CurrentAdmin, SessionDep
from app.schemas import SuccessResponse
from app.schemas.common import PositiveID
from app.schemas.domain import GalleryUpdate, PhotoRead
from app.services import photos
from app.services.media import MediaOwner
from app.services.storage import Storage, get_storage

router = APIResponseRouter(tags=["task-photos"])
StorageDep = Annotated[Storage, Depends(get_storage)]


@router.post(
    "/editor/tasks/{task_id}/photos",
    status_code=201,
    response_model=SuccessResponse[list[PhotoRead]],
    summary="Добавить фотографии задания, первая фотография становится титульной.",
)
async def upload_photos(
    task_id: PositiveID,
    db: SessionDep,
    _admin: CurrentAdmin,
    storage: StorageDep,
    files: Annotated[list[UploadFile], File()],
):
    return SuccessResponse(
        data=await photos.upload(db, MediaOwner(task_id=task_id), files, storage)
    )


@router.put(
    "/editor/tasks/{task_id}/photos",
    response_model=SuccessResponse[list[PhotoRead]],
    summary="Сохранить список фотографий, первая титульная, отсутствующие в списке удаляются.",
)
async def update_gallery(
    task_id: PositiveID, data: GalleryUpdate, db: SessionDep, _admin: CurrentAdmin
):
    return SuccessResponse(
        data=await photos.replace(db, MediaOwner(task_id=task_id), data.photo_ids)
    )
