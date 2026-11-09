import asyncio

import pytest

from tests.conftest import composition_data, make_project, save_task, task_write

pytestmark = pytest.mark.anyio


async def test_solution_snapshots_and_independent_completion(client):
    task, links, presets = await make_project(client)
    tid = task["id"]
    member = {"Authorization": "Bearer test-session-2"}
    payload = {
        "author_id": 2,
        "task_level_preset_id": presets[1]["id"],
        "excluded_complication_link_ids": [links[0]["id"]],
    }
    response = await client.post(
        f"/api/tasks/{tid}/solutions", json=payload, headers=member
    )
    assert response.status_code == 201, response.text
    solution = response.json()["data"]
    sid = solution["id"]
    url = f"/api/solutions/{sid}"
    assert (
        solution["description"] == ""
        and solution["github_link"] is None
        and solution["difficulty_rating"] is None
    )
    assert solution["status"] == "in_progress" and solution["total_count"] == 1
    copied = solution["complications"][0]
    assert copied["original_complication_link_id"] == links[1]["id"]
    assert (
        await client.post(f"/api/tasks/{tid}/solutions", json=payload, headers=member)
    ).status_code == 201
    assert (await client.get(url)).status_code == 404
    assert (
        await client.get(
            f"/api/solutions?task_id={tid}&author_id=2&status=in_progress",
            headers=member,
        )
    ).json()["data"]["total"] == 2
    await client.patch(
        f"/api/editor/tasks/{tid}", json={"full_description": "Новая постановка"}
    )
    base = f"/api/editor/tasks/{tid}"
    body = task_write((await client.get(base)).json()["data"])
    body["items"][1]["description"] = "Новое требование"
    assert (await client.put(base, json=body)).status_code == 200
    current = (await client.get(url, headers=member)).json()["data"]
    assert current["task_description_snapshot"] == task["full_description"]
    assert current["complications"][0]["description"] == links[1]["description"]
    assert (
        await client.patch(
            url,
            headers=member,
            json={
                "description": "Мой подход",
                "github_link": "https://github.com/example/project",
                "difficulty_rating": 0,
            },
        )
    ).status_code == 200
    assert (
        await client.patch(
            url, headers=member, json={"difficulty_rating": 10, "github_link": None}
        )
    ).status_code == 200
    assert (
        await client.patch(url, headers=member, json={"difficulty_rating": 11})
    ).status_code == 422
    assert (
        await client.patch(url, headers=member, json={"status": "completed"})
    ).status_code == 422
    complete = (await client.put(url + "/completion", headers=member)).json()["data"]
    assert complete["status"] == "completed" and complete["resolved_at"]
    again = (await client.put(url + "/completion", headers=member)).json()["data"]
    assert again["resolved_at"] == complete["resolved_at"]
    assert (await client.get(url, headers=member)).json()["data"][
        "completed_count"
    ] == 0
    assert (await client.delete(url + "/completion", headers=member)).json()["data"][
        "status"
    ] == "in_progress"

    custom = (
        await client.post(
            url + "/complications",
            headers=member,
            json={"title": "Моя особенность", "description": "Что я сделал"},
        )
    ).json()["data"]
    assert custom["original_complication_link_id"] is None
    custom_url = url + f"/complications/{custom['id']}"
    assert (await client.get(custom_url, headers=member)).status_code == 200
    assert (
        await client.patch(
            custom_url,
            headers=member,
            json={
                "implementation_description": "Реализовал через события",
                "acceptance_criteria": "Проверено",
            },
        )
    ).status_code == 200
    for point in [copied, custom]:
        point_url = url + f"/complications/{point['id']}/completion"
        first = (await client.put(point_url, headers=member)).json()["data"]
        second = (await client.put(point_url, headers=member)).json()["data"]
        assert first["resolved_at"] == second["resolved_at"]
    current = (await client.get(url, headers=member)).json()["data"]
    assert current["completed_count"] == current["total_count"] == 2
    assert current["status"] == "in_progress"
    assert (await client.delete(custom_url + "/completion", headers=member)).json()[
        "data"
    ]["resolved_at"] is None
    assert (
        await client.put(
            url + "/complications/order",
            headers=member,
            json={"ids": [custom["id"], copied["id"]]},
        )
    ).status_code == 200
    assert (await client.get(url + "/complications", headers=member)).json()["data"][0][
        "id"
    ] == custom["id"]
    assert (await client.delete(custom_url, headers=member)).status_code == 200
    assert (
        await save_task(
            client, base, presets=[p for p in body["presets"] if p["level"] != "medium"]
        )
    ).status_code == 409
    assert (
        await save_task(
            client, base, items=[p for p in body["items"] if p["id"] != links[1]["id"]]
        )
    ).status_code == 409
    assert (await client.delete(url, headers=member)).status_code == 200
    assert (await client.get(url, headers=member)).status_code == 404


async def test_solution_exclusions_ownership_and_atomicity(client):
    task, links, presets = await make_project(client)
    other, _, other_presets = await make_project(client, "other")
    url = f"/api/tasks/{task['id']}/solutions"
    payload = {"author_id": 1, "task_level_preset_id": presets[0]["id"]}
    assert (await client.post(url, json={**payload, "author_id": 2})).status_code == 403
    assert (
        await client.post(
            url, json={**payload, "task_level_preset_id": other_presets[0]["id"]}
        )
    ).status_code == 404
    assert (
        await client.post(
            url, json={**payload, "excluded_complication_link_ids": [links[1]["id"]]}
        )
    ).status_code == 422
    assert (
        await client.post(
            url,
            json={**payload, "excluded_complication_link_ids": [links[0]["id"]] * 2},
        )
    ).status_code == 422
    assert (await client.get("/api/solutions")).json()["data"]["total"] == 0
    reply = await client.post(
        url, json={**payload, "excluded_complication_link_ids": [links[0]["id"]]}
    )
    assert reply.status_code == 201
    solution = reply.json()["data"]
    assert solution["total_count"] == solution["completed_count"] == 0
    assert solution["status"] == "in_progress"
    sid = solution["id"]
    assert (
        await client.post(
            f"/api/solutions/{sid}/complications",
            json={
                "title": "X",
                "description": "X",
                "original_complication_link_id": links[0]["id"],
            },
        )
    ).status_code == 422
    assert (
        await client.patch(f"/api/solutions/{sid}", json={"task_id": other["id"]})
    ).status_code == 422
    replies = await asyncio.gather(
        *[client.put(f"/api/solutions/{sid}/completion") for _ in range(2)]
    )
    assert len({response.json()["data"]["resolved_at"] for response in replies}) == 1
    await client.patch(f"/api/editor/tasks/{task['id']}", json={"status": "archived"})
    assert (await client.post(url, json=payload)).status_code == 404
    assert (await client.get(f"/api/solutions/{sid}")).status_code == 200


async def test_source_delete_rollback_with_existing_solution(client):
    task, _, presets = await make_project(client)
    await client.post(
        f"/api/tasks/{task['id']}/solutions",
        json={"author_id": 1, "task_level_preset_id": presets[0]["id"]},
    )
    await client.patch(f"/api/editor/tasks/{task['id']}", json={"status": "archived"})
    assert (await client.delete(f"/api/editor/tasks/{task['id']}")).status_code == 409
    assert (
        len(
            composition_data(
                (await client.get(f"/api/editor/tasks/{task['id']}")).json()["data"]
            )
        )
        == 3
    )
