import pytest
from sqlalchemy import event

from app.main import app
from app.services import catalog, drafts
from tests.conftest import make_project, task_write
from tests.test_complete_drafts import attach, create_draft, store  # noqa: F401
from tests.test_failures import SimulatedFailure

pytestmark = pytest.mark.anyio


async def test_atomic_save_rolls_back_info_presets_and_tree(client, monkeypatch):
    task, links, presets = await make_project(client)
    base = f"/api/editor/tasks/{task['id']}"
    before = (await client.get(base)).json()["data"]
    body = task_write(before)
    body["title"] = "Изменённое название"
    body["slug"] = "new-address"
    body["presets"][0]["description"] = "Изменённый пресет"
    body["items"][0]["title"] = "Изменённый пункт"

    # Пустое дерево обнаруживается после записи полей и пресетов; откатывается всё.
    failed = await client.put(base, json={**body, "items": []})
    assert failed.status_code == 422, failed.text
    assert (await client.get(base)).json()["data"] == before

    async def fail_commit(session):
        await session.flush()
        raise SimulatedFailure()

    with monkeypatch.context() as patch:
        patch.setattr(catalog, "commit", fail_commit)
        assert (await client.put(base, json=body)).status_code == 503
    assert (await client.get(base)).json()["data"] == before

    saved = await client.put(base, json=body)
    assert saved.status_code == 200, saved.text
    detail = saved.json()["data"]
    assert detail["title"] == body["title"]
    easy = detail["presets"]["easy"]
    assert easy["preset"]["id"] == presets[0]["id"]
    assert easy["preset"]["description"] == body["presets"][0]["description"]
    assert easy["complications"][0]["id"] == links[0]["id"]
    assert easy["complications"][0]["title"] == body["items"][0]["title"]
    assert (await client.get("/api/tasks/by-slug/new-address")).json()["data"] == detail
    assert (await client.get(f"/api/tasks/by-slug/{task['slug']}")).status_code == 404
    assert (
        await client.put(
            base, json=body, headers={"Authorization": "Bearer test-session-2"}
        )
    ).status_code == 403


async def test_draft_summary_is_batched_private_and_does_not_validate(
    client,
    db,
    store,  # noqa: F811
    monkeypatch,
):
    owned = await attach(client, await create_draft(client))
    assert len(store.objects) == 2
    await create_draft(client, {"title": 123, "short_description": {"invalid": True}})
    await client.post(
        "/api/editor/task-drafts",
        json={"payload": {"title": "Чужой"}},
        headers={"Authorization": "Bearer test-session-3"},
    )
    for i in range(5):
        await create_draft(
            client, {"title": f"Черновик {i}", "full_description": "x" * 10_000}
        )

    async def unexpected_validation(*_args):
        raise AssertionError("Список не должен валидировать формы")

    with monkeypatch.context() as patch:
        patch.setattr(drafts, "validate", unexpected_validation)
        async with db() as session:
            queries = []

            def record(_conn, _cursor, statement, _parameters, _context, _many):
                queries.append(statement)

            engine = session.get_bind()
            event.listen(engine, "before_cursor_execute", record)
            try:
                result = await drafts.listing(session, 1, 20, 0)
                assert len(queries) == 3
            finally:
                event.remove(engine, "before_cursor_execute", record)
    assert result.total == 7
    assert all(item.title != "Чужой" for item in result.items)
    summary = next(item for item in result.items if item.id == owned["id"])
    assert summary.cover_photo is not None
    assert summary.cover_photo.id == owned["photos"][0]["id"]
    assert summary.revision == owned["revision"]
    assert set(summary.model_dump()) == {
        "id",
        "title",
        "short_description",
        "revision",
        "created_at",
        "updated_at",
        "cover_photo",
    }
    assert (await client.get(f"/api/editor/task-drafts/{owned['id']}")).json()["data"][
        "validation_errors"
    ]
    page = (await client.get("/api/editor/task-drafts?limit=2&offset=2")).json()["data"]
    assert len(page["items"]) == 2 and page["total"] == 7


async def test_removed_routes_and_preserved_future_contract():
    paths = app.openapi()["paths"]
    for path in (
        "/api/tasks/{task_id}",
        "/api/tasks/{task_id}/presets",
        "/api/editor/tasks/all",
        "/api/editor/tasks/{task_id}/complications",
        "/api/editor/tasks/{task_id}/complications/{link_id}",
        "/api/editor/tasks/{task_id}/complications/copy",
        "/api/editor/tasks/{task_id}/complications/order",
        "/api/editor/tasks/{task_id}/composition",
        "/api/editor/media/photos/{photo_id}",
        "/api/editor/media/resources/{resource_id}",
        "/api/tasks/{task_id}/resources",
    ):
        assert path not in paths
    assert "post" not in paths["/api/editor/tasks"]
    assert not any("download-url" in path for path in paths)
    assert "get" not in paths["/api/task-complication-categories"]
    assert "get" not in paths["/api/task-complications"]
    assert "patch" in paths["/api/editor/tasks/{task_id}/resources/{resource_id}"]
    assert (
        "patch" in paths["/api/editor/task-drafts/{draft_id}/resources/{resource_id}"]
    )
    assert not any(path.endswith("/configuration") for path in paths)
    assert "get" in paths["/api/tasks/by-slug/{slug}/presets"]
    assert "get" in paths["/api/editor/tasks/{task_id}/presets"]
    assert "post" in paths["/api/tasks/{task_id}/solutions"]


async def test_presets_read_own_levels_and_enforce_task_visibility(client):
    task, links, _ = await make_project(client)
    public = f"/api/tasks/by-slug/{task['slug']}/presets"
    editor = f"/api/editor/tasks/{task['id']}/presets"
    expected = task["presets"]
    assert (await client.get(editor)).json()["data"] == expected
    client.headers.pop("authorization")
    assert (await client.get(public)).json()["data"] == expected
    assert (await client.get(editor)).status_code == 401
    for level, link in zip(("easy", "medium", "high"), links, strict=True):
        assert [item["id"] for item in expected[level]["complications"]] == [link["id"]]
    member = {"Authorization": "Bearer test-session-2"}
    admin = {"Authorization": "Bearer test-session-1"}
    assert (await client.get(editor, headers=member)).status_code == 403
    base = f"/api/editor/tasks/{task['id']}"
    assert (
        await client.patch(base, json={"slug": "renamed-task"}, headers=admin)
    ).status_code == 200
    assert (await client.get(public)).status_code == 404
    public = "/api/tasks/by-slug/renamed-task/presets"
    assert (await client.get(public)).json()["data"] == expected
    for change in ({"is_hidden": True}, {"is_hidden": False, "status": "archived"}):
        assert (await client.patch(base, json=change, headers=admin)).status_code == 200
        assert (await client.get(public)).status_code == 404
        assert (await client.get(public, headers=admin)).status_code == 404
        assert (await client.get(editor, headers=admin)).json()["data"] == expected
    assert (
        await client.get("/api/tasks/by-slug/missing-task/presets")
    ).status_code == 404
    assert (
        await client.get("/api/editor/tasks/999999/presets", headers=admin)
    ).status_code == 404
