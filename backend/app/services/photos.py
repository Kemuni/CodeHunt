import warnings
from io import BytesIO
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.errors import (
    FileTooLargeError,
    InvalidPhotoError,
    MissingPhotoError,
    NotFoundError,
    PhotoLimitError,
    UploadSizeMismatchError,
)
from app.models import TaskPhoto
from app.schemas.domain import PhotoRead
from app.services import file_cleanup
from app.services.common import commit, flush
from app.services.media import MediaOwner, discard_upload
from app.services.storage import STORAGE_EXCEPTIONS, Storage, storage_error

IMAGE_TYPES = {
    "JPEG": "image/jpeg",
    "JPG": "image/jpeg",
    "MPO": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def prepare_image(content: bytes) -> tuple[bytes, str]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                content_type = IMAGE_TYPES.get(image.format or "")
                if content_type is None:
                    raise InvalidPhotoError(
                        f"Формат {image.format or 'неизвестен'} не поддерживается. Выберите JPEG, PNG или WebP"
                    )
                if image.width * image.height > 20_000_000:
                    raise InvalidPhotoError(
                        "Разрешение фотографии не должно превышать 20 мегапикселей"
                    )
                if image.format != "MPO" and getattr(image, "is_animated", False):
                    raise InvalidPhotoError(
                        "Анимированные изображения не поддерживаются"
                    )
                image.verify()
            # verify проверяет контейнер, load дополнительно проверяет декодирование пикселей.
            with Image.open(BytesIO(content)) as image:
                image.load()
                if image.format == "MPO":
                    # JPEG с дополнительными снимками/картой яркости (MPO) — не анимация.
                    # Сохраняем основной кадр обычным JPEG, доступным всем браузерам.
                    from PIL import ImageOps

                    output = BytesIO()
                    ImageOps.exif_transpose(image).convert("RGB").save(
                        output,
                        format="JPEG",
                        quality=95,
                        icc_profile=image.info.get("icc_profile"),
                    )
                    content = output.getvalue()
        return content, content_type
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise InvalidPhotoError(
            "Не удалось прочитать изображение: файл повреждён или содержит неподдерживаемый вариант JPEG/PNG/WebP"
        ) from exc


async def ensure_present(session: AsyncSession, task_id: int) -> None:
    if not await session.scalar(
        select(TaskPhoto.id).where(TaskPhoto.task_id == task_id).limit(1)
    ):
        raise MissingPhotoError()


async def read(session: AsyncSession, owner: MediaOwner) -> list[PhotoRead]:
    photos = (
        await session.scalars(
            select(TaskPhoto)
            .where(owner.condition(TaskPhoto))
            .order_by(TaskPhoto.position)
        )
    ).all()
    if not photos:
        return []
    return [photo_response(photo) for photo in photos]


async def covers(session: AsyncSession, task_ids: list[int]) -> dict[int, PhotoRead]:
    if not task_ids:
        return {}
    # Загружаем только титульные фото всей страницы одним запросом.
    photos = (
        await session.scalars(
            select(TaskPhoto).where(
                TaskPhoto.task_id.in_(task_ids), TaskPhoto.position == 1
            )
        )
    ).all()
    if not photos:
        return {}
    return {
        photo.task_id: photo_response(photo)
        for photo in photos
        if photo.task_id is not None
    }


def photo_response(photo: TaskPhoto) -> PhotoRead:
    return PhotoRead(
        id=photo.id,
        task_id=photo.task_id,
        draft_id=photo.draft_id,
        position=photo.position,
        is_cover=photo.is_cover,
        original_filename=photo.original_filename,
        content_type=photo.content_type,
        size_bytes=photo.size_bytes,
        created_at=photo.created_at,
        updated_at=photo.updated_at,
        url=f"/api/media/photos/{photo.id}",
    )


async def upload(
    session: AsyncSession, owner: MediaOwner, files: list[UploadFile], storage: Storage
):
    await owner.get(session)
    count = await session.scalar(
        select(func.count()).select_from(TaskPhoto).where(owner.condition(TaskPhoto))
    )
    if not files or len(files) + (count or 0) > 4:
        raise PhotoLimitError()
    prepared = []
    for file in files:
        filename = file.filename or "photo"
        if len(filename) > 255:
            raise InvalidPhotoError("Имя файла не должно превышать 255 символов")
        content = await file.read(settings.MAX_PHOTO_BYTES + 1)
        if len(content) > settings.MAX_PHOTO_BYTES:
            raise FileTooLargeError("Фотография превышает допустимый размер")
        content, content_type = await run_in_threadpool(prepare_image, content)
        if len(content) > settings.MAX_PHOTO_BYTES:
            raise FileTooLargeError(
                "Фотография после обработки превышает допустимый размер"
            )
        prepared.append((filename, content, content_type))
    # Передаём файлы без удержания транзакции БД, затем повторно проверяем лимит под блокировкой.
    await session.rollback()
    uploaded = []
    try:
        for _filename, content, content_type in prepared:
            key = f"photos/{uuid4().hex}"
            uploaded.append(key)
            await run_in_threadpool(storage.upload, BytesIO(content), key, content_type)
            metadata = await run_in_threadpool(storage.stat, key)
            if metadata["ContentLength"] != len(content):
                raise UploadSizeMismatchError()
        parent = await owner.get(session, lock=True)
        occupied = set(
            (
                await session.scalars(
                    select(TaskPhoto.position).where(owner.condition(TaskPhoto))
                )
            ).all()
        )
        positions = sorted(set(range(1, 5)) - occupied)
        if len(prepared) > len(positions):
            raise PhotoLimitError()
        for key, (filename, content, content_type), position in zip(
            uploaded, prepared, positions, strict=False
        ):
            session.add(
                TaskPhoto(
                    **owner.values(),
                    position=position,
                    object_key=key,
                    original_filename=filename,
                    content_type=content_type,
                    size_bytes=len(content),
                )
            )
        owner.touch(parent)
        await flush(session)
        result = await read(session, owner)
        await commit(session)
        return result
    except Exception as exc:
        await discard_upload(session, storage, uploaded)
        if isinstance(exc, STORAGE_EXCEPTIONS):
            raise storage_error(exc) from exc
        raise


async def replace(session: AsyncSession, owner: MediaOwner, photo_ids: list[int]):
    parent = await owner.get(session, lock=True)
    if owner.task_id is not None and not photo_ids:
        raise MissingPhotoError()
    current = {
        photo.id: photo
        for photo in (
            await session.scalars(select(TaskPhoto).where(owner.condition(TaskPhoto)))
        ).all()
    }
    if not set(photo_ids).issubset(current):
        raise NotFoundError("Фотография не принадлежит этому заданию")
    keys = [
        photo.object_key
        for photo_id, photo in current.items()
        if photo_id not in photo_ids
    ]
    await file_cleanup.enqueue(session, keys)
    for photo_id, photo in current.items():
        if photo_id not in photo_ids:
            await session.delete(photo)
    for position, photo_id in enumerate(photo_ids, 1):
        current[photo_id].position = position
    owner.touch(parent)
    await flush(session)
    result = await read(session, owner)
    await commit(session)
    await file_cleanup.process_pending(session, keys)
    return result
