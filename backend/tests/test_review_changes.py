import importlib.util
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert, inspect, select, text

from app.core import request_limits
from app.core.config import settings
from app.core.db import Base
from app.main import app
from app.models import Task
from app.schemas.domain import CompositionUpdate
from app.services import media
from app.services.media_cache import MediaCache, get_media_cache
from app.services.storage import get_storage
from tests.conftest import make_project
from tests.test_grouped_tasks import image_bytes
from tests.test_resources import MemoryStorage

pytestmark = pytest.mark.anyio


async def test_paid_tasks_are_admin_only_in_every_read_path(client, monkeypatch):
    store = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: store
    monkeypatch.setattr(media, "get_storage", lambda: store)
    task, _, presets = await make_project(client)
    base = f"/api/editor/tasks/{task['id']}"
    # Сначала пользователь получает решение бесплатной задачи.
    member = {"Authorization": "Bearer test-session-2"}
    solution = await client.post(
        f"/api/tasks/{task['id']}/solutions",
        headers=member,
        json={"author_id": 2, "task_level_preset_id": presets[0]["id"]},
    )
    assert solution.status_code == 201
    sid = solution.json()["data"]["id"]
    photo = (
        await client.post(
            base + "/photos", files={"files": ("cover.png", image_bytes(), "image/png")}
        )
    ).json()["data"][-1]
    resource = (
        await client.post(
            base + "/resources",
            data={"title": "spec", "type": "other"},
            files={"file": ("spec.txt", b"private contents", "text/plain")},
        )
    ).json()["data"]
    etags = {
        file["url"]: (await client.get(file["url"])).headers["etag"]
        for file in (photo, resource)
    }
    assert (await client.patch(base, json={"is_paid": True})).status_code == 200
    public = f"/api/tasks/by-slug/{task['slug']}"
    for headers in ({"Authorization": ""}, member):
        listing = await client.get("/api/tasks?access=subscription", headers=headers)
        assert listing.json()["data"]["total"] == 0
        assert listing.headers["cache-control"] == "no-store"
        for path in (
            public,
            public + "/presets",
            f"/api/solutions/{sid}",
            f"/api/solutions/{sid}/complications",
        ):
            assert (await client.get(path, headers=headers)).status_code in (401, 404)
        for url, etag in etags.items():
            for method in ("GET", "HEAD"):
                denied = await client.request(
                    method, url, headers={**headers, "If-None-Match": etag}
                )
                assert denied.status_code == 404
                assert denied.headers["cache-control"] == "no-store"
    assert (await client.get("/api/solutions", headers=member)).json()["data"][
        "total"
    ] == 0
    assert (
        await client.post(
            f"/api/tasks/{task['id']}/solutions",
            headers=member,
            json={"author_id": 2, "task_level_preset_id": presets[0]["id"]},
        )
    ).status_code == 404
    assert (await client.get(public)).status_code == 200
    assert (await client.get(public + "/presets")).status_code == 200
    for url, etag in etags.items():
        assert (await client.get(url)).status_code == 200
        assert (
            await client.get(url, headers={"If-None-Match": etag})
        ).status_code == 304
    # Право проверяется заново: отзыв роли запрещает и условный GET.
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")
    assert (await client.get(public)).status_code == 404
    for url, etag in etags.items():
        assert (
            await client.get(url, headers={"If-None-Match": etag})
        ).status_code == 404


async def test_large_download_streams_without_redis_or_unbounded_reads(
    client, monkeypatch
):
    from io import BytesIO

    opened = []

    class LimitedBody(BytesIO):
        def read(self, size=-1):
            assert 0 < size <= 64 * 1024
            return super().read(size)

    class Store(MemoryStorage):
        def open(self, key):
            body = LimitedBody(self.objects[key])
            opened.append(body)
            return body

    store = Store()
    app.dependency_overrides[get_storage] = lambda: store
    monkeypatch.setattr(media, "get_storage", lambda: store)
    monkeypatch.setattr(settings, "MEDIA_CACHE_MAX_BYTES", 1024)
    cache = MediaCache(None)
    cache.get = AsyncMock(
        side_effect=AssertionError("Крупный файл нельзя читать из Redis")
    )
    cache.put = AsyncMock(
        side_effect=AssertionError("Крупный файл нельзя писать в Redis")
    )
    app.dependency_overrides[get_media_cache] = lambda: cache
    task, _, _ = await make_project(client)
    body = b"data" * 40_000
    uploaded = await client.post(
        f"/api/editor/tasks/{task['id']}/resources",
        data={"title": "big", "type": "other"},
        files={"file": ("big.bin", body, "application/octet-stream")},
    )
    response = await client.get(uploaded.json()["data"]["url"])
    assert response.status_code == 200 and response.content == body
    assert opened and all(stream.closed for stream in opened)
    stream = LimitedBody(body)
    chunks = media.stream_content(stream)
    await anext(chunks)
    await chunks.aclose()
    assert stream.closed


async def test_request_limit_checks_declared_and_actual_bytes_and_validation_details(
    monkeypatch,
):
    limit = 4096
    monkeypatch.setattr(request_limits, "MAX_REQUEST_BYTES", limit)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Один предел действует на JSON и оба вида загрузок, независимо от маршрута.
        for path in (
            "/api/contact-request/candidate",
            "/api/editor/tasks/1/photos",
            "/api/editor/task-drafts/1/resources",
        ):
            oversized = await client.post(
                path, content=b"{}", headers={"Content-Length": str(limit + 1)}
            )
            assert oversized.status_code == 413
            assert oversized.headers["cache-control"] == "no-store"

        async def chunks():
            yield b" " * limit
            yield b"{}"

        # Отсутствующий или заниженный Content-Length не обходит проверку потока.
        for headers in ({}, {"Content-Length": "2"}):
            oversized = await client.post(
                "/api/contact-request/candidate",
                content=chunks(),
                headers={"Content-Type": "application/json", **headers},
            )
            assert oversized.status_code == 413
        # Ошибка обязательного поля должна сохранять его путь и машинный код.
        response = await client.post("/api/auth/github", json={})
        assert response.status_code == 422
        errors = response.json()["errors"]
        assert errors["details"][0]["field"] == "access_token"
        assert errors["details"][0]["code"] == "missing"


def test_composition_accepts_three_category_levels_and_rejects_four():
    from pydantic import ValidationError

    leaf = {
        "kind": "complication",
        "level": "easy",
        "title": "Item",
        "description": "Description",
        "acceptance_criteria": "Works",
    }
    tree = leaf
    for _ in range(3):
        tree = {"kind": "group", "level": "easy", "title": "Group", "items": [tree]}
    CompositionUpdate(items=[tree])
    with pytest.raises(ValidationError, match="трёх уровней"):
        CompositionUpdate(
            items=[
                {"kind": "group", "level": "easy", "title": "Fourth", "items": [tree]}
            ]
        )
    assert settings.MAX_PHOTO_BYTES == 5 * 1024 * 1024


def test_visibility_migration_preserves_hidden_archived_and_parent_links(sync_engine):
    path = (
        Path(__file__).parents[1]
        / "alembic/versions/72ad0e81f630_task_visibility_only.py"
    )
    spec = importlib.util.spec_from_file_location("visibility", path)
    assert spec and spec.loader
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with sync_engine.connect() as connection:
        transaction = connection.begin()
        try:
            Base.metadata.create_all(connection)
            with Operations.context(MigrationContext.configure(connection)):
                migration.downgrade()
                for id, hidden in ((1, False), (2, False), (3, True)):
                    connection.execute(
                        insert(Task).values(
                            id=id,
                            slug=f"task-{id}",
                            title="Task",
                            short_description="Short",
                            full_description="Full",
                            developer_type="frontend",
                            difficulty_from=1,
                            difficulty_to=3,
                            is_hidden=hidden,
                            parent_task_id=1 if id == 2 else None,
                        )
                    )
                connection.execute(
                    text("UPDATE tasks SET status='archived' WHERE id=2")
                )
                migration.upgrade()
                assert "status" not in {
                    column["name"]
                    for column in inspect(connection).get_columns("tasks")
                }
                assert connection.execute(
                    select(Task.id, Task.is_hidden, Task.parent_task_id).order_by(
                        Task.id
                    )
                ).all() == [(1, False, None), (2, True, 1), (3, True, None)]
        finally:
            transaction.rollback()
