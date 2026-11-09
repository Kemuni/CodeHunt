from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session_maker
from app.core.errors import AdminRequiredError, AuthenticationRequiredError
from app.models import User
from app.services.auth import authenticate


async def get_db() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


SessionDep = Annotated[AsyncSession, Depends(get_db)]


BearerCredentials = Annotated[
    HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))
]


async def current_user(db: SessionDep, credentials: BearerCredentials) -> User:
    if credentials is None:
        raise AuthenticationRequiredError()
    return await authenticate(db, credentials.credentials)


CurrentUser = Annotated[User, Depends(current_user)]


async def optional_user(db: SessionDep, credentials: BearerCredentials) -> User | None:
    if credentials is None:
        return None
    return await current_user(db, credentials)


OptionalUser = Annotated[User | None, Depends(optional_user)]


async def current_admin(user: CurrentUser) -> User:
    if not user.is_admin:
        raise AdminRequiredError()
    return user


CurrentAdmin = Annotated[User, Depends(current_admin)]
