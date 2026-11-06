from fastapi import APIRouter

from app.api.routes import (
    contact_request,
    draft_files,
    drafts,
    library,
    photos,
    resources,
    solutions,
    tasks,
    utils,
)

api_router = APIRouter()
api_router.include_router(utils.router)
api_router.include_router(contact_request.router)
api_router.include_router(library.router)
api_router.include_router(tasks.router)
api_router.include_router(drafts.router)
api_router.include_router(solutions.router)
api_router.include_router(resources.router)

api_router.include_router(photos.router)

api_router.include_router(draft_files.router)
