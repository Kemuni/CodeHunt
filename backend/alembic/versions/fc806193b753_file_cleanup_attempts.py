"""Счётчик попыток очистки и индекс ключей вложений.

Revision ID: fc806193b753
Revises: eb7f5082a642
"""

import sqlalchemy as sa

from alembic import op

revision = "fc806193b753"
down_revision = "eb7f5082a642"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pending_file_deletions",
        sa.Column("attempt_count", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.create_index("ix_task_resources_object_key", "task_resources", ["object_key"])


def downgrade() -> None:
    op.drop_index("ix_task_resources_object_key", table_name="task_resources")
    op.drop_column("pending_file_deletions", "attempt_count")
