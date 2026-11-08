from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models import AuthSession, User
from app.services import auth


@pytest.fixture
def github(monkeypatch):
    state: dict[str, Any] = {
        "id": 42,
        "emails": [
            {"email": "member@github.test", "verified": True, "primary": True},
            {"email": "ADMIN@EXAMPLE.COM", "verified": True, "primary": False},
        ],
        "status": 200,
        "calls": [],
    }

    def handle(request):
        state["calls"].append(request)
        if request.url.path == "/applications/test-client/token":
            assert request.headers["authorization"].startswith("Basic ")
            return httpx.Response(state["status"], json={"user": {"id": state["id"]}})
        assert request.url.path == "/user/emails"
        assert request.headers["authorization"] == "Bearer github-token"
        return httpx.Response(200, json=state["emails"])

    original = httpx.AsyncClient
    monkeypatch.setattr(
        auth.httpx,
        "AsyncClient",
        lambda **kw: original(transport=httpx.MockTransport(handle), **kw),
    )
    return state


async def sign_in(client):
    return await client.post("/api/auth/github", json={"access_token": "github-token"})


async def test_github_verified_private_email_identity_and_roles(
    client, db, github, monkeypatch
):
    reply = await sign_in(client)
    assert reply.status_code == 200, reply.text
    assert reply.headers["cache-control"] == "no-store"
    data = reply.json()["data"]
    assert data["user"]["is_admin"]
    assert data["user"]["email"] == "member@github.test"
    credentials = {"Authorization": f"Bearer {data['token']}"}
    async with db() as session:
        saved = await session.get(AuthSession, auth.token_hash(data["token"]))
        assert saved and saved.token_hash != data["token"]
        user = await session.get(User, data["user"]["id"])
        assert user.github_id == 42
        assert user.last_login is not None
    assert (
        await client.get("/api/editor/tasks", headers=credentials)
    ).status_code == 200
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")
    assert (
        await client.get("/api/editor/tasks", headers=credentials)
    ).status_code == 403
    assert not (await client.get("/api/auth/me", headers=credentials)).json()["data"][
        "is_admin"
    ]
    github["emails"] = [
        {"email": "renamed@github.test", "verified": True, "primary": True}
    ]
    again = (await sign_in(client)).json()["data"]
    assert again["user"]["id"] == data["user"]["id"]
    assert again["user"]["email"] == "renamed@github.test"
    assert not again["user"]["is_admin"]
    assert (
        await client.post("/api/auth/logout", headers=credentials)
    ).status_code == 200
    assert (await client.get("/api/auth/me", headers=credentials)).status_code == 401
    # Выход отзывает только текущую сессию.
    assert (
        await client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {again['token']}"}
        )
    ).status_code == 200


async def test_unverified_admin_email_does_not_grant_access(client, github):
    github["emails"][1]["verified"] = False
    data = (await sign_in(client)).json()["data"]
    assert not data["user"]["is_admin"]
    assert (
        await client.get(
            "/api/editor/tasks", headers={"Authorization": f"Bearer {data['token']}"}
        )
    ).status_code == 403
    github["emails"][0]["verified"] = False
    assert (await sign_in(client)).status_code == 403


@pytest.mark.parametrize(
    "status,expected", [(401, 401), (404, 401), (422, 401), (403, 503), (500, 503)]
)
async def test_reject_invalid_github_tokens_and_fail_closed(
    client, github, status, expected
):
    github["status"] = status
    assert (await sign_in(client)).status_code == expected
    assert len(github["calls"]) == 1


async def test_no_header_impersonation_expired_sessions_or_legacy_admin(client, db):
    client.headers.pop("authorization")
    for headers in ({}, {"X-User-ID": "1"}, {"Authorization": "Bearer forged"}):
        assert (
            await client.get("/api/editor/tasks", headers=headers)
        ).status_code == 401
    assert (await client.get("/api/tasks")).status_code == 200
    async with db() as session:
        session_row = await session.get(AuthSession, auth.token_hash("test-session-1"))
        session_row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        legacy = await session.get(User, 3)
        legacy.github_id = None
        await session.commit()
    assert (
        await client.get(
            "/api/auth/me", headers={"Authorization": "Bearer test-session-1"}
        )
    ).status_code == 401
    assert (
        await client.get(
            "/api/editor/tasks", headers={"Authorization": "Bearer test-session-3"}
        )
    ).status_code == 403


async def test_no_automatic_link_by_email_or_client_supplied_role(client, db, github):
    github["emails"][0]["email"] = "admin@example.com"
    assert (await sign_in(client)).status_code == 409
    async with db() as session:
        assert (await session.get(User, 1)).github_id == 1
        assert await session.scalar(select(User).where(User.github_id == 42)) is None
    assert (
        await client.post(
            "/api/auth/github", json={"access_token": "github-token", "is_admin": True}
        )
    ).status_code == 422


async def test_missing_configuration(client, monkeypatch):
    monkeypatch.setattr(settings, "GITHUB_SECRET", None)
    assert (await sign_in(client)).status_code == 503
