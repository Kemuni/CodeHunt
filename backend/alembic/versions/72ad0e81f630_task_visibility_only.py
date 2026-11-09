"""Заменить статус задания единственным признаком видимости.

Revision ID: 72ad0e81f630
Revises: 1b8e93f5c420
"""

import sqlalchemy as sa

from alembic import op

revision = "72ad0e81f630"
down_revision = "1b8e93f5c420"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tasks = sa.table("tasks", sa.column("status"), sa.column("is_hidden"))
    # Архивные задачи не должны стать публичными после удаления статуса.
    op.execute(
        tasks.update().where(tasks.c.status == "archived").values(is_hidden=True)
    )
    op.drop_index("ix_tasks_catalog", table_name="tasks")
    op.drop_constraint("task_status", "tasks", type_="check")
    op.drop_column("tasks", "status")
    op.create_index(
        "ix_tasks_catalog", "tasks", ["is_hidden", "is_paid", "developer_type", "id"]
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_catalog", table_name="tasks")
    op.add_column(
        "tasks",
        sa.Column("status", sa.String(9), nullable=False, server_default="published"),
    )
    op.create_check_constraint(
        "task_status", "tasks", "status IN ('published', 'archived')"
    )
    # Прежнее различие скрытых и архивных задач восстановить невозможно.
    op.create_index("ix_tasks_catalog", "tasks", ["status", "developer_type", "id"])
