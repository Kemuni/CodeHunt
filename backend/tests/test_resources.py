from io import BytesIO

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError
from PIL import Image

from app.core.config import settings
from app.main import app
from app.services import media
from app.services import storage as storage_module
from app.services.storage import S3Storage, get_storage
from tests.conftest import make_project, publish_task, task_data

pytestmark = pytest.mark.anyio


class MemoryStorage:
    def __init__(self):
        self.objects = {}
        self.fail_upload = False
        self.fail_stat = False

    def upload(self, file, key, content_type):
        if self.fail_upload:
            raise EndpointConnectionError(endpoint_url="http://storage.test")
        self.objects[key] = file.read()

    def stat(self, key):
        if self.fail_stat:
            raise EndpointConnectionError(endpoint_url="http://storage.test")
        if key not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "HeadObject")
        return {"ContentLength": len(self.objects[key])}

    def delete(self, key):
        self.objects.pop(key, None)

    def read(self, key):
        self.stat(key)
        return self.objects[key]


async def test_resources_metadata_download_and_compensation(client, monkeypatch):
    store = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: store
    monkeypatch.setattr(media, "get_storage", lambda: store)
    task, _, _ = await make_project(client, published=False)
    base = f"/api/editor/tasks/{task['id']}/resources"
    reply = await client.post(
        base,
        data={"title": "Макет", "type": "design"},
        files={"file": ("design.txt", b"example", "text/plain")},
    )
    assert reply.status_code == 201, reply.text
    resource = reply.json()["data"]
    rid = resource["id"]
    assert (
        resource["size_bytes"] == 7
        and "object_key" not in resource
        and "order_number" not in resource
    )
    assert (await client.get(base.removesuffix("/resources"))).json()["data"][
        "resources"
    ][0]["id"] == rid
    public = f"/api/tasks/by-slug/{task['slug']}"
    assert (await client.get(public)).status_code == 404
    assert resource["url"] == f"/api/media/resources/{rid}"
    assert (await client.get(resource["url"])).status_code == 200
    assert (
        await client.get(
            resource["url"], headers={"Authorization": "Bearer test-session-2"}
        )
    ).status_code == 404
    assert (
        await client.patch(
            base + f"/{rid}", json={"title": "Другой заголовок", "type": "asset"}
        )
    ).status_code == 200
    assert (
        await client.patch(base + f"/{rid}", json={"object_key": "other"})
    ).status_code == 422
    await client.patch(f"/api/editor/tasks/{task['id']}", json={"status": "published"})
    assert (await client.get(public)).status_code == 200
    assert (await client.get(resource["url"])).status_code == 200
    keys = list(store.objects)
    await client.post(
        base,
        data={"title": "Макет", "type": "design"},
        files={"file": ("design.txt", b"example", "text/plain")},
    )
    assert len(store.objects) == 2
    assert (await client.delete(base + f"/{rid}")).status_code == 200
    assert keys[0] not in store.objects
    remaining = (await client.get(base.removesuffix("/resources"))).json()["data"][
        "resources"
    ][0]
    store.objects.clear()
    url = remaining["url"]
    assert (await client.get(url)).status_code == 404
    store.fail_upload = True
    reply = await client.post(
        base, data={"title": "Файл", "type": "other"}, files={"file": ("file", b"abc")}
    )
    assert reply.status_code == 503
    store.fail_upload = False
    store.fail_stat = True
    reply = await client.post(
        base, data={"title": "Файл", "type": "other"}, files={"file": ("file", b"abc")}
    )
    assert reply.status_code == 503 and not store.objects
    monkeypatch.setattr(settings, "MAX_RESOURCE_BYTES", 2)
    assert (
        await client.post(
            base,
            data={"title": "Файл", "type": "other"},
            files={"file": ("file", b"abc")},
        )
    ).status_code == 413


async def test_storage_configuration_error(client, monkeypatch):
    monkeypatch.setattr(settings, "S3_ENDPOINT_URL", None)
    get_storage.cache_clear()
    task = (await publish_task(client, json=task_data())).json()["data"]
    reply = await client.post(
        f"/api/editor/tasks/{task['id']}/resources",
        data={"title": "Файл", "type": "other"},
        files={"file": ("file", b"abc")},
    )
    assert reply.status_code == 503
    assert reply.json()["errors"]["code"] == "storage_not_configured"


async def test_real_minio_upload_download(client, monkeypatch, minio_endpoint):
    from pydantic import SecretStr

    monkeypatch.setattr(settings, "S3_ENDPOINT_URL", minio_endpoint)
    monkeypatch.setattr(settings, "S3_ACCESS_KEY", SecretStr("codehunt_test"))
    monkeypatch.setattr(settings, "S3_SECRET_KEY", SecretStr("codehunt_test_secret"))
    monkeypatch.setattr(settings, "S3_BUCKET", "codehunt-test")
    store = S3Storage()
    try:
        store.client.create_bucket(Bucket=settings.S3_BUCKET)
    except ClientError as exc:
        if exc.response["Error"]["Code"] not in {
            "BucketAlreadyOwnedByYou",
            "BucketAlreadyExists",
        }:
            raise
    app.dependency_overrides[get_storage] = lambda: store
    monkeypatch.setattr(media, "get_storage", lambda: store)
    task = (await publish_task(client, json=task_data())).json()["data"]
    base = f"/api/editor/tasks/{task['id']}/resources"
    reply = await client.post(
        base,
        data={"title": "Файл MinIO", "type": "specification"},
        files={"file": ("spec.txt", b"real minio roundtrip", "text/plain")},
    )
    assert reply.status_code == 201, reply.text
    url = reply.json()["data"]["url"]
    downloaded = await client.get(url)
    assert downloaded.status_code == 200
    assert downloaded.content == b"real minio roundtrip"

    monkeypatch.setattr(media, "get_storage", lambda: store)
    picture = BytesIO()
    Image.new("RGB", (8, 8), "green").save(picture, format="PNG")
    content = picture.getvalue()
    photo_response = await client.post(
        f"/api/editor/tasks/{task['id']}/photos",
        files={"files": ("cover.png", content, "image/png")},
    )
    assert photo_response.status_code == 201, photo_response.text
    photo = photo_response.json()["data"][0]
    assert photo["is_cover"] and photo["content_type"] == "image/png"
    downloaded_photo = await client.get(photo["url"])
    assert downloaded_photo.status_code == 200 and downloaded_photo.content == content
    detail = (await client.get(f"/api/editor/tasks/{task['id']}")).json()["data"]
    assert detail["photos"][0]["id"] == photo["id"]
    assert detail["cover_photo"] == detail["photos"][0]
    listed = (await client.get("/api/tasks")).json()["data"]["items"][0]
    assert listed["cover_photo"]["id"] == photo["id"]
    cover = await client.get(listed["cover_photo"]["url"])
    assert cover.status_code == 200 and cover.content == content

    # Несовпадение размера должно удалить новые объекты и сохранить уже загруженные.
    def stored_keys():
        return {
            obj["Key"]
            for obj in store.client.list_objects_v2(Bucket=settings.S3_BUCKET).get(
                "Contents", []
            )
        }

    existing_keys = stored_keys()
    stat = store.stat

    def wrong_size(key):
        metadata = stat(key)
        metadata["ContentLength"] += 1
        return metadata

    with monkeypatch.context() as patch:
        patch.setattr(store, "stat", wrong_size)
        failed_resource = await client.post(
            base,
            data={"title": "Повреждённый файл", "type": "other"},
            files={"file": ("bad.txt", b"bad", "text/plain")},
        )
        failed_photo = await client.post(
            f"/api/editor/tasks/{task['id']}/photos",
            files={"files": ("bad.png", content, "image/png")},
        )
    for response in (failed_resource, failed_photo):
        assert response.status_code == 503, response.text
        assert response.json()["errors"]["code"] == "upload_size_mismatch"
    assert stored_keys() == existing_keys
    # Это отдельный бакет тестового контейнера; рабочее хранилище не затрагивается.
    for obj in store.client.list_objects_v2(Bucket=settings.S3_BUCKET).get(
        "Contents", []
    ):
        store.delete(obj["Key"])
    assert storage_module.get_storage is get_storage
