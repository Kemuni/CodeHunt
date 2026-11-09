from datetime import UTC, datetime

import pytest
from sqlalchemy import inspect, select, text, update
from sqlalchemy.exc import IntegrityError

from app.core.db import Base
from app.models import TaskSolution, User


@pytest.mark.anyio
async def test_database_constraints_and_generated_status(client, sync_engine):
    from tests.conftest import make_project

    task, _, presets = await make_project(client)
    reply = await client.post(
        f"/api/tasks/{task['id']}/solutions",
        json={"author_id": 1, "task_level_preset_id": presets[0]["id"]},
    )
    solution = reply.json()["data"]
    with sync_engine.begin() as conn:
        old = conn.scalar(
            select(TaskSolution.updated_at).where(TaskSolution.id == solution["id"])
        )
        row = conn.execute(
            update(TaskSolution)
            .where(TaskSolution.id == solution["id"])
            .values(resolved_at=datetime.now(UTC))
            .returning(TaskSolution.status, TaskSolution.updated_at)
        ).one()
        assert row.status == "completed" and row.updated_at > old
    for sql in [
        "UPDATE tasks SET difficulty_from=-1",
        "UPDATE tasks SET difficulty_to=11",
        "UPDATE tasks SET difficulty_from=9, difficulty_to=1",
        "UPDATE tasks SET developer_type='backend'",
        "UPDATE tasks SET parent_task_id=id",
        "UPDATE task_solutions SET difficulty_rating=11",
        "UPDATE task_solutions SET task_id=9999",
        "UPDATE task_complication_links SET position=-1",
    ]:
        with pytest.raises(IntegrityError), sync_engine.begin() as conn:
            conn.execute(text(sql))
    with sync_engine.begin() as conn:
        count = conn.execute(
            text(
                "SELECT count(*) FROM pg_constraint WHERE conrelid='tasks'::regclass AND conname='task_status'"
            )
        ).scalar_one()
        assert count == 1


def test_metadata_schema_lifecycle(sync_engine):
    assert inspect(sync_engine).get_table_names() == []
    with sync_engine.begin() as connection:
        Base.metadata.create_all(connection)
    tables = set(inspect(sync_engine).get_table_names())
    assert {"tasks", "users", "task_drafts", "contact_requests"}.issubset(tables)
    assert "alembic_version" not in tables
    with sync_engine.begin() as connection:
        Base.metadata.drop_all(connection)
    assert inspect(sync_engine).get_table_names() == []


@pytest.mark.anyio
async def test_timestamps_update_through_orm_and_core(db):
    async with db() as session:
        user = await session.get(User, 1)
        assert user is not None
        created_at, previous_update = user.created_at, user.updated_at
        assert created_at.tzinfo is not None and previous_update.tzinfo is not None
        user.email = "updated@example.com"
        await session.flush()
        await session.refresh(user)
        assert user.created_at == created_at and user.updated_at > previous_update
        previous_update = user.updated_at
        # Повторный UPDATE в той же транзакции также должен менять дату.
        await session.execute(
            update(Base.metadata.tables[User.__tablename__])
            .where(User.id == user.id)
            .values(is_admin=False)
        )
        await session.refresh(user)
        assert user.created_at == created_at and user.updated_at > previous_update
        previous_update = user.updated_at
        # Прямой SQL не вызывает onupdate SQLAlchemy.
        await session.execute(
            text("UPDATE users SET is_admin=true WHERE id=:id"), {"id": user.id}
        )
        await session.refresh(user)
        assert user.updated_at == previous_update


@pytest.mark.anyio
async def test_explicit_demo_seed_is_repeatable(db, monkeypatch):
    from sqlalchemy import func, select

    from app.models import (
        Task,
        TaskComplication,
        TaskComplicationLink,
        TaskLevelPreset,
        User,
    )
    from scripts import seed_demo

    monkeypatch.setattr(seed_demo, "async_session_maker", db)
    await seed_demo.seed()
    await seed_demo.seed()
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(Task)) == 2
        assert (
            await session.scalar(select(func.count()).select_from(TaskComplication))
            == 1
        )
        assert (
            await session.scalar(select(func.count()).select_from(TaskLevelPreset)) == 6
        )
        assert (
            await session.scalar(select(func.count()).select_from(TaskComplicationLink))
            == 6
        )
        assert await session.scalar(select(func.count()).select_from(User)) == 3
