import os
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from testcontainers.community.postgres import PostgresContainer
from testcontainers.core.container import DockerContainer
from testcontainers.core.wait_strategies import HttpWaitStrategy

# До импорта приложения исключаем чтение рабочей БД из .env.
# Реальные подключения в тестах создаются только по адресу контейнера.
os.environ["DATABASE_URL"] = "postgresql://test:test@127.0.0.1:1/not_used"
os.environ["PROJECT_NAME"] = "CodeHunt tests"
os.environ["ADMIN_EMAILS"] = "admin@example.com,other-admin@example.com"
os.environ["GITHUB_ID"] = "test-client"
os.environ["GITHUB_SECRET"] = "test-secret"
os.environ["S3_ENDPOINT_URL"] = "http://127.0.0.1:1"
os.environ["S3_ACCESS_KEY"] = "test"
os.environ["S3_SECRET_KEY"] = "test"
os.environ["S3_BUCKET"] = "codehunt-tests"

from app.api.deps import get_db  # noqa: E402
from app.core.db import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AuthSession, User
from app.services.auth import token_hash  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session")
def postgres():
    """Отдельная PostgreSQL 18 с автоматическим удалением."""
    with PostgresContainer(
        "postgres:18-alpine",
        username="test",
        password="test",
        dbname="codehunt_test",
        driver="psycopg",
    ) as container:
        yield container


@pytest.fixture(scope="session")
def minio_endpoint():
    """MinIO запускается Testcontainers только для тестов реального хранилища."""
    container = (
        DockerContainer("minio/minio")
        .with_env("MINIO_ROOT_USER", "codehunt_test")
        .with_env("MINIO_ROOT_PASSWORD", "codehunt_test_secret")
        .with_exposed_ports(9000)
        .with_command("server /data")
        .waiting_for(HttpWaitStrategy(9000, "/minio/health/ready"))
    )
    with container:
        yield f"http://{container.get_container_host_ip()}:{container.get_exposed_port(9000)}"


@pytest.fixture
async def db(postgres):
    engine = create_async_engine(postgres.get_connection_url(driver="asyncpg"))
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            session.add_all(
                [
                    User(
                        email="admin@example.com",
                        github_id=1,
                        verified_emails=["admin@example.com"],
                        is_admin=True,
                    ),
                    User(
                        email="member@example.com",
                        github_id=2,
                        verified_emails=["member@example.com"],
                        is_admin=False,
                    ),
                    User(
                        email="other-admin@example.com",
                        github_id=3,
                        verified_emails=["other-admin@example.com"],
                        is_admin=True,
                    ),
                ]
            )
            await session.flush()
            session.add_all(
                [
                    AuthSession(
                        token_hash=token_hash(f"test-session-{user_id}"),
                        user_id=user_id,
                        expires_at=datetime.now(UTC) + timedelta(hours=1),
                    )
                    for user_id in (1, 2, 3)
                ]
            )
            await session.commit()
        yield factory
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest.fixture
async def client(db):
    async def override():
        async with db() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": "Bearer test-session-1"},
        ) as http:
            yield http
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def sync_engine(postgres):
    engine = create_engine(postgres.get_connection_url())
    try:
        yield engine
    finally:
        engine.dispose()


def task_data(slug="movie-catalog"):
    return {
        "title": "Каталог фильмов",
        "slug": slug,
        "short_description": "Каталог",
        "full_description": "Создайте каталог фильмов",
        "developer_type": "frontend",
        "difficulty_from": 0,
        "difficulty_to": 10,
        "items": [
            {
                "kind": "complication",
                "title": f"Требование {level}",
                "description": f"Реализуйте {level}",
                "acceptance_criteria": "Работает",
                "level": level,
                "is_required": True,
            }
            for level in ("easy", "medium", "high")
        ],
        "presets": [
            {"level": level, "description": f"Пресет {level}"}
            for level in ("easy", "medium", "high")
        ],
    }


async def add_draft_photo(draft_id: int):
    """Метаданные обложки для тестов предметной области; загрузку байтов проверяют media-тесты."""
    from app.models import TaskPhoto

    async for session in app.dependency_overrides[get_db]():
        session.add(
            TaskPhoto(
                draft_id=draft_id,
                position=1,
                object_key=f"fixture-cover-{draft_id}",
                original_filename="fixture-cover.png",
                content_type="image/png",
                size_bytes=1,
            )
        )
        await session.commit()


async def publish_task(client, *, json, headers=None):
    response = await client.post(
        "/api/editor/task-drafts", json={"payload": json}, headers=headers
    )
    if response.status_code != 201:
        return response
    draft = response.json()["data"]
    await add_draft_photo(draft["id"])
    return await client.post(
        f"/api/editor/task-drafts/{draft['id']}/publish",
        json={"revision": draft["revision"]},
        headers=headers,
    )


def composition_data(detail):
    return [
        item for block in detail["presets"].values() for item in block["complications"]
    ]


def task_write(detail):
    from app.schemas.domain import CompositionUpdate, PresetCreate, TaskCreate

    def item_write(item):
        if item["kind"] == "group":
            return {
                **{key: item[key] for key in ("kind", "id", "title", "level")},
                "items": [item_write(child) for child in item["items"]],
            }
        return {
            key: item[key]
            for key in (
                "kind",
                "id",
                "complication_id",
                "title",
                "description",
                "acceptance_criteria",
                "level",
                "is_required",
            )
        }

    return {
        **{key: detail[key] for key in TaskCreate.model_fields},
        "items": CompositionUpdate(
            items=[item_write(item) for item in composition_data(detail)]
        ).model_dump()["items"],
        "presets": [
            {key: block["preset"][key] for key in PresetCreate.model_fields}
            for block in detail["presets"].values()
            if block["preset"]
        ],
    }


async def save_task(client, base, headers=None, **changes):
    detail = (await client.get(base)).json()["data"]
    return await client.put(
        base, json={**task_write(detail), **changes}, headers=headers
    )


async def make_project(client, slug="movie-catalog", published=True):
    response = await publish_task(client, json=task_data(slug))
    assert response.status_code == 201, response.text
    task = response.json()["data"]
    if not published:
        task = (
            await client.patch(
                f"/api/editor/tasks/{task['id']}", json={"status": "archived"}
            )
        ).json()["data"]
    detail = (await client.get(f"/api/editor/tasks/{task['id']}")).json()["data"]
    links = composition_data(detail)
    presets = [
        value["preset"] for value in detail["presets"].values() if value["preset"]
    ]
    return task, links, presets
