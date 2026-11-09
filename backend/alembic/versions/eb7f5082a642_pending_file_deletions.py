"""Очередь удаления файлов из MinIO после commit.

Revision ID: eb7f5082a642
Revises: da6e4f719f31
"""

import sqlalchemy as sa

from alembic import op

revision = "eb7f5082a642"
down_revision = "da6e4f719f31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_file_deletions",
        sa.Column("bucket", sa.String(255), primary_key=True),
        sa.Column("object_key", sa.Text(), primary_key=True),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_pending_file_deletions_next_attempt_at",
        "pending_file_deletions",
        ["next_attempt_at"],
    )


def downgrade() -> None:
    op.drop_table("pending_file_deletions")
