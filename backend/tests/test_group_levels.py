"""Проверки модели/API и чистого преобразования данных; миграции не применяются."""

import importlib.util
from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from app.models import TaskComplicationLink, TaskComplicationLinkGroup
from app.schemas.domain import CompositionGroup
from tests.conftest import composition_data, make_project, save_task
from tests.test_grouped_tasks import link_input


@pytest.mark.parametrize("level", ["easy", "medium", "high"])
def test_empty_group_requires_and_keeps_its_level(level):
    group = CompositionGroup(title="Пустая", level=level)
    assert group.level == level and group.items == []
    with pytest.raises(ValidationError):
        CompositionGroup.model_validate({"title": "Без уровня"})


@pytest.mark.anyio
async def test_group_levels_are_enforced_and_move_atomically(client, sync_engine):
    task, links, _ = await make_project(client, hidden=True)
    base = f"/api/editor/tasks/{task['id']}"
    items: list[dict] = [
        link_input(links[0]),
        link_input(links[1]),
        {
            "kind": "group",
            "title": "Группа",
            "level": "high",
            "items": [
                link_input(links[2]),
                {"kind": "group", "title": "Пустая", "level": "high", "items": []},
            ],
        },
    ]
    response = await save_task(client, base, **{"items": items})
    assert response.status_code == 200, response.text
    tree = composition_data(response.json()["data"])
    group, empty = tree[2], tree[2]["items"][1]
    detail = (await client.get(base)).json()["data"]
    assert detail["presets"]["high"]["complications"] == [group]
    assert detail["presets"]["easy"]["complications"] == [tree[0]]

    for bad_child in [
        link_input(links[0]),
        {"kind": "group", "level": "medium", "title": "Чужой уровень"},
    ]:
        bad = deepcopy(items)
        bad[2]["items"] = [bad_child]
        assert (await save_task(client, base, **{"items": bad})).status_code == 422
        assert composition_data((await client.get(base)).json()["data"]) == tree
    for model, object_id, values in [
        (TaskComplicationLink, links[0]["id"], {"group_id": group["id"]}),
        (TaskComplicationLinkGroup, empty["id"], {"level": "easy"}),
    ]:
        with pytest.raises(IntegrityError), sync_engine.begin() as conn:
            conn.execute(update(model).where(model.id == object_id).values(**values))

    moved = deepcopy(items)
    moved[2].update(id=group["id"], level="medium")
    moved[2]["items"][0]["level"] = "medium"
    moved[2]["items"][1].update(id=empty["id"], level="medium")
    response = await save_task(client, base, **{"items": moved})
    assert response.status_code == 200, response.text
    detail = (await client.get(base)).json()["data"]
    assert detail["presets"]["high"]["complications"] == []
    saved = detail["presets"]["medium"]["complications"][1]
    assert saved["id"] == group["id"] and saved["level"] == "medium"
    assert saved["items"][0]["id"] == links[2]["id"]
    assert saved["items"][1]["id"] == empty["id"]
    assert all(child["level"] == "medium" for child in saved["items"])


@pytest.fixture
def migration_module():
    path = Path(__file__).parents[1] / "alembic/versions/e62b9c43a105_group_levels.py"
    spec = importlib.util.spec_from_file_location("group_levels_migration", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_legacy_split_preserves_nested_items_ids_and_empty_group_fallback(
    migration_module,
):
    items = [
        {
            "kind": "group",
            "id": 1,
            "title": "Общая",
            "items": [
                {"kind": "complication", "id": 10, "level": "medium"},
                {
                    "kind": "group",
                    "id": 2,
                    "title": "Вложенная",
                    "items": [
                        {"kind": "complication", "id": 11, "level": "high"},
                        {"kind": "group", "id": 3, "title": "Пустая", "items": []},
                    ],
                },
            ],
        },
        {"kind": "group", "id": 4, "title": "Корневая пустая", "items": []},
    ]
    before = deepcopy(items)
    converted = migration_module.split_legacy_items(items, "medium")
    assert items == before
    assert [node["level"] for node in converted] == ["medium", "high", "medium"]
    assert converted[0]["items"][0]["id"] == 10
    nested = converted[1]["items"][0]
    assert nested["id"] == 2 and nested["level"] == "high"
    assert nested["items"][0]["id"] == 11
    assert nested["items"][1]["id"] == 3 and nested["items"][1]["level"] == "high"
    assert converted[2]["id"] == 4 and converted[2]["items"] == []


def test_legacy_split_keeps_incomplete_draft_fields(migration_module):
    items = [
        {
            "kind": "group",
            "title": "Недописанная",
            "custom": True,
            "items": [
                {"kind": "complication", "description": "Только описание"},
            ],
        },
        {"kind": "group", "items": "Некорректное значение"},
    ]
    converted = migration_module.split_legacy_items(items, "high")
    assert converted[0]["level"] == "high" and converted[0]["custom"] is True
    assert converted[0]["items"] == items[0]["items"]
    assert converted[1]["items"] == "Некорректное значение"
