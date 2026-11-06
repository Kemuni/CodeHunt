"""Полноценные черновики с фотографиями и вложениями, публикация без промежуточного Task.draft."""

import sqlalchemy as sa

from alembic import op

revision = "d53ae017b804"
down_revision = "c41f6a92d310"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, prefix in (("task_photos", "photo"), ("task_resources", "resource")):
        op.alter_column(table, "task_id", existing_type=sa.BigInteger(), nullable=True)
        op.add_column(table, sa.Column("draft_id", sa.BigInteger(), nullable=True))
        op.create_foreign_key(
            f"fk_{prefix}_draft",
            table,
            "task_drafts",
            ["draft_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_index(f"ix_{table}_draft_id", table, ["draft_id"])
        op.create_check_constraint(
            f"ck_{prefix}_owner",
            table,
            "(task_id IS NOT NULL) <> (draft_id IS NOT NULL)",
        )
    op.create_unique_constraint(
        "uq_draft_photo_position",
        "task_photos",
        ["draft_id", "position"],
        deferrable=True,
        initially="DEFERRED",
    )
    op.drop_constraint("ck_draft_schema_version", "task_drafts", type_="check")
    op.drop_column("task_drafts", "schema_version")
    # У прежних Task.draft нет автора, поэтому сохраняем их со всеми связями как скрытый архив.
    tasks = sa.table(
        "tasks",
        sa.column("status", sa.String(9)),
        sa.column("is_hidden", sa.Boolean()),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.execute(
        tasks.update()
        .where(tasks.c.status == "draft")
        .values(status="archived", is_hidden=True, updated_at=sa.func.clock_timestamp())
    )
    op.drop_constraint("task_status", "tasks", type_="check")
    op.create_check_constraint(
        "task_status", "tasks", sa.column("status").in_(["published", "archived"])
    )
    op.alter_column(
        "tasks", "status", existing_type=sa.String(9), server_default="published"
    )


def downgrade() -> None:
    # Откат не должен молча удалять вложения ещё не опубликованных черновиков.
    for name in ("task_photos", "task_resources"):
        table = sa.table(name, sa.column("draft_id"))
        if op.get_bind().scalar(
            sa.select(sa.func.count())
            .select_from(table)
            .where(table.c.draft_id.is_not(None))
        ):
            raise RuntimeError(
                "Перед откатом опубликуйте или удалите черновики с файлами"
            )
    op.drop_constraint("uq_draft_photo_position", "task_photos", type_="unique")
    for table, prefix in (("task_photos", "photo"), ("task_resources", "resource")):
        op.drop_constraint(f"ck_{prefix}_owner", table, type_="check")
        op.drop_constraint(f"fk_{prefix}_draft", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_draft_id", table_name=table)
        op.drop_column(table, "draft_id")
        op.alter_column(table, "task_id", existing_type=sa.BigInteger(), nullable=False)
    op.add_column(
        "task_drafts",
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_check_constraint(
        "ck_draft_schema_version", "task_drafts", "schema_version = 1"
    )
    op.drop_constraint("task_status", "tasks", type_="check")
    op.create_check_constraint(
        "task_status",
        "tasks",
        sa.column("status").in_(["draft", "published", "archived"]),
    )
    op.alter_column(
        "tasks", "status", existing_type=sa.String(9), server_default="draft"
    )
