"""Удалить slug общих шаблонов требований.

Downgrade создаёт уникальные slug из ID; прежние значения не восстанавливаются.
"""

import sqlalchemy as sa

from alembic import op

revision = "a73f8d291b06"
down_revision = "e62b9c43a105"
branch_labels = None
depends_on = None


def upgrade():
    # PostgreSQL удаляет и уникальное ограничение, связанное с колонкой.
    op.drop_column("task_complications", "slug")


def downgrade():
    op.add_column(
        "task_complications", sa.Column("slug", sa.String(255), nullable=True)
    )
    op.execute("UPDATE task_complications SET slug = 'template-' || id::text")
    op.alter_column("task_complications", "slug", nullable=False)
    op.create_unique_constraint(
        "task_complications_slug_key", "task_complications", ["slug"]
    )
