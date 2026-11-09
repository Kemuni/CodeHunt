"""Идентичность GitHub обязательна для каждого пользователя.

Revision ID: 1b8e93f5c420
Revises: 0a9d72e4b831
"""

import sqlalchemy as sa

from alembic import op

revision = "1b8e93f5c420"
down_revision = "0a9d72e4b831"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Нельзя придумывать GitHub ID или удалять пользователей вместе с их данными.
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM users WHERE github_id IS NULL")
    ):
        raise RuntimeError(
            "Есть пользователи без github_id. Свяжите их с подтверждёнными GitHub-аккаунтами перед повторным запуском миграции."
        )
    op.alter_column("users", "github_id", existing_type=sa.BigInteger(), nullable=False)


def downgrade() -> None:
    op.alter_column("users", "github_id", existing_type=sa.BigInteger(), nullable=True)
