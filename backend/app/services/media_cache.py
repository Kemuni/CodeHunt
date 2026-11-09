import logging

from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)


class MediaCache:
    """Кэширует только байты. Права и существование файла проверяются в БД."""

    def __init__(self, url: str | None):
        self.client = (
            Redis.from_url(
                url,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                decode_responses=False,
            )
            if url
            else None
        )

    async def get(self, key: str) -> bytes | None:
        if self.client is None:
            return None
        try:
            return await self.client.get(key)
        except RedisError:
            logger.warning("Кэш медиафайлов недоступен при чтении")
            return None

    async def put(self, key: str, content: bytes) -> None:
        if self.client is not None and len(content) <= settings.MEDIA_CACHE_MAX_BYTES:
            try:
                await self.client.set(key, content, ex=settings.MEDIA_CACHE_TTL)
            except RedisError:
                logger.warning("Кэш медиафайлов недоступен при записи")

    async def close(self) -> None:
        if self.client is not None:
            await self.client.aclose()


_disabled_cache = MediaCache(None)


def get_media_cache(request: Request) -> MediaCache:
    return getattr(request.app.state, "media_cache", _disabled_cache)
