from fastapi import APIRouter, Response

from app.api.deps import BearerCredentials, CurrentUser, SessionDep
from app.schemas.auth import AuthUser, GitHubLogin, LoginResult
from app.schemas.common import SuccessResponse
from app.services import auth

router = APIRouter(prefix="/auth", tags=["Авторизация"])


@router.post(
    "/github", response_model=SuccessResponse[LoginResult], summary="Войти через GitHub"
)
async def login(data: GitHubLogin, db: SessionDep, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return SuccessResponse(
        data=await auth.login(db, data.access_token.get_secret_value())
    )


@router.get(
    "/me",
    response_model=SuccessResponse[AuthUser],
    summary="Получить текущего пользователя",
)
async def me(user: CurrentUser, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return SuccessResponse(data=AuthUser.model_validate(user))


@router.post(
    "/logout", response_model=SuccessResponse[None], summary="Завершить текущую сессию"
)
async def logout(db: SessionDep, credentials: BearerCredentials, response: Response):
    response.headers["Cache-Control"] = "no-store"
    if credentials:
        await auth.logout(db, credentials.credentials)
    return SuccessResponse(data=None)
