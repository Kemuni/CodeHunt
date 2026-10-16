from fastapi import APIRouter

from app.api.routes import contact_request, utils

api_router = APIRouter()
api_router.include_router(utils.router)
api_router.include_router(contact_request.router)
