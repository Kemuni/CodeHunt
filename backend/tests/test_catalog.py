import asyncio

import pytest

from tests.conftest import make_project, task_data

pytestmark = pytest.mark.anyio


async def test_category_tree_and_template_lifecycle(client):
    category_data = {
        "title": "Функции",
        "developer_type": "frontend",
        "group": "functionality",
    }
    root = (
        await client.post("/api/task-complication-categories", json=category_data)
    ).json()["data"]
    child = (
        await client.post(
            "/api/task-complication-categories",
            json={**category_data, "parent_id": root["id"]},
        )
    ).json()["data"]
    assert (await client.get("/api/task-complication-categories")).json()["data"][
        "total"
    ] == 2
    assert (
        await client.get("/api/task-complication-categories?roots_only=true")
    ).json()["data"]["total"] == 1
    assert (
        await client.get(f"/api/task-complication-categories?parent_id={root['id']}")
    ).json()["data"]["items"][0]["id"] == child["id"]
    assert (
        await client.get(
            "/api/task-complication-categories?roots_only=false&developer_type=frontend&group=functionality"
        )
    ).json()["data"]["total"] == 2
    assert (
        await client.get(
            "/api/task-complication-categories?roots_only=true&parent_id=1"
        )
    ).status_code == 422
    assert (
        await client.patch(
            f"/api/task-complication-categories/{root['id']}",
            json={"parent_id": child["id"]},
        )
    ).status_code == 422
    assert (
        await client.patch(
            f"/api/task-complication-categories/{root['id']}",
            json={"parent_id": root["id"]},
        )
    ).status_code == 422
    assert (
        await client.get(f"/api/task-complication-categories/{root['id']}")
    ).status_code == 200
    assert (
        await client.get("/api/task-complication-categories/9999")
    ).status_code == 404
    assert (
        await client.delete(f"/api/task-complication-categories/{root['id']}")
    ).status_code == 409
    assert (
        await client.patch(
            f"/api/task-complication-categories/{child['id']}",
            json={"title": "Категория"},
        )
    ).status_code == 200
    template_data = {
        "category_id": child["id"],
        "slug": "pagination",
        "title": "Пагинация",
        "description": "Общая идея для автора",
    }
    template = (
        await client.post("/api/task-complications", json=template_data)
    ).json()["data"]
    assert (
        await client.post("/api/task-complications", json=template_data)
    ).status_code == 409
    assert (
        await client.get(f"/api/task-complications/{template['id']}")
    ).status_code == 200
    assert (
        await client.get(
            f"/api/task-complications?q=Пагинация&category_id={child['id']}&developer_type=frontend&group=functionality"
        )
    ).json()["data"]["total"] == 1
    assert (
        await client.patch(
            f"/api/task-complications/{template['id']}",
            json={"description": "Исправление", "category_id": root["id"]},
        )
    ).status_code == 200
    task, links, _ = await make_project(client, published=False)
    base = f"/api/editor/tasks/{task['id']}"
    for link in links[:2]:
        assert (
            await client.patch(
                f"{base}/complications/{link['id']}",
                json={"complication_id": template["id"]},
            )
        ).status_code == 200
    assert (
        await client.patch(
            f"/api/task-complications/{template['id']}",
            json={"description": "Уже другая идея"},
        )
    ).status_code == 409
    assert (
        await client.delete(f"/api/task-complications/{template['id']}")
    ).status_code == 409
    assert (
        await client.patch(
            f"{base}/complications/{links[0]['id']}",
            json={"description": "Новый смысл"},
        )
    ).status_code == 422
    assert (
        await client.patch(
            f"{base}/complications/{links[0]['id']}",
            json={"description": "Новый смысл", "complication_id": None},
        )
    ).status_code == 200
    await client.patch(
        f"{base}/complications/{links[1]['id']}", json={"complication_id": None}
    )
    assert (
        await client.delete(f"/api/task-complications/{template['id']}")
    ).status_code == 200
    assert (
        await client.delete(f"/api/task-complication-categories/{child['id']}")
    ).status_code == 200
    assert (
        await client.delete(f"/api/task-complication-categories/{root['id']}")
    ).status_code == 200


async def test_tasks_presets_filters_and_partial_edits(client):
    task, links, presets = await make_project(client, published=False)
    tid = task["id"]
    base = f"/api/editor/tasks/{tid}"
    assert (await client.get(f"/api/tasks/{tid}")).status_code == 404
    assert (await client.get("/api/tasks/by-slug/movie-catalog")).status_code == 404
    assert (await client.get(base)).status_code == 200
    assert (await client.get("/api/editor/tasks?status=draft")).json()["data"][
        "total"
    ] == 1
    assert (await client.get(f"{base}/complications")).json()["data"][0]["id"] == links[
        0
    ]["id"]
    assert (
        await client.get(f"{base}/complications/{links[0]['id']}")
    ).status_code == 200
    assert (await client.get(f"{base}/presets")).status_code == 200
    assert (await client.get(f"{base}/presets/{presets[0]['id']}")).status_code == 200
    for index, preset in enumerate(presets):
        config = (
            await client.get(f"{base}/presets/{preset['id']}/configuration")
        ).json()["data"]
        assert [link["id"] for link in config["complications"]] == [
            link["id"] for link in links[: index + 1]
        ]
    assert (await client.patch(base, json={"difficulty_from": 11})).status_code == 422
    assert (await client.patch(base, json={"title": None})).status_code == 422
    assert (
        await client.patch(base, json={"difficulty_from": 8, "difficulty_to": 2})
    ).status_code == 422
    assert (
        await client.patch(
            base,
            json={
                "design_author_name": "Автор",
                "design_author_link": "https://example.com",
            },
        )
    ).status_code == 200
    assert (
        await client.patch(
            base, json={"design_author_name": None, "design_author_link": None}
        )
    ).json()["data"]["design_author_name"] is None
    assert (
        await client.patch(
            f"{base}/presets/{presets[0]['id']}", json={"average_days_to_complete": 3}
        )
    ).status_code == 200
    assert (
        await client.post(
            f"{base}/presets", json={"level": "easy", "description": "Дубликат"}
        )
    ).status_code == 409
    assert (await client.patch(base, json={"status": "published"})).status_code == 200
    assert (await client.get(f"/api/tasks/{tid}")).status_code == 200
    assert (await client.get("/api/tasks/by-slug/movie-catalog")).status_code == 200
    assert (await client.get(f"/api/tasks/{tid}/presets")).status_code == 200
    assert (
        len(
            (
                await client.get(
                    f"/api/tasks/{tid}/presets/{presets[2]['id']}/configuration"
                )
            ).json()["data"]["complications"]
        )
        == 3
    )
    assert (
        await client.get(
            "/api/tasks?q=Каталог&level=medium&developer_type=frontend&difficulty_min=0&difficulty_max=10"
        )
    ).json()["data"]["total"] == 1
    assert (await client.get("/api/tasks?difficulty_min=11")).status_code == 422
    assert (
        await client.get("/api/tasks?difficulty_min=8&difficulty_max=1")
    ).status_code == 422
    assert (await client.delete(base)).status_code == 409
    assert (
        await client.delete(f"{base}/complications/{links[0]['id']}")
    ).status_code == 422
    assert (
        await client.get(f"{base}/complications/{links[0]['id']}")
    ).status_code == 200

    other = (
        await client.post(
            "/api/editor/tasks",
            json={
                **task_data("child"),
                "parent_task_id": tid,
                "developer_type": "fullstack",
            },
        )
    ).json()["data"]
    assert (
        await client.patch(base, json={"parent_task_id": other["id"]})
    ).status_code == 422
    assert (await client.get(f"/api/tasks?parent_task_id={tid}")).json()["data"][
        "total"
    ] == 0
    copy = await client.post(
        f"/api/editor/tasks/{other['id']}/complications/copy",
        json={"source_link_id": links[0]["id"], "title": "Копия"},
    )
    assert copy.status_code == 201
    assert copy.json()["data"]["description"] == links[0]["description"]
    assert (
        await client.patch(
            f"/api/editor/tasks/{other['id']}/complications/{links[0]['id']}",
            json={"title": "Чужой"},
        )
    ).status_code == 404
    assert (await client.delete(f"/api/editor/tasks/{other['id']}")).status_code == 200
    reversed_ids = [link["id"] for link in reversed(links)]
    assert (
        await client.put(base + "/complications/order", json={"ids": reversed_ids})
    ).status_code == 200
    assert (
        await client.put(
            base + "/complications/order", json={"ids": [links[0]["id"]] * 3}
        )
    ).status_code == 422
    assert (await client.patch(base, json={"status": "draft"})).status_code == 200
    for preset in presets:
        assert (
            await client.delete(f"{base}/presets/{preset['id']}")
        ).status_code == 200
    assert (await client.patch(base, json={"status": "published"})).status_code == 422
    for link in links:
        assert (
            await client.delete(f"{base}/complications/{link['id']}")
        ).status_code == 200
    assert (await client.delete(base)).status_code == 200


async def test_missing_low_preset_and_competing_parent_changes(client):
    task, links, presets = await make_project(client, published=False)
    base = f"/api/editor/tasks/{task['id']}"
    await client.delete(f"{base}/presets/{presets[0]['id']}")
    config = (
        await client.get(f"{base}/presets/{presets[1]['id']}/configuration")
    ).json()["data"]
    assert links[0]["id"] in [item["id"] for item in config["complications"]]
    other = (await client.post("/api/editor/tasks", json=task_data("other"))).json()[
        "data"
    ]
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
