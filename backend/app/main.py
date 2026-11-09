import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.db import async_session_maker
from app.core.exception_handlers import register_exception_handlers
from app.services.file_cleanup import run_worker
from app.services.media_cache import MediaCache

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting application...")
    cache = MediaCache(settings.REDIS_URL)
    _app.state.media_cache = cache
    cleanup = asyncio.create_task(run_worker(async_session_maker))
    try:
        yield
    finally:
        cleanup.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup
        await cache.close()
    logger.info("Shutting down application...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)
register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
