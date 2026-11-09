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
    task, _, _ = await make_project(client, hidden=True)
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
    task, links, presets = await make_project(client, hidden=True)
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
    assert (await client.patch(base, json={"is_hidden": False})).status_code == 200
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
    assert (await client.patch(base, json={"title": None})).status_code == 422
    assert (await client.patch(base, json={"is_hidden": True})).status_code == 200
    assert (await client.get(f"/api/tasks/by-slug/{task['slug']}")).status_code == 404
    assert (await client.get("/api/editor/tasks?is_hidden=true")).json()["data"][
        "total"
    ] == 1
    assert (await client.patch(base, json={"is_hidden": True})).status_code == 200
    assert (await client.delete(base)).status_code == 200


async def test_missing_low_preset_and_competing_parent_changes(client):
    task, links, _ = await make_project(client, hidden=True)
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


async def test_catalog_filters_sorting_and_access_editing(client):
    tasks = []
    for slug, title, direction, difficulty, paid in [
        ("alpha", "Alpha", "frontend", (1, 3), False),
        ("bravo", "Bravo", "fullstack", (5, 8), True),
        ("charlie", "Charlie", "frontend", (5, 8), True),
        ("hidden", "Hidden", "fullstack", (1, 10), True),
    ]:
        response = await publish_task(
            client,
            json={
                **task_data(slug),
                "title": title,
                "developer_type": direction,
                "difficulty_from": difficulty[0],
                "difficulty_to": difficulty[1],
                "is_paid": paid,
                "is_hidden": slug == "hidden",
            },
        )
        assert response.status_code == 201, response.text
        tasks.append(response.json()["data"])
    for path in ("/api/tasks", "/api/editor/tasks"):
        response = await client.get(
            path,
            params={
                "q": "  BRAVO ",
                "developer_type": "fullstack",
                "difficulty_min": 8,
                "difficulty_max": 9,
                "access": "subscription",
            },
        )
        assert response.status_code == 200, response.text
        assert [item["slug"] for item in response.json()["data"]["items"]] == ["bravo"]
        response = await client.get(path, params={"access": "free"})
        assert [item["slug"] for item in response.json()["data"]["items"]] == ["alpha"]
        response = await client.get(path, params={"q": "%"})
        assert response.json()["data"]["total"] == 0
        response = await client.get(
            path + "?developer_type=frontend&developer_type=fullstack"
        )
        assert response.json()["data"]["total"] == (3 if path == "/api/tasks" else 4)
        for params in (
            {"sort": "invalid"},
            {"access": "invalid"},
            {"difficulty_min": 8, "difficulty_max": 2},
            {"difficulty_max": 11},
        ):
            assert (await client.get(path, params=params)).status_code == 422
    for sort, expected in [
        ("oldest", ["alpha", "bravo", "charlie"]),
        ("newest", ["charlie", "bravo", "alpha"]),
        ("title", ["alpha", "bravo", "charlie"]),
        ("difficulty_asc", ["alpha", "bravo", "charlie"]),
        ("difficulty_desc", ["bravo", "charlie", "alpha"]),
    ]:
        # Проверяем стабильность страниц при одинаковой сложности и правильный total.
        for offset, slug in enumerate(expected):
            response = await client.get(
                "/api/tasks", params={"sort": sort, "limit": 1, "offset": offset}
            )
            page = response.json()["data"]
            assert page["total"] == 3
            assert [item["slug"] for item in page["items"]] == [slug]
    base = f"/api/editor/tasks/{tasks[1]['id']}"
    assert (await client.patch(base, json={"is_paid": None})).status_code == 422
    assert (await client.patch(base, json={"is_paid": False})).json()["data"][
        "is_paid"
    ] is False
    saved = await save_task(client, base, is_paid=True)
    assert saved.status_code == 200, saved.text
    assert saved.json()["data"]["is_paid"] is True
    assert (await client.get("/api/tasks/by-slug/bravo")).json()["data"][
        "is_paid"
    ] is True
    client.headers.pop("Authorization")
    assert (await client.get("/api/tasks?access=subscription")).json()["data"][
        "total"
    ] == 0
    assert (
        await client.get("/api/editor/tasks?access=subscription")
    ).status_code == 401
