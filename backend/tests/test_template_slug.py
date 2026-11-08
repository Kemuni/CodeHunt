import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, text

from app.main import app
from app.models import TaskComplication


def test_template_contract_has_no_slug():
    schemas = app.openapi()["components"]["schemas"]
    for name in ("TemplateCreate", "TemplateUpdate", "TemplateRead"):
        assert "slug" not in schemas[name]["properties"]
        assert "slug" not in schemas[name].get("required", [])
    assert "slug" not in TaskComplication.__table__.columns
    assert "slug" in schemas["TaskRead"]["properties"]


def test_remove_template_slug_migration_preserves_records_and_references(sync_engine):
    path = (
        Path(__file__).parents[1]
        / "alembic/versions/a73f8d291b06_remove_template_slug.py"
    )
    spec = importlib.util.spec_from_file_location("remove_template_slug", path)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with sync_engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(
                text(
                    "CREATE TABLE task_complications (id BIGINT PRIMARY KEY, "
                    "slug VARCHAR(255) NOT NULL UNIQUE, title VARCHAR(150) NOT NULL)"
                )
            )
            connection.execute(
                text(
                    "CREATE TABLE template_references (complication_id BIGINT "
                    "REFERENCES task_complications(id))"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO task_complications VALUES (1, 'old-one', 'First'), (2, 'old-two', 'Second')"
                )
            )
            connection.execute(text("INSERT INTO template_references VALUES (1), (2)"))
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                assert "slug" not in {
                    column["name"]
                    for column in inspect(connection).get_columns("task_complications")
                }
                assert (
                    inspect(connection).get_unique_constraints("task_complications")
                    == []
                )
                assert connection.execute(
                    text("SELECT id, title FROM task_complications ORDER BY id")
                ).all() == [(1, "First"), (2, "Second")]
                assert connection.execute(
                    text(
                        "SELECT complication_id FROM template_references ORDER BY complication_id"
                    )
                ).scalars().all() == [1, 2]
                connection.execute(
                    text("INSERT INTO task_complications VALUES (3, 'Third')")
                )
                migration.downgrade()
                assert connection.execute(
                    text("SELECT slug FROM task_complications ORDER BY id")
                ).scalars().all() == ["template-1", "template-2", "template-3"]
                slug = next(
                    column
                    for column in inspect(connection).get_columns("task_complications")
                    if column["name"] == "slug"
                )
                assert not slug["nullable"]
                assert inspect(connection).get_unique_constraints("task_complications")[
                    0
                ]["column_names"] == ["slug"]
                migration.upgrade()
        finally:
            transaction.rollback()
