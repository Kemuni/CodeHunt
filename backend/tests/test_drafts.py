import asyncio

import pytest

from tests.conftest import add_draft_photo, publish_task, task_data

pytestmark = pytest.mark.anyio


async def test_owner_admin_and_live_errors(client):
    response = await client.post(
        "/api/editor/task-drafts", json={"payload": {"title": "Начало"}}
    )
    assert response.status_code == 201, response.text
    draft = response.json()["data"]
    assert draft["owner_id"] == 1 and not draft["is_valid"]
    assert any(error["field"] == "slug" for error in draft["validation_errors"])
    url = f"/api/editor/task-drafts/{draft['id']}"
    assert (
        await client.get(url, headers={"Authorization": "Bearer test-session-3"})
    ).status_code == 404
    assert (
        await client.patch(
            url,
            headers={"Authorization": "Bearer test-session-3"},
            json={"revision": 1, "payload": {}},
        )
    ).status_code == 404
    assert (
        await client.delete(
            url + "?revision=1", headers={"Authorization": "Bearer test-session-3"}
        )
    ).status_code == 404
    assert (
        await client.post(
            url + "/publish",
            headers={"Authorization": "Bearer test-session-3"},
            json={"revision": 1},
        )
    ).status_code == 404
    assert (
        await client.get(
            "/api/editor/task-drafts",
            headers={"Authorization": "Bearer test-session-3"},
        )
    ).json()["data"]["total"] == 0
    assert (
        await client.post(
            "/api/editor/task-drafts",
            headers={"Authorization": "Bearer test-session-2"},
            json={},
        )
    ).status_code == 403
    assert (
        await client.get(url, headers={"Authorization": "Bearer test-session-999"})
    ).status_code == 401

    await add_draft_photo(draft["id"])
    response = await client.patch(url, json={"revision": 1, "payload": task_data()})
    draft = response.json()["data"]
    assert draft["revision"] == 2 and draft["is_valid"]
    unchanged = draft["updated_at"]
    assert (await publish_task(client, json=task_data())).status_code == 201
    draft = (await client.get(url)).json()["data"]
    assert draft["revision"] == 2 and draft["updated_at"] == unchanged
    assert any(error["code"] == "slug_taken" for error in draft["validation_errors"])
    listed = (await client.get("/api/editor/task-drafts")).json()["data"]["items"][0]
    assert "validation_errors" not in listed and "payload" not in listed
    assert listed["id"] == draft["id"] and listed["revision"] == draft["revision"]
    response = await client.post(url + "/publish", json={"revision": 2})
    assert response.status_code == 422
    assert response.json()["errors"]["details"][0]["field"] == "slug"
    assert (await client.get(url)).status_code == 200

    assert (
        await client.patch(url, json={"revision": 1, "payload": {}})
    ).status_code == 409
    assert (
        await client.post(url + "/publish", json={"revision": 1})
    ).status_code == 409
    response = await client.patch(
        url, json={"revision": 2, "payload": {"slug": "free-slug"}}
    )
    assert response.json()["data"]["is_valid"]
    response = await client.post(url + "/publish", json={"revision": 3})
    assert response.status_code == 201, response.text
    assert response.json()["data"]["is_hidden"] is False
    assert (await client.get(url)).status_code == 404
    assert (
        await client.post(url + "/publish", json={"revision": 3})
    ).status_code == 404


async def test_invalid_draft_saved_not_published_and_parent_changes(client):
    parent = (await publish_task(client, json=task_data("parent"))).json()["data"]
    response = await client.post(
        "/api/editor/task-drafts",
        json={"payload": {**task_data(), "parent_task_id": parent["id"]}},
    )
    draft = response.json()["data"]
    assert not draft["is_valid"]
    await add_draft_photo(draft["id"])
    url = f"/api/editor/task-drafts/{draft['id']}"
    await client.patch(f"/api/editor/tasks/{parent['id']}", json={"is_hidden": True})
    await client.delete(f"/api/editor/tasks/{parent['id']}")
    assert (await client.get(url)).json()["data"]["validation_errors"][0][
        "code"
    ] == "parent_not_found"
    updated = await client.patch(
        url,
        json={
            "revision": 1,
            "payload": {"parent_task_id": None, "difficulty_from": 12, "title": None},
        },
    )
    assert updated.status_code == 200
    assert not updated.json()["data"]["is_valid"]
    assert (
        await client.post(url + "/publish", json={"revision": 2})
    ).status_code == 422
    assert (
        await client.post("/api/editor/task-drafts", json={"payload": {"owner_id": 3}})
    ).status_code == 422
    assert (
        await client.post(
            "/api/editor/task-drafts", json={"payload": {"title": "x" * 256001}}
        )
    ).status_code == 422
    assert (await client.delete(url + "?revision=2")).status_code == 200


async def test_concurrent_draft_revision_and_publication(client):
    draft = (await client.post("/api/editor/task-drafts", json={})).json()["data"]
    url = f"/api/editor/task-drafts/{draft['id']}"
    replies = await asyncio.gather(
        *[
            client.patch(
                url, json={"revision": 1, "payload": task_data(f"project-{i}")}
            )
            for i in range(2)
        ]
    )
    assert sorted(r.status_code for r in replies) == [200, 409]
    await add_draft_photo(draft["id"])
    replies = await asyncio.gather(
        *[client.post(url + "/publish", json={"revision": 2}) for _ in range(2)]
    )
    assert sorted(r.status_code for r in replies) == [201, 404]
