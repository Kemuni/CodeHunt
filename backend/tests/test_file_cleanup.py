import asyncio
from datetime import UTC, datetime, timedelta
from io import BytesIO
from uuid import uuid4

import pytest
from botocore.exceptions import EndpointConnectionError
from pydantic import SecretStr
from sqlalchemy import event, select, update

from app.core.config import settings
from app.main import app
from app.models import PendingFileDeletion, TaskResource
from app.services import file_cleanup, media
from app.services.storage import S3Storage, get_storage
from tests.conftest import make_project
from tests.test_complete_drafts import attach, create_draft, picture

pytestmark = pytest.mark.anyio


@pytest.fixture
def store(client, monkeypatch, minio_endpoint):  # noqa: ARG001 — порядок очистки overrides
    monkeypatch.setattr(settings, "S3_ENDPOINT_URL", minio_endpoint)
    monkeypatch.setattr(settings, "S3_ACCESS_KEY", SecretStr("codehunt_test"))
    monkeypatch.setattr(settings, "S3_SECRET_KEY", SecretStr("codehunt_test_secret"))
    monkeypatch.setattr(settings, "S3_BUCKET", f"cleanup-{uuid4().hex}")
    storage = S3Storage()
    storage.client.create_bucket(Bucket=settings.S3_BUCKET)
    app.dependency_overrides[get_storage] = lambda: storage
    monkeypatch.setattr(media, "get_storage", lambda: storage)
    return storage


def stored_keys(store):
    return {
        obj["Key"]
        for obj in store.client.list_objects_v2(Bucket=settings.S3_BUCKET).get(
            "Contents", []
        )
    }


async def attach_task(client, task):
    base = f"/api/editor/tasks/{task['id']}"
    photo = await client.post(
        base + "/photos",
        files={"files": ("cover.png", picture(), "image/png")},
    )
    resource = await client.post(
        base + "/resources",
        data={"title": "Описание", "type": "other"},
        files={"file": ("spec.txt", b"specification", "text/plain")},
    )
    assert photo.status_code == resource.status_code == 201
    return photo.json()["data"][0], resource.json()["data"]


async def test_delete_task_removes_minio_files_only_after_commit(client, db, store):
    task, _, _ = await make_project(client)
    photo, resource = await attach_task(client, task)
    base = f"/api/editor/tasks/{task['id']}"
    store.upload(BytesIO(b"keep"), "unrelated", "text/plain")
    before = stored_keys(store)
    assert len(before) == 3
    assert (await client.delete(base)).status_code == 409
    assert stored_keys(store) == before
    assert (await client.patch(base, json={"status": "archived"})).status_code == 200
    assert (await client.delete(base)).status_code == 200
    assert stored_keys(store) == {"unrelated"}
    assert (await client.get(photo["url"])).status_code == 404
    assert (
        await client.get(f"/api/media/resources/{resource['id']}")
    ).status_code == 404
    async with db() as session:
        assert not (await session.scalars(select(PendingFileDeletion))).all()


async def test_restricted_task_deletion_preserves_files_and_rolls_back_queue(
    client, db, store
):
    task, _, presets = await make_project(client)
    await attach_task(client, task)
    reply = await client.post(
        f"/api/tasks/{task['id']}/solutions",
        json={"author_id": 1, "task_level_preset_id": presets[0]["id"]},
    )
    assert reply.status_code == 201, reply.text
    base = f"/api/editor/tasks/{task['id']}"
    assert (await client.patch(base, json={"status": "archived"})).status_code == 200
    before = stored_keys(store)
    assert (await client.delete(base)).status_code == 409
    assert stored_keys(store) == before
    assert len((await client.get(base)).json()["data"]["photos"]) == 1
    async with db() as session:
        assert not (await session.scalars(select(PendingFileDeletion))).all()


async def test_failed_minio_delete_is_retried_from_new_db_session(
    client, db, store, monkeypatch
):
    task, _, _ = await make_project(client, published=False)
    await attach_task(client, task)
    failed_key = next(key for key in stored_keys(store) if key.startswith("photos/"))
    delete = store.delete

    def fail_one(key):
        if key == failed_key:
            raise EndpointConnectionError(endpoint_url="http://unavailable.test")
        delete(key)

    with monkeypatch.context() as patch:
        patch.setattr(store, "delete", fail_one)
        assert (
            await client.delete(f"/api/editor/tasks/{task['id']}")
        ).status_code == 200
    assert stored_keys(store) == {failed_key}
    async with db() as session:
        pending = (await session.scalars(select(PendingFileDeletion))).one()
        assert pending.object_key == failed_key
        assert pending.attempt_count == 1
        assert pending.next_attempt_at > datetime.now(UTC)
        # Пока срок повтора не наступил, счётчик не растёт.
        await file_cleanup.process_pending(session)
        await session.refresh(pending)
        assert pending.attempt_count == 1
        await session.execute(
            update(PendingFileDeletion).values(
                next_attempt_at=datetime.now(UTC) - timedelta(seconds=1)
            )
        )
        await session.commit()
    with monkeypatch.context() as patch:
        patch.setattr(store, "delete", fail_one)
        async with db() as session:
            await file_cleanup.process_pending(session)
            pending = (await session.scalars(select(PendingFileDeletion))).one()
            assert pending.attempt_count == 2
            pending.next_attempt_at = datetime.now(UTC) - timedelta(seconds=1)
            await session.commit()
    # Новая сессия имитирует обработку сохранённой очереди после перезапуска.
    async with db() as session:
        await file_cleanup.process_pending(session)
        assert not (await session.scalars(select(PendingFileDeletion))).all()
    assert not stored_keys(store)


async def test_reference_lookup_is_batched_and_skipped_for_empty_queue(
    client, db, store
):
    task, _, _ = await make_project(client, published=False)
    await attach_task(client, task)
    referenced_keys = stored_keys(store)
    for key in ("orphan-1", "orphan-2", "orphan-3"):
        store.upload(BytesIO(b"remove"), key, "text/plain")
    async with db() as session:
        await file_cleanup.enqueue(session, list(stored_keys(store)))
        await session.commit()
        queries = []

        def record(_conn, _cursor, statement, _parameters, _context, _executemany):
            if statement.lstrip().startswith("SELECT"):
                queries.append(statement)

        engine = session.get_bind()
        event.listen(engine, "before_cursor_execute", record)
        try:
            await file_cleanup.process_pending(session)
            assert len(queries) == 2  # Очередь и общая проверка ссылок.
            assert "task_photos" in queries[1] and "task_resources" in queries[1]
            queries.clear()
            await file_cleanup.process_pending(session)
            assert len(queries) == 1  # Пустая очередь не читает таблицы файлов.
        finally:
            event.remove(engine, "before_cursor_execute", record)
        assert not (await session.scalars(select(PendingFileDeletion))).all()
    assert stored_keys(store) == referenced_keys


async def test_shared_key_is_removed_only_after_last_reference(client, db, store):
    task, _, _ = await make_project(client, published=False)
    photo, _ = await attach_task(client, task)
    other, _, _ = await make_project(client, slug="other", published=False)
    key = next(key for key in stored_keys(store) if key.startswith("photos/"))
    async with db() as session:
        # Старые данные могут содержать общий ключ у фото и вложения другой задачи.
        session.add(
            TaskResource(
                task_id=other["id"],
                title="Общий файл",
                type="other",
                object_key=key,
                original_filename="cover.png",
            )
        )
        await session.commit()
    assert (await client.delete(f"/api/editor/tasks/{task['id']}")).status_code == 200
    assert stored_keys(store) == {key}
    assert (await client.get(photo["url"])).status_code == 404
    assert (await client.delete(f"/api/editor/tasks/{other['id']}")).status_code == 200
    assert not stored_keys(store)


async def test_draft_deletion_and_gallery_removal_delete_minio_objects(client, store):
    draft = await attach(client, await create_draft(client))
    base = f"/api/editor/task-drafts/{draft['id']}"
    assert len(stored_keys(store)) == 2
    reply = await client.put(
        base + "/photos", json={"revision": draft["revision"], "photo_ids": []}
    )
    assert reply.status_code == 200, reply.text
    assert len(stored_keys(store)) == 1
    assert all(key.startswith("resources/") for key in stored_keys(store))
    revision = reply.json()["data"]["revision"]
    assert (await client.delete(f"{base}?revision={revision}")).status_code == 200
    assert not stored_keys(store)


async def test_worker_retries_persisted_queue_on_start(db, store):
    store.upload(BytesIO(b"orphan"), "removed-file", "text/plain")
    async with db() as session:
        await file_cleanup.enqueue(session, ["removed-file", "already-removed"])
        await session.commit()
    worker = asyncio.create_task(file_cleanup.run_worker(db))
    try:
        async with asyncio.timeout(5):
            while True:
                async with db() as session:
                    if not (await session.scalars(select(PendingFileDeletion))).all():
                        break
                await asyncio.sleep(0.02)
        assert not stored_keys(store)
    finally:
        worker.cancel()
        with pytest.raises(asyncio.CancelledError):
            await worker
