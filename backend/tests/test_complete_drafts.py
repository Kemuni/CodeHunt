import asyncio
import threading
from io import BytesIO

import pytest
from PIL import Image
from pydantic import SecretStr
from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.main import app
from app.models import Task, TaskDraft, TaskPhoto, TaskResource
from app.services import drafts, media
from app.services.storage import S3Storage, get_storage
from tests.conftest import task_data
from tests.test_failures import SimulatedFailure
from tests.test_resources import MemoryStorage

pytestmark = pytest.mark.anyio


@pytest.fixture
def store(monkeypatch):
    storage = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: storage
    monkeypatch.setattr(media, "get_storage", lambda: storage)
    return storage


def picture():
    file = BytesIO()
    Image.new("RGB", (8, 8), "red").save(file, format="PNG")
    return file.getvalue()


async def create_draft(client, payload=None):
    reply = await client.post(
        "/api/editor/task-drafts", json={"payload": payload or {}}
    )
    assert reply.status_code == 201, reply.text
    return reply.json()["data"]


async def attach(client, draft):
    base = f"/api/editor/task-drafts/{draft['id']}"
    reply = await client.post(
        base + "/photos",
        data={"revision": draft["revision"]},
        files={"files": ("cover.png", picture(), "image/png")},
    )
    assert reply.status_code == 201, reply.text
    draft = reply.json()["data"]
    reply = await client.post(
        base + "/resources",
        data={"revision": draft["revision"]},
        files={"file": ("spec.txt", b"project spec", "text/plain")},
    )
    assert reply.status_code == 201, reply.text
    return reply.json()["data"]


async def test_empty_form_files_live_validation_and_atomic_publication(
    client, db, store
):
    draft = await create_draft(client)
    assert "schema_version" not in draft and draft["photos"] == draft["resources"] == []
    draft = await attach(client, draft)
    assert draft["revision"] == 3 and not draft["is_valid"]
    photo, resource = draft["photos"][0], draft["resources"][0]
    assert photo["task_id"] is None and resource["task_id"] is None
    assert photo["draft_id"] == resource["draft_id"] == draft["id"]
    assert resource["title"] == "spec.txt" and resource["type"] == "other"
    base = f"/api/editor/task-drafts/{draft['id']}"
    keys = set(store.objects)
    stamp = draft["updated_at"]
    assert (await client.get(base)).json()["data"]["updated_at"] == stamp
    assert (
        await client.post(base + "/publish", json={"revision": 3})
    ).status_code == 422
    assert (await client.get(base)).json()["data"]["photos"][0]["id"] == photo["id"]
    data = task_data()
    data["items"] = [
        {
            "kind": "group",
            "level": item["level"],
            "title": "Каталог",
            "items": [
                {
                    "kind": "group",
                    "level": item["level"],
                    "title": "Навигация",
                    "items": [item],
                }
            ],
        }
        for item in data["items"]
    ]
    draft = (await client.patch(base, json={"revision": 3, "payload": data})).json()[
        "data"
    ]
    assert draft["is_valid"] and draft["revision"] == 4
    reply = await client.post(base + "/publish", json={"revision": 4})
    assert reply.status_code == 201, reply.text
    task = reply.json()["data"]
    assert task["status"] == "published" and len(task["presets"]) == 3
    assert (
        task["presets"]["easy"]["complications"][0]["items"][0]["items"][0]["title"]
        == "Требование easy"
    )
    assert task["photos"][0]["id"] == photo["id"] and task["photos"][0]["is_cover"]
    assert task["cover_photo"] == task["photos"][0]
    assert task["resources"][0]["id"] == resource["id"]
    assert (
        task["photos"][0]["draft_id"] is None
        and task["resources"][0]["draft_id"] is None
    )
    assert task["photos"][0]["task_id"] == task["resources"][0]["task_id"] == task["id"]
    assert set(store.objects) == keys
    assert (await client.get(base)).status_code == 404
    assert (await client.get(f"/api/tasks/{task['id']}")).status_code == 200
    assert (
        await client.get(
            f"/api/tasks/{task['id']}/resources/{resource['id']}/download-url"
        )
    ).status_code == 200
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(TaskDraft)) == 0
        assert await session.scalar(select(func.count()).select_from(TaskPhoto)) == 1
        assert await session.scalar(select(func.count()).select_from(TaskResource)) == 1


async def test_nested_errors_and_deleted_templates_remain_visible(client):
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
                "title": "Пагинация",
                "description": "Общая идея",
                "category_id": category["id"],
            },
        )
    ).json()["data"]
    draft = await create_draft(
        client,
        {
            "items": [
                {
                    "kind": "group",
                    "level": "easy",
                    "items": [
                        {"kind": "complication", "complication_id": template["id"]}
                    ],
                }
            ],
            "presets": [{"level": "easy"}],
        },
    )
    paths = {error["field"] for error in draft["validation_errors"]}
    assert (
        "items.0.title" in paths
        and "items.0.items.0.title" in paths
        and "presets.0.description" in paths
    )
    assert (
        await client.delete(f"/api/task-complications/{template['id']}")
    ).status_code == 200
    base = f"/api/editor/task-drafts/{draft['id']}"
    current = (await client.get(base)).json()["data"]
    assert any(
        error["field"] == "items.0.items.0.complication_id"
        and error["code"] == "template_not_found"
        for error in current["validation_errors"]
    )
    data = task_data()
    data["items"][0]["id"] = 123
    data["presets"][1]["level"] = "easy"
    current = (await client.patch(base, json={"revision": 1, "payload": data})).json()[
        "data"
    ]
    assert {error["code"] for error in current["validation_errors"]} >= {
        "unexpected_id",
        "duplicate_level",
    }
    assert (
        await client.post(base + "/publish", json={"revision": 2})
    ).status_code == 422


async def test_draft_file_ownership_revision_editing_and_deletion(client, db, store):
    draft = await attach(client, await create_draft(client))
    assert len(store.objects) == 2
    base = f"/api/editor/task-drafts/{draft['id']}"
    rid, pid = draft["resources"][0]["id"], draft["photos"][0]["id"]
    other = {"X-User-ID": "3"}
    assert (await client.get(base, headers=other)).status_code == 404
    assert (
        await client.get(base + f"/resources/{rid}/download-url", headers=other)
    ).status_code == 404
    assert (
        await client.post(
            base + "/photos",
            data={"revision": 3},
            files={"files": ("x.png", picture(), "image/png")},
            headers=other,
        )
    ).status_code == 404
    assert (
        await client.post(
            base + "/resources",
            data={"revision": 3},
            files={"file": ("x.txt", b"x")},
            headers=other,
        )
    ).status_code == 404
    assert (
        await client.put(
            base + "/photos", json={"revision": 3, "photo_ids": []}, headers=other
        )
    ).status_code == 404
    assert (
        await client.patch(
            base + f"/resources/{rid}",
            json={"revision": 3, "title": "X"},
            headers=other,
        )
    ).status_code == 404
    assert (
        await client.delete(base + f"/resources/{rid}?revision=3", headers=other)
    ).status_code == 404
    assert (await client.delete(base + "?revision=3", headers=other)).status_code == 404
    assert (
        await client.put(base + "/photos", json={"revision": 2, "photo_ids": []})
    ).status_code == 409
    updated = await client.patch(
        base + f"/resources/{rid}",
        json={"revision": 3, "title": "Макет", "type": "design"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["data"]["revision"] == 4
    assert updated.json()["data"]["resources"][0]["title"] == "Макет"
    assert (
        await client.get(base + f"/resources/{rid}/download-url")
    ).status_code == 200
    assert (
        await client.post(base + "/publish", json={"revision": 3})
    ).status_code == 409
    assert (
        await client.put(base + "/photos", json={"revision": 4, "photo_ids": [pid]})
    ).json()["data"]["revision"] == 5
    removed = await client.delete(base + f"/resources/{rid}?revision=5")
    assert (
        removed.json()["data"]["revision"] == 6
        and removed.json()["data"]["resources"] == []
    )
    assert (await client.delete(base + "?revision=5")).status_code == 409
    assert (await client.delete(base + "?revision=6")).status_code == 200
    async with db() as session:
        assert await session.get(TaskPhoto, pid) is None
        assert await session.get(TaskResource, rid) is None


async def test_publication_failure_rolls_back_task_and_both_file_owners(
    client, db, store, monkeypatch
):
    draft = await attach(client, await create_draft(client, task_data()))
    base = f"/api/editor/task-drafts/{draft['id']}"
    original = drafts.commit

    async def fail_commit(_session):
        raise SimulatedFailure("Сбой публикации до commit")

    monkeypatch.setattr(drafts, "commit", fail_commit)
    reply = await client.post(base + "/publish", json={"revision": 3})
    assert reply.status_code == 503
    current = (await client.get(base)).json()["data"]
    assert current["revision"] == 3 and current["is_valid"]
    assert (
        current["photos"][0]["task_id"] is None
        and current["resources"][0]["task_id"] is None
    )
    assert len(store.objects) == 2
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(Task)) == 0
    monkeypatch.setattr(drafts, "commit", original)
    assert (
        await client.post(base + "/publish", json={"revision": 3})
    ).status_code == 201


@pytest.mark.parametrize("publish_during_upload", [False, True])
async def test_upload_race_preserves_current_owner_and_compensates_file(
    client, store, monkeypatch, publish_during_upload
):
    draft = await attach(client, await create_draft(client, task_data()))
    base = f"/api/editor/task-drafts/{draft['id']}"
    keys = set(store.objects)
    entered, resume = threading.Event(), threading.Event()
    upload = store.upload

    def delayed_upload(file, key, content_type):
        entered.set()
        if not resume.wait(10):
            raise RuntimeError("Тест не разрешил продолжить загрузку")
        upload(file, key, content_type)

    monkeypatch.setattr(store, "upload", delayed_upload)
    request = asyncio.create_task(
        client.post(
            base + "/resources",
            data={"revision": 3},
            files={"file": ("late.txt", b"late")},
        )
    )
    try:
        assert await asyncio.to_thread(entered.wait, 5)
        if publish_during_upload:
            reply = await client.post(base + "/publish", json={"revision": 3})
            assert reply.status_code == 201, reply.text
        else:
            assert (
                await client.patch(
                    base, json={"revision": 3, "payload": {"title": "Изменённая форма"}}
                )
            ).status_code == 200
    finally:
        resume.set()
    response = await request
    assert response.status_code == (404 if publish_during_upload else 409)
    assert set(store.objects) == keys
    if not publish_during_upload:
        assert (await client.get(base)).json()["data"]["revision"] == 4


async def test_draft_gallery_limit_and_database_owner_constraints(
    client, sync_engine, store
):
    draft = await create_draft(client)
    base = f"/api/editor/task-drafts/{draft['id']}"
    reply = await client.post(
        base + "/photos",
        data={"revision": 1},
        files=[("files", (f"{i}.png", picture(), "image/png")) for i in range(4)],
    )
    assert reply.status_code == 201, reply.text
    photos_data = reply.json()["data"]["photos"]
    assert len(store.objects) == 4
    assert (
        await client.post(
            base + "/photos",
            data={"revision": 2},
            files={"files": ("extra.png", picture(), "image/png")},
        )
    ).status_code == 409
    ids = [photo["id"] for photo in reversed(photos_data)]
    reply = await client.put(base + "/photos", json={"revision": 2, "photo_ids": ids})
    assert reply.json()["data"]["photos"][0]["id"] == ids[0]
    assert reply.json()["data"]["photos"][0]["is_cover"]
    task = (await client.post("/api/editor/tasks", json=task_data())).json()["data"]
    for owner in ({}, {"task_id": task["id"], "draft_id": draft["id"]}):
        with pytest.raises(IntegrityError), sync_engine.begin() as conn:
            conn.execute(
                insert(TaskResource).values(
                    **owner,
                    title="X",
                    type="other",
                    object_key="invalid",
                    original_filename="x",
                )
            )
        with pytest.raises(IntegrityError), sync_engine.begin() as conn:
            conn.execute(
                insert(TaskPhoto).values(
                    **owner,
                    position=1,
                    object_key="invalid",
                    original_filename="x",
                    content_type="image/png",
                    size_bytes=10,
                )
            )
    with pytest.raises(IntegrityError), sync_engine.begin() as conn:
        conn.execute(
            insert(TaskPhoto).values(
                draft_id=draft["id"],
                position=5,
                object_key="fifth",
                original_filename="x",
                content_type="image/png",
                size_bytes=10,
            )
        )
    assert (
        await client.patch(f"/api/editor/tasks/{task['id']}", json={"status": "draft"})
    ).status_code == 422
    assert (
        await client.post(base + "/materialize", json={"revision": 3})
    ).status_code == 404


async def test_real_minio_draft_files_survive_publication(
    client, minio_endpoint, monkeypatch
):
    monkeypatch.setattr(settings, "S3_ENDPOINT_URL", minio_endpoint)
    monkeypatch.setattr(settings, "S3_PUBLIC_ENDPOINT_URL", None)
    monkeypatch.setattr(settings, "S3_ACCESS_KEY", SecretStr("codehunt_test"))
    monkeypatch.setattr(settings, "S3_SECRET_KEY", SecretStr("codehunt_test_secret"))
    monkeypatch.setattr(settings, "S3_BUCKET", "codehunt-drafts-test")
    store = S3Storage()
    store.client.create_bucket(Bucket=settings.S3_BUCKET)
    app.dependency_overrides[get_storage] = lambda: store
    monkeypatch.setattr(media, "get_storage", lambda: store)
    draft = await attach(client, await create_draft(client, task_data()))
    keys = {
        item["Key"]
        for item in store.client.list_objects_v2(Bucket=settings.S3_BUCKET)["Contents"]
    }
    assert (await client.get(draft["resources"][0]["url"])).content == b"project spec"
    assert (await client.get(draft["photos"][0]["url"])).content == picture()
    reply = await client.post(
        f"/api/editor/task-drafts/{draft['id']}/publish", json={"revision": 3}
    )
    assert reply.status_code == 201, reply.text
    task = reply.json()["data"]
    assert (await client.get(task["resources"][0]["url"])).content == b"project spec"
    assert (await client.get(task["photos"][0]["url"])).content == picture()
    assert {
        item["Key"]
        for item in store.client.list_objects_v2(Bucket=settings.S3_BUCKET)["Contents"]
    } == keys
    for key in keys:
        store.delete(key)
