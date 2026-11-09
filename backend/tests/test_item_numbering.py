from collections import Counter

import pytest
from sqlalchemy import select

from app.models import TaskComplicationLink, TaskComplicationLinkGroup
from app.services import composition
from tests.conftest import (
    add_draft_photo,
    composition_data,
    publish_task,
    save_task,
    task_data,
)

pytestmark = pytest.mark.anyio


def leaf(title, level="easy"):
    return {
        "kind": "complication",
        "title": title,
        "description": title,
        "acceptance_criteria": "Работает",
        "level": level,
    }


def group(title, items, level="easy"):
    return {"kind": "group", "title": title, "level": level, "items": items}


def leaves(items):
    return [
        leaf
        for item in items
        for leaf in (leaves(item["items"]) if item["kind"] == "group" else [item])
    ]


def writable(item):
    fields = (
        ("id", "kind", "title", "level")
        if item["kind"] == "group"
        else (
            "id",
            "kind",
            "title",
            "level",
            "description",
            "acceptance_criteria",
            "is_required",
            "complication_id",
        )
    )
    result = {key: item[key] for key in fields}
    if item["kind"] == "group":
        result["items"] = [writable(child) for child in item["items"]]
    return result


async def test_visible_numbers_computed_through_nested_composition_and_link_mutations(
    client, db
):
    payload = {
        **task_data(),
        "items": [
            leaf("Максимальный", "high"),
            group(
                "Внешняя",
                [
                    group("Средняя", [group("Глубокая", [leaf("Первый")])]),
                    leaf("Второй"),
                ],
            ),
            group("Пустая", []),
            leaf("Третий"),
            leaf("Продвинутый", "medium"),
        ],
    }
    # Проверяем нумерацию после публикации и последующих изменений дерева.
    draft = (
        await client.post("/api/editor/task-drafts", json={"payload": payload})
    ).json()["data"]
    await add_draft_photo(draft["id"])
    response = await client.post(
        f"/api/editor/task-drafts/{draft['id']}/publish",
        json={"revision": draft["revision"]},
    )
    assert response.status_code == 201, response.text
    task_id = response.json()["data"]["id"]
    task_slug = response.json()["data"]["slug"]
    base = f"/api/editor/tasks/{task_id}"

    async def check(expected):
        tree = composition_data((await client.get(base)).json()["data"])
        visible = leaves(tree)
        assert [item["title"] for item in visible] == expected
        numbers = Counter()
        for item in visible:
            numbers[item["level"]] += 1
            assert item["order_number"] == numbers[item["level"]]
        async with db() as session:
            stored = (
                await session.scalars(
                    select(TaskComplicationLink).where(
                        TaskComplicationLink.task_id == task_id
                    )
                )
            ).all()
            assert {item.id: item.position for item in stored} == {
                item["id"]: item["position"] for item in visible
            }
            assert "order_number" not in TaskComplicationLink.__table__.columns
            assert "order_number" not in TaskComplicationLinkGroup.__table__.columns
            stored_groups = (
                await session.scalars(
                    select(TaskComplicationLinkGroup).where(
                        TaskComplicationLinkGroup.task_id == task_id
                    )
                )
            ).all()

            def check_groups(items):
                for item in items:
                    if item["kind"] == "group":
                        assert "order_number" not in item
                        assert (
                            next(
                                obj.position
                                for obj in stored_groups
                                if obj.id == item["id"]
                            )
                            == item["position"]
                        )
                        check_groups(item["items"])

            check_groups(tree)
        detail = (await client.get(f"/api/tasks/by-slug/{task_slug}")).json()["data"]
        for section in detail["presets"].values():
            own_items = leaves(section["complications"])
            assert [item["order_number"] for item in own_items] == list(
                range(1, len(own_items) + 1)
            )
        presets = (await client.get(f"/api/tasks/by-slug/{task_slug}/presets")).json()[
            "data"
        ]
        assert presets == detail["presets"]
        for config in presets.values():
            for item in leaves(config["complications"]):
                assert item["order_number"] == next(
                    row["order_number"] for row in visible if row["id"] == item["id"]
                )
        return tree

    tree = await check(["Первый", "Второй", "Третий", "Продвинутый", "Максимальный"])
    edited = [writable(item) for item in tree]
    edited[0]["items"][0]["items"][0]["items"].insert(0, leaf("Новый первый"))
    assert (await save_task(client, base, items=edited)).status_code == 200
    tree = await check(
        ["Новый первый", "Первый", "Второй", "Третий", "Продвинутый", "Максимальный"]
    )
    edited = [writable(item) for item in tree]
    added = edited[0]["items"][0]["items"][0]["items"].pop(0)
    edited.insert(3, added)
    assert (await save_task(client, base, items=edited)).status_code == 200
    tree = await check(
        ["Первый", "Второй", "Третий", "Новый первый", "Продвинутый", "Максимальный"]
    )
    edited = [
        writable(item)
        for item in tree
        if item["id"] != added["id"] or item["kind"] != "complication"
    ]
    assert (await save_task(client, base, items=edited)).status_code == 200
    tree = await check(["Первый", "Второй", "Третий", "Продвинутый", "Максимальный"])
    reordered = [tree[2], tree[0], tree[1], *tree[3:]]
    assert (
        await save_task(client, base, items=[writable(item) for item in reordered])
    ).status_code == 200
    await check(["Третий", "Первый", "Второй", "Продвинутый", "Максимальный"])


async def test_sparse_positions_compute_numbers_without_writes_or_changing_solutions(
    client, db
):
    response = await publish_task(
        client,
        json={
            **task_data(),
            "items": [
                group("Группа", [leaf("Первый")]),
                leaf("Второй"),
                leaf("Средний", "medium"),
                leaf("Максимальный", "high"),
            ],
        },
    )
    assert response.status_code == 201, response.text
    task_id = response.json()["data"]["id"]
    task_slug = response.json()["data"]["slug"]
    detail = (await client.get(f"/api/tasks/by-slug/{task_slug}")).json()["data"]
    preset_id = detail["presets"]["high"]["preset"]["id"]
    solution = await client.post(
        f"/api/tasks/{task_id}/solutions",
        json={"author_id": 1, "task_level_preset_id": preset_id},
    )
    assert solution.status_code == 201, solution.text
    saved = solution.json()["data"]
    assert [link["title"] for link in saved["complications"]] == [
        "Первый",
        "Второй",
        "Средний",
        "Максимальный",
    ]

    async with db() as session:
        group_obj = (
            await session.scalars(
                select(TaskComplicationLinkGroup).where(
                    TaskComplicationLinkGroup.task_id == task_id
                )
            )
        ).one()
        group_obj.position = 100
        links = (
            await session.scalars(
                select(TaskComplicationLink).where(
                    TaskComplicationLink.task_id == task_id
                )
            )
        ).all()
        for obj in links:
            obj.position = 50
        await session.commit()
        for obj in [*links, group_obj]:
            await session.refresh(obj)
        before = {obj.id: (obj.position, obj.updated_at) for obj in links}
        group_before = (group_obj.position, group_obj.updated_at)

    async with db() as session:
        items = await composition.read(session, task_id)
        assert [
            (item.title, item.order_number) for item in composition.flatten(items)
        ] == [("Второй", 1), ("Первый", 2), ("Средний", 1), ("Максимальный", 1)]
        assert not session.dirty and not session.new and not session.deleted
        links = (
            await session.scalars(
                select(TaskComplicationLink).where(
                    TaskComplicationLink.task_id == task_id
                )
            )
        ).all()
        assert {obj.id: (obj.position, obj.updated_at) for obj in links} == before
        stored_group = (
            await session.scalars(
                select(TaskComplicationLinkGroup).where(
                    TaskComplicationLinkGroup.task_id == task_id
                )
            )
        ).one()
        assert (stored_group.position, stored_group.updated_at) == group_before

    unchanged = await client.get(f"/api/solutions/{saved['id']}")
    assert unchanged.status_code == 200, unchanged.text
    assert unchanged.json()["data"]["complications"] == saved["complications"]
