from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session_maker
from app.core.errors import AdminRequiredError, UnknownUserError
from app.models import User


async def get_db() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


SessionDep = Annotated[AsyncSession, Depends(get_db)]


async def current_user(
    db: SessionDep,
    x_user_id: Annotated[int, Header(gt=0)],
) -> User:
    """Временный выбор пользователя для разработки. Перед публикацией нужна аутентификация."""
    user: User | None = await db.get(User, x_user_id)
    if user is None:
        raise UnknownUserError()
    return user


CurrentUser = Annotated[User, Depends(current_user)]


async def current_admin(user: CurrentUser) -> User:
    if not user.is_admin:
        raise AdminRequiredError()
    return user


CurrentAdmin = Annotated[User, Depends(current_admin)]
