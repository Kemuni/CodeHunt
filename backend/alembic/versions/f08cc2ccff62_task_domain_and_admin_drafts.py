"""Модели заданий и черновики администраторов

Ревизия: f08cc2ccff62
Предыдущая ревизия: ff0767990d87
Дата создания: 2026-11-02 00:19:00.963455

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# Идентификаторы ревизии для Alembic.
revision: str = "f08cc2ccff62"
down_revision: str | Sequence[str] | None = "ff0767990d87"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Применить изменения схемы."""
    # Команды, первоначально сформированные Alembic.
    op.create_table(
        "task_complication_categories",
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "developer_type",
            sa.Enum(
                "frontend",
                "fullstack",
                name="category_developer_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "group",
            sa.Enum(
                "functionality",
                "interface",
                "quality",
                "security",
                "infrastructure",
                "architecture",
                name="category_group",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint("parent_id <> id", name="ck_category_parent"),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["task_complication_categories.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_task_complication_categories_developer_type"),
        "task_complication_categories",
        ["developer_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_task_complication_categories_group"),
        "task_complication_categories",
        ["group"],
        unique=False,
    )
    op.create_index(
        op.f("ix_task_complication_categories_parent_id"),
        "task_complication_categories",
        ["parent_id"],
        unique=False,
    )
    op.create_table(
        "tasks",
        sa.Column("parent_task_id", sa.BigInteger(), nullable=True),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("short_description", sa.String(length=300), nullable=False),
        sa.Column("full_description", sa.Text(), nullable=False),
        sa.Column(
            "developer_type",
            sa.Enum(
                "frontend",
                "fullstack",
                name="task_developer_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("difficulty_from", sa.SmallInteger(), nullable=False),
        sa.Column("difficulty_to", sa.SmallInteger(), nullable=False),
        sa.Column("design_author_name", sa.String(length=255), nullable=True),
        sa.Column("design_author_link", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "published",
                "archived",
                name="task_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "difficulty_from >= 0 AND difficulty_to <= 10 AND difficulty_from <= difficulty_to",
            name="ck_task_difficulty",
        ),
        sa.CheckConstraint("parent_task_id <> id", name="ck_task_parent"),
        sa.ForeignKeyConstraint(["parent_task_id"], ["tasks.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "ix_tasks_catalog", "tasks", ["status", "developer_type", "id"], unique=False
    )
    op.create_index(
        op.f("ix_tasks_parent_task_id"), "tasks", ["parent_task_id"], unique=False
    )
    op.create_table(
        "users",
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "is_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "task_complications",
        sa.Column("category_id", sa.BigInteger(), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["task_complication_categories.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        op.f("ix_task_complications_category_id"),
        "task_complications",
        ["category_id"],
        unique=False,
    )
    op.create_table(
        "task_drafts",
        sa.Column("owner_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("schema_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("revision", sa.Integer(), server_default="1", nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("jsonb_typeof(payload) = 'object'", name="ck_draft_payload"),
        sa.CheckConstraint("revision > 0", name="ck_draft_revision"),
        sa.CheckConstraint("schema_version = 1", name="ck_draft_schema_version"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_drafts_owner_updated",
        "task_drafts",
        ["owner_id", "updated_at", "id"],
        unique=False,
    )
    op.create_table(
        "task_level_presets",
        sa.Column("task_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "level",
            sa.Enum(
                "easy",
                "medium",
                "high",
                name="preset_level",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("average_days_to_complete", sa.SmallInteger(), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("average_days_to_complete > 0", name="ck_preset_days"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "id", name="uq_task_preset_task_id"),
        sa.UniqueConstraint("task_id", "level", name="uq_task_preset_level"),
    )
    op.create_table(
        "task_resources",
        sa.Column("task_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "design",
                "specification",
                "asset",
                "other",
                name="resource_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("size_bytes >= 0", name="ck_resource_size"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_task_resources_task_id"), "task_resources", ["task_id"], unique=False
    )
    op.create_table(
        "task_complication_links",
        sa.Column("task_id", sa.BigInteger(), nullable=False),
        sa.Column("complication_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("acceptance_criteria", sa.Text(), nullable=False),
        sa.Column(
            "level",
            sa.Enum(
                "easy",
                "medium",
                "high",
                name="task_link_level",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "is_required", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("order_number", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("order_number >= 0", name="ck_task_link_order"),
        sa.ForeignKeyConstraint(
            ["complication_id"], ["task_complications.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_task_complication_links_complication_id"),
        "task_complication_links",
        ["complication_id"],
        unique=False,
    )
    op.create_index(
        "ix_task_links_composition",
        "task_complication_links",
        ["task_id", "level", "order_number", "id"],
        unique=False,
    )
    op.create_table(
        "task_solutions",
        sa.Column("task_id", sa.BigInteger(), nullable=False),
        sa.Column("task_level_preset_id", sa.BigInteger(), nullable=False),
        sa.Column("author_id", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("difficulty_rating", sa.SmallInteger(), nullable=True),
        sa.Column("github_link", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            sa.Computed(
                "CASE WHEN resolved_at IS NULL THEN 'in_progress' ELSE 'completed' END",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.Column("task_title_snapshot", sa.String(length=255), nullable=False),
        sa.Column("task_description_snapshot", sa.Text(), nullable=False),
        sa.Column(
            "preset_level_snapshot",
            sa.Enum(
                "easy",
                "medium",
                "high",
                name="solution_preset_level",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("preset_description_snapshot", sa.Text(), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "difficulty_rating BETWEEN 0 AND 10", name="ck_solution_rating"
        ),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["task_id", "task_level_preset_id"],
            ["task_level_presets.task_id", "task_level_presets.id"],
            name="fk_solution_task_preset",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_solutions_author_created",
        "task_solutions",
        ["author_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_solutions_task_preset",
        "task_solutions",
        ["task_id", "task_level_preset_id"],
        unique=False,
    )
    op.create_table(
        "task_solution_complications",
        sa.Column("solution_id", sa.BigInteger(), nullable=False),
        sa.Column("original_complication_link_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("acceptance_criteria", sa.Text(), nullable=True),
        sa.Column("implementation_description", sa.Text(), nullable=True),
        sa.Column(
            "is_required", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("order_number", sa.Integer(), server_default="0", nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("order_number >= 0", name="ck_solution_link_order"),
        sa.ForeignKeyConstraint(
            ["original_complication_link_id"],
            ["task_complication_links.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["solution_id"], ["task_solutions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_solution_links_order",
        "task_solution_complications",
        ["solution_id", "order_number", "id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_task_solution_complications_original_complication_link_id"),
        "task_solution_complications",
        ["original_complication_link_id"],
        unique=False,
    )
    # Конец команд Alembic.


def downgrade() -> None:
    """Откатить изменения схемы."""
    # Команды, первоначально сформированные Alembic.
    op.drop_index(
        op.f("ix_task_solution_complications_original_complication_link_id"),
        table_name="task_solution_complications",
    )
    op.drop_index("ix_solution_links_order", table_name="task_solution_complications")
    op.drop_table("task_solution_complications")
    op.drop_index("ix_solutions_task_preset", table_name="task_solutions")
    op.drop_index("ix_solutions_author_created", table_name="task_solutions")
    op.drop_table("task_solutions")
    op.drop_index("ix_task_links_composition", table_name="task_complication_links")
    op.drop_index(
        op.f("ix_task_complication_links_complication_id"),
        table_name="task_complication_links",
    )
    op.drop_table("task_complication_links")
    op.drop_index(op.f("ix_task_resources_task_id"), table_name="task_resources")
    op.drop_table("task_resources")
    op.drop_table("task_level_presets")
    op.drop_index("ix_drafts_owner_updated", table_name="task_drafts")
    op.drop_table("task_drafts")
    op.drop_index(
        op.f("ix_task_complications_category_id"), table_name="task_complications"
    )
    op.drop_table("task_complications")
    op.drop_table("users")
    op.drop_index(op.f("ix_tasks_parent_task_id"), table_name="tasks")
    op.drop_index("ix_tasks_catalog", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index(
        op.f("ix_task_complication_categories_parent_id"),
        table_name="task_complication_categories",
    )
    op.drop_index(
        op.f("ix_task_complication_categories_group"),
        table_name="task_complication_categories",
    )
    op.drop_index(
        op.f("ix_task_complication_categories_developer_type"),
        table_name="task_complication_categories",
    )
    op.drop_table("task_complication_categories")
    # Конец команд Alembic.
