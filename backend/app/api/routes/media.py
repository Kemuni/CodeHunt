from hashlib import sha256
from typing import Annotated
from urllib.parse import quote

from fastapi import Depends, Request, Response
from starlette.background import BackgroundTask
from starlette.responses import StreamingResponse

from app.api.base import APIResponseRouter
from app.api.deps import OptionalUser, SessionDep
from app.models import TaskPhoto, TaskResource
from app.schemas.common import PositiveID
from app.services import media
from app.services.media_cache import MediaCache, get_media_cache

router = APIResponseRouter(tags=["media"])
CacheDep = Annotated[MediaCache, Depends(get_media_cache)]


async def serve_file(
    file: TaskPhoto | TaskResource, request: Request, cache: MediaCache
) -> Response:
    # Вызывается после проверки доступа, в том числе для кэша и условных запросов.
    etag = f'"{sha256(file.object_key.encode()).hexdigest()}"'
    headers = {
        # Браузер хранит байты, но повторно проверяет доступ и ETag перед показом.
        "Cache-Control": "private, no-cache",
        "ETag": etag,
        "X-Content-Type-Options": "nosniff",
        "Vary": "Cookie, Authorization",
    }
    if isinstance(file, TaskResource):
        headers["Content-Disposition"] = (
            f"attachment; filename*=UTF-8''{quote(file.original_filename, safe='')}"
        )
    candidates = request.headers.get("if-none-match", "").split(",")
    if any(value.strip().removeprefix("W/") in {etag, "*"} for value in candidates):
        return Response(status_code=304, headers=headers)
    if request.method == "HEAD":
        if file.size_bytes is not None:
            headers["Content-Length"] = str(file.size_bytes)
        return Response(
            headers=headers, media_type=file.content_type or "application/octet-stream"
        )
    data = await media.content(file.object_key, cache, file.size_bytes)
    if not isinstance(data, bytes):
        return StreamingResponse(
            media.stream_content(data),
            headers=headers,
            media_type=file.content_type or "application/octet-stream",
            background=BackgroundTask(media.close_stream, data),
        )
    return Response(
        content=data,
        headers=headers,
        media_type=file.content_type or "application/octet-stream",
    )


@router.head("/media/photos/{photo_id}", include_in_schema=False)
@router.get(
    "/media/photos/{photo_id}",
    response_class=Response,
    summary="Получить фотографию по постоянному адресу с проверкой доступа.",
)
async def photo(
    photo_id: PositiveID,
    request: Request,
    db: SessionDep,
    user: OptionalUser,
    cache: CacheDep,
):
    file = await media.accessible_file(db, TaskPhoto, photo_id, user)
    return await serve_file(file, request, cache)


@router.head("/media/resources/{resource_id}", include_in_schema=False)
@router.get(
    "/media/resources/{resource_id}",
    response_class=Response,
    summary="Скачать вложение по постоянному адресу с проверкой доступа.",
)
async def resource(
    resource_id: PositiveID,
    request: Request,
    db: SessionDep,
    user: OptionalUser,
    cache: CacheDep,
):
    file = await media.accessible_file(db, TaskResource, resource_id, user)
    return await serve_file(file, request, cache)
