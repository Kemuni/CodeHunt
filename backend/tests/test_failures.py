import asyncio
from http import HTTPStatus

import pytest
from sqlalchemy import func, select

from app.core.errors import DomainError
from app.main import app
from app.models import TaskSolution, TaskSolutionComplication
from app.services import solutions
from app.services.storage import get_storage
from tests.conftest import make_project, task_data
from tests.test_resources import MemoryStorage

pytestmark = pytest.mark.anyio


class SimulatedFailure(DomainError):
    status = HTTPStatus.SERVICE_UNAVAILABLE
    code = "test_failure"
    default_message = "Имитируем сбой до завершения транзакции"


async def test_non_positive_identifiers_are_validation_errors(client):
    invalid_id = -1
    for path in [
        f"/api/task-complication-categories?parent_id={invalid_id}",
        f"/api/task-complications?category_id={invalid_id}",
        f"/api/tasks?parent_task_id={invalid_id}",
        f"/api/solutions?task_id={invalid_id}",
        f"/api/solutions?author_id={invalid_id}",
        f"/api/tasks/{invalid_id}",
    ]:
        assert (await client.get(path)).status_code == 422
    assert (
        await client.get(
            "/api/editor/tasks",
            headers={"Authorization": f"Bearer test-session-{invalid_id}"},
        )
    ).status_code == 401


async def test_atomic_solution_rollback(client, db, monkeypatch):
    task, _, presets = await make_project(client)

    async def fail_commit(session, _obj):
        await session.flush()
        raise SimulatedFailure()

    monkeypatch.setattr(solutions, "commit", fail_commit)
    result = await client.post(
        f"/api/tasks/{task['id']}/solutions",
        json={"author_id": 1, "task_level_preset_id": presets[2]["id"]},
    )
    assert result.status_code == 503
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(TaskSolution)) == 0
        assert (
            await session.scalar(
                select(func.count()).select_from(TaskSolutionComplication)
            )
            == 0
        )


async def test_resource_compensation_on_database_failure(client, monkeypatch):
    from app.services import resources

    task = (await client.post("/api/editor/tasks", json=task_data())).json()["data"]
    store = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: store

    async def fail_commit(_session):
        raise SimulatedFailure("Имитируем сбой базы данных")

    monkeypatch.setattr(resources, "commit", fail_commit)
    url = f"/api/editor/tasks/{task['id']}/resources"
    response = await client.post(
        url,
        data={"title": "Файл", "type": "other"},
        files={"file": ("file.txt", b"content")},
    )
    assert response.status_code == 503 and not store.objects
    assert (await client.get(url)).json()["data"] == []


async def test_competing_drafts_keep_loser_and_live_parent_validation(client):
    draft_ids = []
    for _ in range(2):
        response = await client.post(
            "/api/editor/task-drafts", json={"payload": task_data()}
        )
        draft_ids.append(response.json()["data"]["id"])
    replies = await asyncio.gather(
        *[
            client.post(f"/api/editor/task-drafts/{did}/publish", json={"revision": 1})
            for did in draft_ids
        ]
    )
    assert sorted(reply.status_code for reply in replies) in ([201, 422], [201, 409])
    listing = (await client.get("/api/editor/task-drafts")).json()["data"]
    assert listing["total"] == 1
    assert listing["items"][0]["validation_errors"][0]["code"] == "slug_taken"
    response = await client.post(
        "/api/editor/task-drafts",
        json={"payload": {**task_data("another"), "parent_task_id": "99999"}},
    )
    assert response.status_code == 201
    assert response.json()["data"]["validation_errors"][0]["code"] == "parent_not_found"
    response = await client.post(
        "/api/editor/task-drafts", json={"payload": {"parent_task_id": "invalid-id"}}
    )
    assert response.status_code == 201 and not response.json()["data"]["is_valid"]
