"""Вложенные группы требований, фотографии и скрытие заданий.

Ревизия: c41f6a92d310
Предыдущая ревизия: f08cc2ccff62
"""

import sqlalchemy as sa

from alembic import op

revision = "c41f6a92d310"
down_revision = "f08cc2ccff62"
branch_labels = None
depends_on = None


def dates():
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    op.drop_index(
        "ix_task_complication_categories_group",
        table_name="task_complication_categories",
    )
    op.drop_constraint("category_group", "task_complication_categories", type_="check")
    op.drop_column("task_complication_categories", "group")
    op.add_column(
        "tasks",
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_table(
        "task_complication_link_groups",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "task_id",
            sa.BigInteger(),
            sa.ForeignKey("tasks.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("parent_group_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("order_number", sa.Integer(), server_default="0", nullable=False),
        *dates(),
        sa.UniqueConstraint("task_id", "id", name="uq_link_group_task_id"),
        sa.ForeignKeyConstraint(
            ["task_id", "parent_group_id"],
            [
                "task_complication_link_groups.task_id",
                "task_complication_link_groups.id",
            ],
            ondelete="RESTRICT",
            name="fk_link_group_parent",
        ),
        sa.CheckConstraint("parent_group_id <> id", name="ck_link_group_parent"),
        sa.CheckConstraint("order_number >= 0", name="ck_link_group_order"),
    )
    op.create_index(
        "ix_link_groups_tree",
        "task_complication_link_groups",
        ["task_id", "parent_group_id", "order_number"],
    )
    op.add_column(
        "task_complication_links", sa.Column("group_id", sa.BigInteger(), nullable=True)
    )
    op.create_index(
        "ix_task_complication_links_group_id", "task_complication_links", ["group_id"]
    )
    op.create_foreign_key(
        "fk_task_link_group",
        "task_complication_links",
        "task_complication_link_groups",
        ["task_id", "group_id"],
        ["task_id", "id"],
        ondelete="RESTRICT",
    )
    op.create_table(
        "task_photos",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "task_id",
            sa.BigInteger(),
            sa.ForeignKey("tasks.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False, unique=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        *dates(),
        sa.UniqueConstraint(
            "task_id",
            "position",
            name="uq_task_photo_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        sa.CheckConstraint("position BETWEEN 1 AND 4", name="ck_task_photo_position"),
        sa.CheckConstraint("size_bytes > 0", name="ck_task_photo_size"),
    )
    op.create_index("ix_task_photos_task_id", "task_photos", ["task_id"])


def downgrade() -> None:
    op.drop_table("task_photos")
    op.drop_constraint(
        "fk_task_link_group", "task_complication_links", type_="foreignkey"
    )
    op.drop_index(
        "ix_task_complication_links_group_id", table_name="task_complication_links"
    )
    op.drop_column("task_complication_links", "group_id")
    op.drop_table("task_complication_link_groups")
    op.drop_column("tasks", "is_hidden")
    # Удалённую классификацию восстановить нельзя, при откате назначаем functionality.
    op.add_column(
        "task_complication_categories",
        sa.Column(
            "group", sa.String(14), server_default="functionality", nullable=False
        ),
    )
    op.create_check_constraint(
        "category_group",
        "task_complication_categories",
        sa.column("group").in_(
            [
                "functionality",
                "interface",
                "quality",
                "security",
                "infrastructure",
                "architecture",
            ]
        ),
    )
    op.create_index(
        "ix_task_complication_categories_group",
        "task_complication_categories",
        ["group"],
    )
    op.alter_column("task_complication_categories", "group", server_default=None)
