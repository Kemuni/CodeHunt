from unittest.mock import AsyncMock, Mock
from urllib.parse import quote

import pytest
from fastapi import FastAPI, Request
from redis.exceptions import ConnectionError
from testcontainers.core.container import DockerContainer

from app.core.config import settings
from app.main import app
from app.services import media, media_cache
from app.services.media_cache import MediaCache, get_media_cache
from app.services.storage import get_storage
from tests.conftest import add_draft_photo, make_project, task_data
from tests.test_grouped_tasks import image_bytes
from tests.test_resources import MemoryStorage

pytestmark = pytest.mark.anyio


async def test_cache_dependency_reuses_fallback_and_prefers_app_cache(monkeypatch):
    test_app = FastAPI()
    request = Request({"type": "http", "app": test_app})
    configured = MediaCache(None)
    constructor = Mock(side_effect=AssertionError("Создание кэша во время запроса"))
    monkeypatch.setattr(media_cache, "MediaCache", constructor)
    fallback = get_media_cache(request)
    assert get_media_cache(request) is fallback
    assert fallback.client is None
    assert await fallback.get("missing") is None
    await fallback.put("missing", b"photo")
    test_app.state.media_cache = configured
    assert get_media_cache(request) is configured
    constructor.assert_not_called()


@pytest.fixture(scope="session")
def redis_url():
    with DockerContainer("redis:7-alpine").with_exposed_ports(6379) as container:
        yield f"redis://{container.get_container_host_ip()}:{container.get_exposed_port(6379)}/0"


@pytest.fixture
async def cache(redis_url):
    instance = MediaCache(redis_url)
    try:
        yield instance
    finally:
        await instance.close()


@pytest.fixture
def store(monkeypatch):
    instance = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: instance
    monkeypatch.setattr(media, "get_storage", lambda: instance)
    return instance


async def test_proxy_caches_bytes_but_rechecks_access_and_etags(
    client, store, cache, monkeypatch
):
    app.dependency_overrides[get_media_cache] = lambda: cache
    monkeypatch.setattr(settings, "MEDIA_CACHE_TTL", 30)
    task, _, _ = await make_project(client)
    task_id = task["id"]
    response = await client.post(
        f"/api/editor/tasks/{task_id}/photos",
        files={"files": ("photo.png", image_bytes(), "image/png")},
    )
    assert response.status_code == 201, response.text
    photo = response.json()["data"][-1]
    url = photo["url"]
    assert url == f"/api/media/photos/{photo['id']}"
    assert "expires_in" not in photo
    client.headers.pop("authorization")
    first = await client.get(url)
    assert first.status_code == 200 and first.content == image_bytes()
    assert first.headers["content-type"] == "image/png"
    assert first.headers["cache-control"] == "private, no-cache"
    etag = first.headers["etag"]
    head = await client.head(url)
    assert head.content == b"" and int(head.headers["content-length"]) == len(
        image_bytes()
    )
    assert (
        await client.get(url, headers={"If-None-Match": f'"other", W/{etag}'})
    ).status_code == 304
    key = f"media:v1:{settings.S3_BUCKET}:{next(iter(store.objects))}"
    assert cache.client is not None
    assert 0 < await cache.client.ttl(key) <= 30
    store.objects.clear()  # Повторный GET читает байты из Redis, не из MinIO.
    assert (await client.get(url)).content == image_bytes()
    assert (
        await client.patch(
            f"/api/editor/tasks/{task_id}",
            headers={"Authorization": "Bearer test-session-1"},
            json={"is_hidden": True},
        )
    ).status_code == 200
    assert (await client.get(url)).status_code == 404
    denied = await client.get(url, headers={"If-None-Match": etag})
    assert denied.status_code == 404 and denied.headers["cache-control"] == "no-store"
    assert (
        await client.get(url, headers={"Authorization": "Bearer test-session-2"})
    ).status_code == 404
    assert (
        await client.get(url, headers={"Authorization": "Bearer test-session-999"})
    ).status_code == 401
    assert (
        await client.get(url, headers={"Authorization": "Bearer test-session-1"})
    ).content == image_bytes()
    assert (
        await client.put(
            f"/api/editor/tasks/{task_id}/photos",
            headers={"Authorization": "Bearer test-session-1"},
            json={"photo_ids": [task["photos"][0]["id"]]},
        )
    ).status_code == 200
    assert (
        await client.get(
            url,
            headers={"Authorization": "Bearer test-session-1", "If-None-Match": etag},
        )
    ).status_code == 404


async def test_draft_photo_owner_publication_and_cache_outage(
    client, store, cache, monkeypatch
):
    app.dependency_overrides[get_media_cache] = lambda: cache
    assert cache.client is not None
    monkeypatch.setattr(cache.client, "get", AsyncMock(side_effect=ConnectionError()))
    monkeypatch.setattr(cache.client, "set", AsyncMock(side_effect=ConnectionError()))
    draft = (
        await client.post("/api/editor/task-drafts", json={"payload": task_data()})
    ).json()["data"]
    uploaded = await client.post(
        f"/api/editor/task-drafts/{draft['id']}/photos",
        data={"revision": draft["revision"]},
        files={"files": ("draft.png", image_bytes(), "image/png")},
    )
    assert uploaded.status_code == 201, uploaded.text
    draft = uploaded.json()["data"]
    url = draft["photos"][0]["url"]
    assert store.objects
    assert (await client.get(url)).content == image_bytes()
    assert (
        await client.get(url, headers={"Authorization": "Bearer test-session-3"})
    ).status_code == 404
    assert (
        await client.get(url, headers={"Authorization": "Bearer test-session-2"})
    ).status_code == 404
    client.headers.pop("authorization")
    assert (await client.get(url)).status_code == 404
    published = await client.post(
        f"/api/editor/task-drafts/{draft['id']}/publish",
        headers={"Authorization": "Bearer test-session-1"},
        json={"revision": draft["revision"]},
    )
    assert published.status_code == 201, published.text
    assert published.json()["data"]["photos"][0]["url"] == url
    assert (await client.get(url)).content == image_bytes()
    assert (await client.get(url)).status_code == 200
    assert (
        await client.get(
            url,
            headers={"Authorization": "Bearer test-session-2"},
        )
    ).status_code == 200


@pytest.mark.parametrize("body", [b"project attachment", b""])
async def test_resource_cache_download_headers_and_access(client, store, cache, body):
    app.dependency_overrides[get_media_cache] = lambda: cache
    task, _, _ = await make_project(client)
    base = f"/api/editor/tasks/{task['id']}"
    filename = "Техническое задание #1.txt"
    uploaded = await client.post(
        base + "/resources",
        data={"title": "Описание", "type": "specification"},
        files={"file": (filename, body, "text/plain")},
    )
    assert uploaded.status_code == 201, uploaded.text
    resource_id = uploaded.json()["data"]["id"]
    url = uploaded.json()["data"]["url"]
    assert url == f"/api/media/resources/{resource_id}"
    detail = (await client.get(base)).json()["data"]["resources"][0]
    assert detail["url"] == url and "expires_in" not in detail
    client.headers.pop("authorization")
    first = await client.get(url)
    assert first.status_code == 200 and first.content == body
    assert first.headers["content-type"].startswith("text/plain")
    assert first.headers["cache-control"] == "private, no-cache"
    assert (
        first.headers["content-disposition"]
        == f"attachment; filename*=UTF-8''{quote(filename, safe='')}"
    )
    etag = first.headers["etag"]
    key = f"media:v1:{settings.S3_BUCKET}:{next(iter(store.objects))}"
    assert cache.client is not None
    assert await cache.client.get(key) == body
    assert 0 < await cache.client.ttl(key) <= settings.MEDIA_CACHE_TTL
    store.objects.clear()
    # Даже пустой файл должен возвращаться из Redis без повторного чтения MinIO.
    assert (await client.get(url)).content == body
    head = await client.head(url)
    assert head.status_code == 200 and head.content == b""
    assert head.headers["content-length"] == str(len(body))
    assert head.headers["content-disposition"] == first.headers["content-disposition"]
    conditional = await client.get(url, headers={"If-None-Match": etag})
    assert conditional.status_code == 304 and conditional.content == b""
    for update in ({"is_hidden": True}, {"is_hidden": True}):
        assert (
            await client.patch(
                base, headers={"Authorization": "Bearer test-session-1"}, json=update
            )
        ).status_code == 200
        denied = await client.get(url, headers={"If-None-Match": etag})
        assert (
            denied.status_code == 404 and denied.headers["cache-control"] == "no-store"
        )
        assert (await client.head(url)).status_code == 404
        editor = url
        assert (
            await client.get(editor, headers={"Authorization": "Bearer test-session-1"})
        ).content == body
        assert (
            await client.get(editor, headers={"Authorization": "Bearer test-session-2"})
        ).status_code == 404
    assert (
        await client.delete(
            base + f"/resources/{resource_id}",
            headers={"Authorization": "Bearer test-session-1"},
        )
    ).status_code == 200
    assert (
        await client.get(
            url,
            headers={"Authorization": "Bearer test-session-1", "If-None-Match": etag},
        )
    ).status_code == 404


@pytest.mark.parametrize("publish", [True, False])
async def test_draft_resource_cache_owner_and_publication_or_deletion(
    client, store, cache, publish
):
    app.dependency_overrides[get_media_cache] = lambda: cache
    draft = (
        await client.post("/api/editor/task-drafts", json={"payload": task_data()})
    ).json()["data"]
    base = f"/api/editor/task-drafts/{draft['id']}"
    uploaded = await client.post(
        base + "/resources",
        data={"revision": draft["revision"]},
        files={"file": ("draft.zip", b"draft bytes", "application/zip")},
    )
    assert uploaded.status_code == 201, uploaded.text
    draft = uploaded.json()["data"]
    file = draft["resources"][0]
    url = file["url"]
    first = await client.get(url)
    assert first.status_code == 200 and first.content == b"draft bytes"
    store.objects.clear()
    etag = first.headers["etag"]
    for user in ("2", "3"):
        assert (
            await client.get(
                url,
                headers={
                    "Authorization": f"Bearer test-session-{user}",
                    "If-None-Match": etag,
                },
            )
        ).status_code == 404
    client.headers.pop("authorization")
    assert (await client.get(url, headers={"If-None-Match": etag})).status_code == 404
    editor = url
    assert (
        await client.get(editor, headers={"Authorization": "Bearer test-session-1"})
    ).content == b"draft bytes"
    if publish:
        await add_draft_photo(draft["id"])
        published = await client.post(
            base + "/publish",
            headers={"Authorization": "Bearer test-session-1"},
            json={"revision": draft["revision"]},
        )
        assert published.status_code == 201, published.text
        assert published.json()["data"]["resources"][0]["url"] == url
        assert (await client.get(url)).content == b"draft bytes"
        assert (
            await client.get(url, headers={"If-None-Match": etag})
        ).status_code == 304
    else:
        deleted = await client.delete(
            base + f"/resources/{file['id']}?revision={draft['revision']}",
            headers={"Authorization": "Bearer test-session-1"},
        )
        assert deleted.status_code == 200, deleted.text
        assert (
            await client.get(
                editor,
                headers={
                    "Authorization": "Bearer test-session-1",
                    "If-None-Match": etag,
                },
            )
        ).status_code == 404
