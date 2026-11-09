import asyncio

import pytest

from tests.conftest import make_project, publish_task, save_task, task_data, task_write

pytestmark = pytest.mark.anyio


async def test_category_tree_and_template_lifecycle(client):
    root = (
        await client.post(
            "/api/task-complication-categories",
            json={"title": "Функции", "developer_type": "frontend"},
        )
    ).json()["data"]
    child = (
        await client.post(
            "/api/task-complication-categories",
            json={
                "title": "Дочерняя",
                "developer_type": "frontend",
                "parent_id": root["id"],
            },
        )
    ).json()["data"]
    tree = (await client.get("/api/task-complications/library")).json()["data"]
    assert tree[0]["categories"][0]["children"][0]["id"] == child["id"]
    assert (
        await client.patch(
            f"/api/task-complication-categories/{root['id']}",
            json={"parent_id": child["id"]},
        )
    ).status_code == 422
    assert (
        await client.delete(f"/api/task-complication-categories/{root['id']}")
    ).status_code == 409
    template = (
        await client.post(
            "/api/task-complications",
            json={
                "category_id": child["id"],
                "title": "Пагинация",
                "description": "Список страниц",
            },
        )
    ).json()["data"]
    assert "slug" not in template
    assert (
        await client.patch(
            f"/api/task-complications/{template['id']}", json={"slug": "obsolete"}
        )
    ).status_code == 422
    task, _, _ = await make_project(client, published=False)
    base = f"/api/editor/tasks/{task['id']}"
    body = task_write((await client.get(base)).json()["data"])
    body["items"][0]["complication_id"] = template["id"]
    assert (await client.put(base, json=body)).status_code == 200
    assert (
        await client.patch(
            f"/api/task-complications/{template['id']}", json={"title": "Другой"}
        )
    ).status_code == 409
    assert (
        await client.delete(f"/api/task-complications/{template['id']}")
    ).status_code == 409
    body["items"][0]["complication_id"] = None
    assert (await client.put(base, json=body)).status_code == 200
    assert (
        await client.patch(
            f"/api/task-complications/{template['id']}",
            json={"title": "Другой", "category_id": root["id"]},
        )
    ).status_code == 200
    assert (
        await client.delete(f"/api/task-complications/{template['id']}")
    ).status_code == 200
    assert (
        await client.delete(f"/api/task-complication-categories/{child['id']}")
    ).status_code == 200
    assert (
        await client.delete(f"/api/task-complication-categories/{root['id']}")
    ).status_code == 200


async def test_tasks_presets_filters_and_atomic_edits(client):
    task, links, presets = await make_project(client, published=False)
    tid = task["id"]
    base = f"/api/editor/tasks/{tid}"
    assert (await client.get(f"/api/tasks/by-slug/{task['slug']}")).status_code == 404
    levels = (await client.get(f"{base}/presets")).json()["data"]
    for preset, link in zip(presets, links, strict=True):
        section = levels[preset["level"]]
        assert section["preset"] == preset
        assert [item["id"] for item in section["complications"]] == [link["id"]]
    body = task_write((await client.get(base)).json()["data"])
    body["title"] = "Обновлённый каталог"
    body["presets"][0]["average_days_to_complete"] = 3
    body["items"][0]["title"] = "Новое требование"
    saved = await client.put(base, json=body)
    assert saved.status_code == 200, saved.text
    assert saved.json()["data"]["presets"]["easy"]["preset"]["id"] == presets[0]["id"]
    assert (
        saved.json()["data"]["presets"]["easy"]["complications"][0]["id"]
        == links[0]["id"]
    )
    assert (await client.patch(base, json={"status": "published"})).status_code == 200
    assert (await client.get(f"/api/tasks/by-slug/{task['slug']}")).json()["data"][
        "title"
    ] == body["title"]
    for query, total in [
        ("", 1),
        ("?q=Обновлённый", 1),
        ("?q=missing", 0),
        ("?developer_type=fullstack", 0),
        ("?level=high", 1),
        ("?difficulty_min=1&difficulty_max=9", 1),
    ]:
        assert (await client.get("/api/tasks" + query)).json()["data"]["total"] == total
    assert (
        await client.get("/api/tasks?difficulty_min=9&difficulty_max=1")
    ).status_code == 422
    assert (await client.delete(base)).status_code == 409
    assert (await client.patch(base, json={"title": None})).status_code == 422
    assert (await client.patch(base, json={"is_hidden": True})).status_code == 200
    assert (await client.get(f"/api/tasks/by-slug/{task['slug']}")).status_code == 404
    assert (await client.get("/api/editor/tasks?is_hidden=true")).json()["data"][
        "total"
    ] == 1
    assert (await client.patch(base, json={"status": "archived"})).status_code == 200
    assert (await client.delete(base)).status_code == 200


async def test_missing_low_preset_and_competing_parent_changes(client):
    task, links, _ = await make_project(client, published=False)
    base = f"/api/editor/tasks/{task['id']}"
    body = task_write((await client.get(base)).json()["data"])
    await save_task(client, base, presets=body["presets"][1:])
    levels = (await client.get(f"{base}/presets")).json()["data"]
    assert levels["easy"]["preset"] is None
    assert levels["easy"]["complications"][0]["id"] == links[0]["id"]
    assert [item["id"] for item in levels["medium"]["complications"]] == [
        links[1]["id"]
    ]
    other = (await publish_task(client, json=task_data("other"))).json()["data"]
    replies = await asyncio.gather(
        client.patch(base, json={"parent_task_id": other["id"]}),
        client.patch(
            f"/api/editor/tasks/{other['id']}", json={"parent_task_id": task["id"]}
        ),
    )
    assert sorted(r.status_code for r in replies) == [200, 422]


async def test_existing_api_contract(client):
    assert (await client.get("/api/health-check/")).json() == {"status": "ok"}
    candidate = await client.post(
        "/api/contact-request/candidate",
        json={"name": "Test", "email": "test@example.com"},
    )
    assert (
        candidate.status_code == 200 and candidate.json()["data"]["role"] == "candidate"
    )
    employer = await client.post(
        "/api/contact-request/employer",
        json={
            "name": "Test",
            "email": "hr@example.com",
            "company": "Test",
            "telegram": "@test",
        },
    )
    assert employer.status_code == 200 and employer.json()["data"]["role"] == "employer"
    assert (
        await client.post(
            "/api/contact-request/employer",
            json={
                "name": "Test",
                "email": "hr@example.com",
                "company": "Test",
                "telegram": "test",
            },
        )
    ).status_code == 422
    assert (await client.get("/missing-route")).json()["success"] is False
