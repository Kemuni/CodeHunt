import re

import pytest
from pydantic import SecretStr, ValidationError
from sqlalchemy import event

from app.core.config import settings
from app.core.errors import DomainError, NotFoundError, ParentCycleError
from app.main import app
from app.models import TaskComplicationCategory
from app.schemas.domain import CategoryUpdate, LinkUpdate, TaskUpdate
from app.services.common import check_parent
from app.services.storage import S3Storage


@pytest.mark.anyio
async def test_parent_chain_uses_one_query_and_handles_existing_cycles(db):
    async with db() as session:
        nodes = []
        for index in range(20):
            node = TaskComplicationCategory(
                title=f"Категория {index}",
                developer_type="frontend",
                parent_id=nodes[-1].id if nodes else None,
            )
            session.add(node)
            await session.flush()
            nodes.append(node)
        queries = []

        def record(_conn, _cursor, statement, _parameters, _context, _executemany):
            queries.append(statement)

        bind = session.bind
        assert bind is not None
        event.listen(bind.sync_engine, "before_cursor_execute", record)
        try:
            await check_parent(
                session, TaskComplicationCategory, nodes[-1].id, None, "parent_id"
            )
            assert len(queries) == 1 and "WITH RECURSIVE" in queries[0]
            queries.clear()
            with pytest.raises(DomainError, match="цикл"):
                await check_parent(
                    session,
                    TaskComplicationCategory,
                    nodes[-1].id,
                    nodes[0].id,
                    "parent_id",
                )
            assert len(queries) == 1
            # Повреждённые данные могли появиться через SQL: UNION не должен зависнуть.
            nodes[0].parent_id = nodes[-1].id
            await session.flush()
            queries.clear()
            with pytest.raises(DomainError, match="цикл"):
                await check_parent(
                    session, TaskComplicationCategory, nodes[-1].id, None, "parent_id"
                )
            assert len(queries) == 1
        finally:
            event.remove(bind.sync_engine, "before_cursor_execute", record)


def test_explicit_patch_schemas_distinguish_missing_and_null():
    for schema in [CategoryUpdate, TaskUpdate, LinkUpdate]:
        assert schema().model_dump(exclude_unset=True) == {}
        with pytest.raises(ValidationError):
            schema(title=None)
        with pytest.raises(ValidationError):
            schema(title="")
    assert TaskUpdate(design_author_name=None).model_dump(exclude_unset=True) == {
        "design_author_name": None
    }
    assert LinkUpdate(complication_id=None).model_dump(exclude_unset=True) == {
        "complication_id": None
    }


def test_named_errors_have_defaults_and_allow_message_overrides():
    error = NotFoundError()
    assert error.status == 404 and error.code == "not_found"
    assert str(error) == error.message == "Объект не найден"
    details = [{"field": "parent_id", "code": "parent_cycle"}]
    cycle = ParentCycleError("Родитель образует цикл", details=details)
    assert isinstance(cycle, DomainError)
    assert cycle.status == 422 and cycle.code == "parent_cycle"
    assert str(cycle) == cycle.message == "Родитель образует цикл"
    assert cycle.details == details
    assert ParentCycleError().message == "Иерархия не может содержать цикл"


def test_swagger_operations_have_russian_summaries_without_duplicates():
    for path in app.openapi()["paths"].values():
        for operation in path.values():
            assert re.search("[А-Яа-я]", operation["summary"])
            assert ";" not in operation["summary"]
            assert "description" not in operation


def test_signed_urls_use_public_endpoint(monkeypatch):
    monkeypatch.setattr(settings, "S3_ENDPOINT_URL", "http://minio:9000")
    monkeypatch.setattr(settings, "S3_PUBLIC_ENDPOINT_URL", "http://localhost:19000")
    monkeypatch.setattr(settings, "S3_ACCESS_KEY", SecretStr("test"))
    monkeypatch.setattr(settings, "S3_SECRET_KEY", SecretStr("test-secret"))
    storage = S3Storage()
    assert storage.client.meta.endpoint_url == "http://minio:9000"
    assert storage.get_download_url("tasks/file.txt").startswith(
        "http://localhost:19000/"
    )
