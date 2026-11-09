"""Признак платного задания, существующие задания остаются бесплатными.

Revision ID: 0a9d72e4b831
Revises: fc806193b753
"""

import sqlalchemy as sa

from alembic import op

revision = "0a9d72e4b831"
down_revision = "fc806193b753"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("is_paid", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("tasks", "is_paid")
