import asyncio
from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy import event, insert, select, update
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.main import app
from app.models import Task, TaskComplicationLink, TaskPhoto
from app.services import catalog, composition, library
from app.services.storage import get_storage
from tests.conftest import make_project, task_data
from tests.test_resources import MemoryStorage

pytestmark = pytest.mark.anyio


def link_input(link):
    return {
        "kind": "complication",
        **{
            key: link[key]
            for key in (
                "id",
                "title",
                "description",
                "acceptance_criteria",
                "level",
                "is_required",
                "complication_id",
            )
        },
    }


def image_bytes():
    file = BytesIO()
    Image.new("RGB", (8, 8), "blue").save(file, format="PNG")
    return file.getvalue()


async def test_nested_groups_presets_and_solution_snapshots(client, db):
    task, links, presets = await make_project(client)
    tid = task["id"]
    url = f"/api/editor/tasks/{tid}/composition"
    payload = {
        "items": [
            {
                "kind": "group",
                "level": "easy",
                "title": "Каталог",
                "items": [
                    link_input(links[0]),
                    {
                        "kind": "group",
                        "level": "easy",
                        "title": "Расширения",
                        "items": [],
                    },
                ],
            },
            link_input(links[1]),
            {
                "kind": "group",
                "level": "high",
                "title": "Максимальный",
                "items": [link_input(links[2])],
            },
            {"kind": "group", "level": "high", "title": "Пустая группа", "items": []},
        ]
    }
    response = await client.put(url, json=payload)
    assert response.status_code == 200, response.text
    tree = response.json()["data"]
    group_id = tree[0]["id"]
    nested_id = tree[0]["items"][1]["id"]
    assert tree[0]["items"][0]["id"] == links[0]["id"]
    assert tree[0]["items"][1]["parent_group_id"] == group_id
    assert (await client.get(url)).json()["data"] == tree
    detail = (await client.get(f"/api/tasks/{tid}")).json()["data"]
    assert "complications" not in detail
    assert list(detail["presets"]) == ["easy", "medium", "high"]
    assert detail["presets"]["easy"]["complications"] == [tree[0]]
    assert detail["presets"]["medium"]["complications"] == [tree[1]]
    assert detail["presets"]["high"]["complications"] == [tree[2], tree[3]]
    for preset in presets:
        assert detail["presets"][preset["level"]]["preset"] == preset
    for path in (f"/api/editor/tasks/{tid}", f"/api/tasks/by-slug/{task['slug']}"):
        assert (await client.get(path)).json()["data"] == detail
    assert detail["photos"] == []
    easy = (
        await client.get(f"/api/tasks/{tid}/presets/{presets[0]['id']}/configuration")
    ).json()["data"]["complications"]
    assert len(easy) == 1 and easy[0]["kind"] == "group"
    assert [item["id"] for item in easy[0]["items"]] == [links[0]["id"]]
    high = (
        await client.get(f"/api/tasks/{tid}/presets/{presets[2]['id']}/configuration")
    ).json()["data"]["complications"]
    assert [item["kind"] for item in high] == ["group", "complication", "group"]
    assert high[2]["items"][0]["id"] == links[2]["id"]
    solution = await client.post(
        f"/api/tasks/{tid}/solutions",
        json={
            "author_id": 1,
            "task_level_preset_id": presets[2]["id"],
            "excluded_complication_link_ids": [links[2]["id"]],
        },
    )
    assert solution.status_code == 201, solution.text
    snapshot = solution.json()["data"]
    assert [
        item["original_complication_link_id"] for item in snapshot["complications"]
    ] == [links[0]["id"], links[1]["id"]]
    # Переносим группу под прежнюю дочернюю группу, конечное дерево остаётся ацикличным.
    moved = {
        "items": [
            {
                "kind": "group",
                "level": "easy",
                "id": nested_id,
                "title": "Расширения",
                "items": [
                    {
                        "kind": "group",
                        "level": "easy",
                        "id": group_id,
                        "title": "Каталог",
                        "items": [link_input(links[0])],
                    },
                ],
            },
            link_input(links[1]),
            link_input(links[2]),
        ]
    }
    assert (await client.put(url, json=moved)).status_code == 200
    assert (await client.get(f"/api/solutions/{snapshot['id']}")).json()["data"][
        "complications"
    ] == snapshot["complications"]
    # Удаление используемого пункта откатывает всё сохранение структуры.
    before = (await client.get(url)).json()["data"]
    assert (
        await client.put(url, json={"items": [link_input(links[2])]})
    ).status_code == 409
    assert (await client.get(url)).json()["data"] == before
    async with db() as session:
        queries = []

        def record(_conn, _cursor, statement, _params, _context, _many):
            queries.append(statement)

        engine = session.bind
        assert engine is not None
        event.listen(engine.sync_engine, "before_cursor_execute", record)
        try:
            await composition.read(session, tid)
            assert len(queries) == 2
        finally:
            event.remove(engine.sync_engine, "before_cursor_execute", record)


async def test_composition_validation_and_atomicity(client, sync_engine):
    task, links, _ = await make_project(client, published=False)
    other, other_links, _ = await make_project(client, slug="other", published=False)
    base = f"/api/editor/tasks/{task['id']}"
    url = base + "/composition"
    response = await client.put(
        url,
        json={
            "items": [
                {
                    "kind": "group",
                    "level": link["level"],
                    "title": "Группа",
                    "items": [link_input(link)],
                }
                for link in links
            ]
        },
    )
    assert response.status_code == 200, response.text
    group = response.json()["data"][0]
    before = (await client.get(url)).json()["data"]
    assert (
        await client.put(
            url, json={"items": [link_input(links[0]), link_input(links[0])]}
        )
    ).status_code == 422
    assert (
        await client.put(url, json={"items": [link_input(other_links[0])]})
    ).status_code == 404
    assert (
        await client.put(
            url,
            json={
                "items": [
                    {
                        "kind": "group",
                        "level": "easy",
                        "id": group["id"],
                        "title": "X",
                        "items": [
                            {
                                "kind": "group",
                                "level": "easy",
                                "id": group["id"],
                                "title": "Y",
                            }
                        ],
                    }
                ]
            },
        )
    ).status_code == 422
    assert (await client.get(url)).json()["data"] == before
    bad_link = {**link_input(links[0]), "complication_id": 99999}
    assert (await client.put(url, json={"items": [bad_link]})).status_code == 404
    leaf = link_input(links[0])
    for _ in range(11):
        leaf = {"kind": "group", "level": "easy", "title": "Вложение", "items": [leaf]}
    assert (await client.put(url, json={"items": [leaf]})).status_code == 422
    # И точечный API, и FK запрещают привязать пункт к группе другого задания.
    assert (
        await client.patch(
            f"/api/editor/tasks/{other['id']}/complications/{other_links[0]['id']}",
            json={"group_id": group["id"]},
        )
    ).status_code == 404
    with pytest.raises(IntegrityError), sync_engine.begin() as conn:
        conn.execute(
            update(TaskComplicationLink)
            .where(TaskComplicationLink.id == other_links[0]["id"])
            .values(group_id=group["id"])
        )
    copied = await client.post(
        f"/api/editor/tasks/{other['id']}/complications/copy",
        json={"source_link_id": links[0]["id"]},
    )
    assert copied.status_code == 201 and copied.json()["data"]["group_id"] is None
    assert (
        await client.put(url, json={"items": []}, headers={"X-User-ID": "2"})
    ).status_code == 403
    assert (await client.delete(base)).status_code == 200


async def test_library_tree_and_removed_category_group(client, db):
    root = (
        await client.post(
            "/api/task-complication-categories",
            json={"title": "Функции", "developer_type": "fullstack"},
        )
    ).json()["data"]
    child = (
        await client.post(
            "/api/task-complication-categories",
            json={
                "title": "Каталог",
                "developer_type": "frontend",
                "parent_id": root["id"],
            },
        )
    ).json()["data"]
    assert "group" not in root
    leaf = (
        await client.post(
            "/api/task-complication-categories",
            json={
                "title": "Навигация",
                "developer_type": "frontend",
                "parent_id": child["id"],
            },
        )
    ).json()["data"]
    assert (
        await client.post(
            "/api/task-complication-categories",
            json={
                "title": "Old",
                "developer_type": "frontend",
                "group": "functionality",
            },
        )
    ).status_code == 422
    template = (
        await client.post(
            "/api/task-complications",
            json={
                "title": "Пагинация",
                "description": "Общая идея",
                "category_id": leaf["id"],
            },
        )
    ).json()["data"]
    full = (await client.get("/api/task-complications/library")).json()["data"]
    assert [group["developer_type"] for group in full] == ["frontend", "fullstack"]
    frontend = full[0]["categories"]
    assert frontend[0]["id"] == child["id"]
    assert frontend[0]["parent_id"] == root["id"]
    assert frontend[0]["complications"] == []
    assert frontend[0]["children"][0]["id"] == leaf["id"]
    assert frontend[0]["children"][0]["complications"][0]["id"] == template["id"]
    assert full[1]["categories"][0]["id"] == root["id"]
    assert full[1]["categories"][0]["children"] == []
    filtered = (
        await client.get(
            "/api/task-complications/library?q=Пагинация&developer_type=frontend"
        )
    ).json()["data"]
    assert filtered == [full[0]]
    assert (await client.get("/api/task-complications/library?q=Пагинация")).json()[
        "data"
    ] == filtered
    assert (
        await client.get("/api/task-complications/library?developer_type=fullstack")
    ).json()["data"] == [full[1]]
    assert (
        await client.get(
            "/api/task-complications/library?q=Пагинация&developer_type=fullstack"
        )
    ).json()["data"] == []
    assert (
        await client.get("/api/task-complications/library?q=несуществующее")
    ).json()["data"] == []
    async with db() as session:
        queries = []

        def record(_conn, _cursor, statement, _params, _context, _many):
            queries.append(statement)

        engine = session.bind
        assert engine is not None
        event.listen(engine.sync_engine, "before_cursor_execute", record)
        try:
            await library.grouped_templates(session, None, None)
            assert len(queries) == 2
        finally:
            event.remove(engine.sync_engine, "before_cursor_execute", record)


async def test_hidden_task_is_private_but_solutions_remain(client):
    store = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: store
    task, _, presets = await make_project(client)
    tid = task["id"]
    solution = (
        await client.post(
            f"/api/tasks/{tid}/solutions",
            json={"author_id": 1, "task_level_preset_id": presets[0]["id"]},
        )
    ).json()["data"]
    assert (
        await client.patch(f"/api/editor/tasks/{tid}", json={"is_hidden": True})
    ).status_code == 200
    for path in [
        f"/api/tasks/{tid}",
        f"/api/tasks/by-slug/{task['slug']}",
        f"/api/tasks/{tid}/presets",
        f"/api/tasks/{tid}/presets/{presets[0]['id']}/configuration",
        f"/api/tasks/{tid}/resources",
        f"/api/tasks/{tid}/resources/1/download-url",
    ]:
        assert (await client.get(path)).status_code == 404, path
    assert (await client.get("/api/tasks")).json()["data"]["total"] == 0
    assert (
        await client.post(
            f"/api/tasks/{tid}/solutions",
            json={"author_id": 1, "task_level_preset_id": presets[0]["id"]},
        )
    ).status_code == 404
    assert (await client.get(f"/api/solutions/{solution['id']}")).status_code == 200
    admin_list = await client.get("/api/editor/tasks/all")
    assert admin_list.status_code == 200 and admin_list.json()["data"]["total"] == 1
    assert admin_list.json()["data"]["items"][0]["is_hidden"] is True
    assert (
        await client.get("/api/editor/tasks/all", headers={"X-User-ID": "2"})
    ).status_code == 403
    assert (await client.get(f"/api/editor/tasks/{tid}")).status_code == 200
    assert (
        await client.patch(f"/api/editor/tasks/{tid}", json={"is_hidden": False})
    ).status_code == 200
    assert (await client.get(f"/api/tasks/{tid}")).status_code == 200


async def test_task_covers_in_lists_details_and_updates(client, db, monkeypatch):
    from app.services import photos

    store = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: store
    monkeypatch.setattr(photos, "get_storage", lambda: store)
    task, _, _ = await make_project(client)
    empty, _, _ = await make_project(client, slug="without-photos")
    assert task["cover_photo"] is None and empty["cover_photo"] is None
    base = f"/api/editor/tasks/{task['id']}"
    reply = await client.post(
        base + "/photos",
        files=[("files", (f"{i}.png", image_bytes(), "image/png")) for i in range(2)],
    )
    assert reply.status_code == 201, reply.text
    gallery = reply.json()["data"]
    for url in ("/api/tasks", "/api/editor/tasks", "/api/editor/tasks/all"):
        result = (await client.get(url)).json()["data"]
        assert result["total"] == 2
        assert result["items"][0]["cover_photo"] == gallery[0]
        assert result["items"][1]["cover_photo"] is None
        assert "photos" not in result["items"][0]
        second_page = (await client.get(url + "?limit=1&offset=1")).json()["data"]
        assert second_page["total"] == 2 and len(second_page["items"]) == 1
        assert second_page["items"][0]["id"] == empty["id"]
        assert second_page["items"][0]["cover_photo"] is None
    for url in (base, f"/api/tasks/{task['id']}", f"/api/tasks/by-slug/{task['slug']}"):
        result = (await client.get(url)).json()["data"]
        assert result["cover_photo"] == gallery[0]
        assert result["photos"] == gallery
    empty_detail = (await client.get(f"/api/tasks/{empty['id']}")).json()["data"]
    assert empty_detail["cover_photo"] is None and empty_detail["photos"] == []
    assert (await client.get("/api/tasks?q=несуществующее")).json()["data"][
        "items"
    ] == []

    # Число запросов не растёт с количеством карточек и фотографий.
    async with db() as session:
        queries = []

        def record(_conn, _cursor, statement, _params, _context, _many):
            queries.append(statement)

        engine = session.bind
        assert engine is not None
        event.listen(engine.sync_engine, "before_cursor_execute", record)
        try:
            result = await catalog.task_page(
                session, select(Task).order_by(Task.id), 20, 0
            )
            assert len(queries) == 3 and len(result.items) == 2
        finally:
            event.remove(engine.sync_engine, "before_cursor_execute", record)

    reordered = (
        await client.put(
            base + "/photos",
            json={"photo_ids": [photo["id"] for photo in reversed(gallery)]},
        )
    ).json()["data"]
    updated = (await client.patch(base, json={"title": "Новый заголовок"})).json()[
        "data"
    ]
    assert updated["cover_photo"] == reordered[0]
    assert (await client.get("/api/tasks")).json()["data"]["items"][0][
        "cover_photo"
    ] == reordered[0]
    assert (await client.get(base)).json()["data"]["cover_photo"] == reordered[0]

    await client.patch(base, json={"is_hidden": True})
    public = (await client.get("/api/tasks")).json()["data"]
    assert [item["id"] for item in public["items"]] == [empty["id"]]
    assert (await client.get(f"/api/tasks/{task['id']}")).status_code == 404
    assert (await client.get(f"/api/tasks/by-slug/{task['slug']}")).status_code == 404
    assert (await client.get("/api/editor/tasks/all")).json()["data"]["items"][0][
        "cover_photo"
    ] == reordered[0]

    await client.put(base + "/photos", json={"photo_ids": []})
    assert (await client.get(base)).json()["data"]["cover_photo"] is None
    assert (await client.get("/api/editor/tasks")).json()["data"]["items"][0][
        "cover_photo"
    ] is None


async def test_photo_gallery_limits_cover_and_atomic_reordering(
    client, sync_engine, monkeypatch
):
    store = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: store
    # Сервис чтения также получает тот же адаптер при выдаче агрегированного задания.
    from app.services import photos

    monkeypatch.setattr(photos, "get_storage", lambda: store)
    task, _, _ = await make_project(client)
    base = f"/api/editor/tasks/{task['id']}"
    content = image_bytes()
    response = await client.post(
        base + "/photos",
        files=[("files", (f"{index}.png", content, "image/png")) for index in range(4)],
    )
    assert response.status_code == 201, response.text
    gallery = response.json()["data"]
    assert len(gallery) == 4 and sum(photo["is_cover"] for photo in gallery) == 1
    assert [photo["position"] for photo in gallery] == [1, 2, 3, 4]
    assert "object_key" not in gallery[0]
    detail = (await client.get(f"/api/tasks/{task['id']}")).json()["data"]
    assert [photo["id"] for photo in detail["photos"]] == [
        photo["id"] for photo in gallery
    ]
    assert (
        await client.post(
            base + "/photos", files={"files": ("extra.png", content, "image/png")}
        )
    ).status_code == 409
    assert len(store.objects) == 4
    ids = [photo["id"] for photo in reversed(gallery)]
    reordered = await client.put(base + "/photos", json={"photo_ids": ids})
    assert reordered.status_code == 200, reordered.text
    assert (
        reordered.json()["data"][0]["id"] == ids[0]
        and reordered.json()["data"][0]["is_cover"]
    )
    assert (
        await client.put(base + "/photos", json={"photo_ids": [ids[0], ids[0]]})
    ).status_code == 422
    assert (
        await client.put(base + "/photos", json={"photo_ids": [99999]})
    ).status_code == 404
    reduced = (await client.put(base + "/photos", json={"photo_ids": ids[1:]})).json()[
        "data"
    ]
    assert len(reduced) == 3 and reduced[0]["is_cover"]
    with pytest.raises(IntegrityError), sync_engine.begin() as conn:
        conn.execute(
            insert(TaskPhoto).values(
                task_id=task["id"],
                position=5,
                object_key="invalid-position",
                original_filename="x.png",
                content_type="image/png",
                size_bytes=10,
            )
        )
    assert (await client.put(base + "/photos", json={"photo_ids": []})).json()[
        "data"
    ] == []
    invalid = await client.post(
        base + "/photos",
        files=[
            ("files", ("valid.png", content, "image/png")),
            ("files", ("bad.png", b"not an image", "image/png")),
        ],
    )
    assert invalid.status_code == 422
    assert (await client.get(base)).json()["data"]["photos"] == []
    monkeypatch.setattr(settings, "MAX_PHOTO_BYTES", 3)
    assert (
        await client.post(
            base + "/photos", files={"files": ("big.png", content, "image/png")}
        )
    ).status_code == 413
    assert (
        await client.post(
            base + "/photos",
            files={"files": ("x.png", content, "image/png")},
            headers={"X-User-ID": "2"},
        )
    ).status_code == 403


async def test_concurrent_photo_uploads_keep_maximum_four(client, monkeypatch):
    from app.services import photos

    store = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: store
    monkeypatch.setattr(photos, "get_storage", lambda: store)
    task = (await client.post("/api/editor/tasks", json=task_data())).json()["data"]
    base = f"/api/editor/tasks/{task['id']}"
    content = image_bytes()
    replies = await asyncio.gather(
        *[
            client.post(
                base + "/photos",
                files={"files": (f"{index}.png", content, "image/png")},
            )
            for index in range(5)
        ]
    )
    assert sorted(reply.status_code for reply in replies) == [201, 201, 201, 201, 409]
    gallery = (await client.get(base)).json()["data"]["photos"]
    assert len(gallery) == len(store.objects) == 4
    assert sum(photo["is_cover"] for photo in gallery) == 1
    store.fail_stat = True
    await client.put(base + "/photos", json={"photo_ids": []})
    previous_objects = set(store.objects)
    assert (
        await client.post(
            base + "/photos", files={"files": ("x.png", content, "image/png")}
        )
    ).status_code == 503
    assert set(store.objects) == previous_objects
    assert (await client.get(base)).json()["data"]["photos"] == []


async def test_composition_creates_requirements_and_confirms_template_changes(client):
    category = (
        await client.post(
            "/api/task-complication-categories",
            json={"title": "Каталог", "developer_type": "frontend"},
        )
    ).json()["data"]
    template = (
        await client.post(
            "/api/task-complications",
            json={
                "category_id": category["id"],
                "title": "Пагинация",
                "description": "Общая идея",
            },
        )
    ).json()["data"]
    task = (await client.post("/api/editor/tasks", json=task_data())).json()["data"]
    base = f"/api/editor/tasks/{task['id']}"
    requirement = {
        "kind": "complication",
        "title": "Страницы фильмов",
        "description": "Разбейте список",
        "acceptance_criteria": "Страница в URL",
        "level": "easy",
        "complication_id": template["id"],
    }
    response = await client.put(
        base + "/composition",
        json={
            "items": [
                {
                    "kind": "group",
                    "level": "easy",
                    "title": "Каталог",
                    "items": [requirement],
                }
            ]
        },
    )
    assert response.status_code == 200, response.text
    group = response.json()["data"][0]
    created = group["items"][0]
    assert (
        created["group_id"] == group["id"]
        and created["complication_id"] == template["id"]
    )
    edited = {**requirement, "id": created["id"], "description": "Другая реализация"}
    edited.pop("complication_id")
    assert (
        await client.put(base + "/composition", json={"items": [edited]})
    ).status_code == 422
    preserved = (await client.get(base + "/composition")).json()["data"]
    assert preserved[0]["items"][0]["description"] == requirement["description"]
    edited["complication_id"] = template["id"]
    assert (
        await client.put(base + "/composition", json={"items": [edited]})
    ).status_code == 200
    edited["complication_id"] = None
    detached = (
        await client.put(base + "/composition", json={"items": [edited]})
    ).json()["data"]
    assert detached[0]["complication_id"] is None and detached[0]["group_id"] is None
    assert (await client.patch(base, json={"status": "published"})).status_code == 200
    assert (
        await client.put(base + "/composition", json={"items": []})
    ).status_code == 422
    assert (await client.get(base + "/composition")).json()["data"] == detached


async def test_detail_keeps_levels_without_presets_and_empty_nested_groups(client, db):
    task, links, presets = await make_project(client, published=False)
    base = f"/api/editor/tasks/{task['id']}"
    for preset in presets:
        assert (
            await client.delete(f"{base}/presets/{preset['id']}")
        ).status_code == 200
    tree = (
        await client.put(
            base + "/composition",
            json={
                "items": [
                    {
                        "kind": "group",
                        "level": "high",
                        "title": "Общая",
                        "items": [
                            link_input(links[2]),
                            {
                                "kind": "group",
                                "level": "high",
                                "title": "Пустая",
                                "items": [],
                            },
                        ],
                    },
                    link_input(links[0]),
                ]
            },
        )
    ).json()["data"]
    detail = (await client.get(base)).json()["data"]
    assert "complications" not in detail
    assert all(level["preset"] is None for level in detail["presets"].values())
    assert detail["presets"]["medium"]["complications"] == []
    assert detail["presets"]["easy"]["complications"] == [tree[1]]
    assert detail["presets"]["high"]["complications"] == [tree[0]]
    assert tree[0]["items"][1]["level"] == "high"

    # Дерево читается один раз: количество SQL-запросов не зависит от числа пресетов.
    async with db() as session:
        obj = await catalog.task(session, task["id"])
        queries = []

        def record(_conn, _cursor, statement, _params, _context, _many):
            queries.append(statement)

        engine = session.bind
        assert engine is not None
        event.listen(engine.sync_engine, "before_cursor_execute", record)
        try:
            await catalog.detail(session, obj)
            assert len(queries) == 5
            for preset in presets:
                response = await client.post(
                    base + "/presets",
                    json={
                        "level": preset["level"],
                        "description": preset["description"],
                    },
                )
                assert response.status_code == 201
            queries.clear()
            populated = await catalog.detail(session, obj)
            assert len(queries) == 5
            assert all(
                level.preset is not None
                for level in (
                    populated.presets.easy,
                    populated.presets.medium,
                    populated.presets.high,
                )
            )
        finally:
            event.remove(engine.sync_engine, "before_cursor_execute", record)
