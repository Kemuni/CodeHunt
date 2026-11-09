from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.util import load_python_file

from tests.conftest import publish_task, task_data
from tests.test_item_numbering import group, leaf


@pytest.mark.anyio
async def test_visual_number_migration_with_nested_groups(client, sync_engine):
    # Начальная схема создаётся стандартной db-фикстурой через create_all.
    payload = {
        **task_data(),
        "items": [
            group("Внешняя", [group("Внутренняя", [leaf("Первый")])]),
            leaf("Второй"),
            leaf("Средний", "medium"),
            leaf("Максимальный", "high"),
        ],
    }
    response = await publish_task(client, json=payload)
    assert response.status_code == 201, response.text
    migration = load_python_file(
        Path(__file__).parents[1] / "alembic/versions",
        "b84e2c507d19_visual_item_numbers.py",
    )
    position_migration = load_python_file(
        Path(__file__).parents[1] / "alembic/versions",
        "c95f3d608e20_store_only_item_positions.py",
    )
    with sync_engine.connect() as connection:
        transaction = connection.begin()
        try:
            links = sa.table(
                "task_complication_links",
                sa.column("id"),
                sa.column("title"),
                sa.column("order_number"),
            )

            def snapshot():
                metadata = sa.MetaData()
                return {
                    name: connection.execute(sa.select(table).order_by(table.c.id))
                    .mappings()
                    .all()
                    for name in (
                        "task_complication_links",
                        "task_complication_link_groups",
                    )
                    for table in [sa.Table(name, metadata, autoload_with=connection)]
                }

            original = snapshot()
            with Operations.context(MigrationContext.configure(connection)):
                position_migration.downgrade()
                before = connection.execute(sa.select(links).order_by(links.c.id)).all()
                assert dict(
                    connection.execute(
                        sa.select(links.c.title, links.c.order_number)
                    ).all()
                ) == {
                    "Первый": 1,
                    "Второй": 2,
                    "Средний": 1,
                    "Максимальный": 1,
                }
                migration.downgrade()
                # Старый формат: нумерация с нуля среди соседей.
                legacy = dict(
                    connection.execute(
                        sa.select(links.c.title, links.c.order_number)
                    ).all()
                )
                assert legacy == {
                    "Первый": 0,
                    "Второй": 1,
                    "Средний": 0,
                    "Максимальный": 0,
                }
                migration.upgrade()
                assert (
                    connection.execute(sa.select(links).order_by(links.c.id)).all()
                    == before
                )
                position_migration.upgrade()
                assert snapshot() == original
                for name in original:
                    inspector = sa.inspect(connection)
                    assert "order_number" not in {
                        column["name"] for column in inspector.get_columns(name)
                    }
                    assert all(
                        "order_number" not in index["column_names"]
                        for index in inspector.get_indexes(name)
                    )
                position_migration.downgrade()
                assert (
                    connection.execute(sa.select(links).order_by(links.c.id)).all()
                    == before
                )
                position_migration.upgrade()
                assert snapshot() == original
                # Повторный цикл проверяет DDL после UPDATE в одной транзакции.
                position_migration.downgrade()
                migration.downgrade()
                migration.upgrade()
                assert (
                    connection.execute(sa.select(links).order_by(links.c.id)).all()
                    == before
                )
                position_migration.upgrade()
                assert snapshot() == original
        finally:
            transaction.rollback()
