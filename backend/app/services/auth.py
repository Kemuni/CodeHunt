import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import (
    AccountConflictError,
    AuthenticationRequiredError,
    GitHubUnavailableError,
    VerifiedEmailRequiredError,
)
from app.models import AuthSession, User
from app.schemas.auth import AuthUser, LoginResult

SESSION_LIFETIME = timedelta(hours=24)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def github_identity(access_token: str) -> tuple[int, str, list[str]]:
    if not settings.GITHUB_ID or not settings.GITHUB_SECRET:
        raise GitHubUnavailableError()
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    try:
        async with httpx.AsyncClient(
            base_url="https://api.github.com", headers=headers, timeout=10
        ) as client:
            # Проверяем принадлежность токена именно нашему OAuth-приложению.
            response = await client.post(
                f"/applications/{settings.GITHUB_ID}/token",
                auth=(settings.GITHUB_ID, settings.GITHUB_SECRET.get_secret_value()),
                json={"access_token": access_token},
            )
            if response.status_code in (401, 404, 422):
                raise AuthenticationRequiredError()
            response.raise_for_status()
            github_id = int(response.json()["user"]["id"])
            emails = []
            page = 1
            while True:
                response = await client.get(
                    "/user/emails",
                    params={"per_page": 100, "page": page},
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if response.status_code == 401:
                    raise AuthenticationRequiredError()
                response.raise_for_status()
                batch = response.json()
                emails.extend(item for item in batch if item["verified"] is True)
                if len(batch) < 100:
                    break
                page += 1
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise GitHubUnavailableError() from None
    if not emails:
        raise VerifiedEmailRequiredError()
    primary = next((item for item in emails if item["primary"]), emails[0])
    return (
        github_id,
        primary["email"].strip().casefold(),
        sorted({item["email"].strip().casefold() for item in emails}),
    )


def is_admin(user: User) -> bool:
    return user.github_id is not None and bool(
        settings.admin_emails.intersection(user.verified_emails)
    )


async def login(db: AsyncSession, access_token: str) -> LoginResult:
    github_id, email, verified_emails = await github_identity(access_token)
    user = await db.scalar(
        select(User).where(User.github_id == github_id).with_for_update()
    )
    if user is None:
        # Не объединяем аккаунты по email: идентификатор GitHub остаётся постоянным.
        user = User(github_id=github_id)
        db.add(user)
    user.email = email
    user.verified_emails = verified_emails
    user.is_admin = is_admin(user)
    now = datetime.now(UTC)
    user.last_login = now
    token = secrets.token_urlsafe(32)
    expires_at = now + SESSION_LIFETIME
    try:
        await db.flush()
        await db.execute(
            delete(AuthSession).where(AuthSession.expires_at <= func.now())
        )
        db.add(
            AuthSession(
                token_hash=token_hash(token), user_id=user.id, expires_at=expires_at
            )
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AccountConflictError() from None
    return LoginResult(
        token=token, expires_at=expires_at, user=AuthUser.model_validate(user)
    )


async def authenticate(db: AsyncSession, token: str) -> User:
    user = await db.scalar(
        select(User)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(
            AuthSession.token_hash == token_hash(token),
            AuthSession.expires_at > func.now(),
        )
    )
    if user is None:
        raise AuthenticationRequiredError()
    # Изменение allowlist действует и на уже открытые сессии.
    user.is_admin = is_admin(user)
    return user


async def logout(db: AsyncSession, token: str) -> None:
    await db.execute(
        delete(AuthSession).where(AuthSession.token_hash == token_hash(token))
    )
    await db.commit()
