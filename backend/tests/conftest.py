import os

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

from app.api.deps import get_db  # noqa: E402
from app.core.db import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402


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
                    User(email="admin@example.com", is_admin=True),
                    User(email="member@example.com", is_admin=False),
                    User(email="other-admin@example.com", is_admin=True),
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
            headers={"X-User-ID": "1"},
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


async def make_project(client, slug="movie-catalog", published=True):
    response = await client.post("/api/editor/tasks", json=task_data(slug))
    assert response.status_code == 201, response.text
    task = response.json()["data"]
    if not published:
        task = (
            await client.patch(
                f"/api/editor/tasks/{task['id']}", json={"status": "archived"}
            )
        ).json()["data"]
    detail = (await client.get(f"/api/editor/tasks/{task['id']}")).json()["data"]
    return task, detail["complications"], detail["presets"]
