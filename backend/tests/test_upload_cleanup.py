from io import BytesIO
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import UploadFile
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UploadSizeMismatchError
from app.main import app
from app.models.enums import ResourceType
from app.services import photos, resources
from app.services.media import MediaOwner, discard_upload
from app.services.storage import get_storage
from tests.conftest import publish_task, task_data
from tests.test_resources import MemoryStorage

pytestmark = pytest.mark.anyio


def picture() -> bytes:
    stream = BytesIO()
    Image.new("RGB", (8, 8), "green").save(stream, format="PNG")
    return stream.getvalue()


class WrongSizeStorage(MemoryStorage):
    def __init__(self, mismatch_on: int):
        super().__init__()
        self.mismatch_on = mismatch_on
        self.stat_calls = 0

    def stat(self, key):
        metadata = super().stat(key)
        self.stat_calls += 1
        if self.stat_calls == self.mismatch_on:
            metadata["ContentLength"] += 1
        return metadata


@pytest.mark.parametrize("owner_kind", ["tasks", "task-drafts"])
@pytest.mark.parametrize("media_kind", ["resources", "photos"])
async def test_size_mismatch_cleans_upload_and_preserves_owner(
    client, owner_kind, media_kind
):
    store = WrongSizeStorage(mismatch_on=2 if media_kind == "photos" else 1)
    store.objects["existing"] = b"keep"
    app.dependency_overrides[get_storage] = lambda: store
    payload = task_data() if owner_kind == "tasks" else {"payload": {}}
    created = (
        await publish_task(client, json=payload)
        if owner_kind == "tasks"
        else await client.post(f"/api/editor/{owner_kind}", json=payload)
    )
    assert created.status_code == 201, created.text
    owner_id = created.json()["data"]["id"]
    url = f"/api/editor/{owner_kind}/{owner_id}"
    before = (await client.get(url)).json()["data"]
    data = {"revision": str(before["revision"])} if owner_kind == "task-drafts" else {}
    if media_kind == "resources":
        data.update(title="Файл", type="other")
        files = [("file", ("file.txt", b"abc", "text/plain"))]
    else:
        files = [("files", (f"{i}.png", picture(), "image/png")) for i in range(2)]
    response = await client.post(f"{url}/{media_kind}", data=data, files=files)
    assert response.status_code == 503, response.text
    assert response.json()["errors"]["code"] == "upload_size_mismatch"
    assert store.stat_calls == store.mismatch_on
    assert store.objects == {"existing": b"keep"}
    after = (await client.get(url)).json()["data"]
    assert after[media_kind] == before[media_kind]
    assert after["updated_at"] == before["updated_at"]
    if owner_kind == "task-drafts":
        assert after["revision"] == before["revision"]


@pytest.mark.parametrize("media_kind", ["resources", "photos"])
async def test_rollback_failure_does_not_prevent_cleanup_or_mask_mismatch(
    media_kind, caplog
):
    session = AsyncMock(spec=AsyncSession)
    session.scalar.return_value = 0
    # Первая транзакция завершается до передачи файлов, вторая — при компенсации.
    session.rollback.side_effect = [None, RuntimeError("rollback failed")]
    owner = Mock(spec=MediaOwner, wraps=MediaOwner(task_id=1))
    owner.get = AsyncMock()
    store = WrongSizeStorage(mismatch_on=2 if media_kind == "photos" else 1)
    with pytest.raises(UploadSizeMismatchError):
        if media_kind == "resources":
            await resources.upload(
                session,
                owner,
                UploadFile(BytesIO(b"abc"), filename="file.txt"),
                "Файл",
                ResourceType.OTHER,
                store,
            )
        else:
            await photos.upload(
                session,
                owner,
                [UploadFile(BytesIO(picture()), filename=f"{i}.png") for i in range(2)],
                store,
            )
    assert not store.objects
    assert "rollback failed" in caplog.text


async def test_cleanup_continues_after_one_delete_fails(caplog, monkeypatch):
    session = AsyncMock(spec=AsyncSession)
    store = MemoryStorage()
    store.objects = {"first": b"a", "second": b"b"}
    delete = store.delete

    def fail_first(key):
        if key == "first":
            raise RuntimeError("delete failed")
        delete(key)

    monkeypatch.setattr(store, "delete", fail_first)
    await discard_upload(session, store, ["first", "second"])
    assert store.objects == {"first": b"a"}
    assert "delete failed" in caplog.text and "first" in caplog.text
