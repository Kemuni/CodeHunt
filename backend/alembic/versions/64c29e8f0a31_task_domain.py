"""Каталог задач, редактор, файлы, решения и GitHub-сессии

Ревизия: 64c29e8f0a31
Предыдущая ревизия: ff0767990d87
Дата создания: 2026-11-10 00:51:49.293795

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# Идентификаторы ревизии для Alembic.
revision: str = "64c29e8f0a31"
down_revision: str | Sequence[str] | None = "ff0767990d87"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Применить изменения схемы."""
    # CHECK перечислений создаёт sa.Enum(create_constraint=True).
    op.create_table(
        "pending_file_deletions",
        sa.Column("bucket", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("attempt_count", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("bucket", "object_key"),
    )
    op.create_index(
        op.f("ix_pending_file_deletions_next_attempt_at"),
        "pending_file_deletions",
        ["next_attempt_at"],
        unique=False,
    )
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
            "is_hidden", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column(
            "is_paid", sa.Boolean(), server_default=sa.text("false"), nullable=False
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
        "ix_tasks_catalog",
        "tasks",
        ["is_hidden", "is_paid", "developer_type", "id"],
        unique=False,
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
        sa.Column("github_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "verified_emails",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("github_id"),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_auth_sessions_expires_at"),
        "auth_sessions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"], unique=False
    )
    op.create_table(
        "task_complication_link_groups",
        sa.Column("task_id", sa.BigInteger(), nullable=False),
        sa.Column("parent_group_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "level",
            sa.Enum(
                "easy",
                "medium",
                "high",
                name="task_link_group_level",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
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
        sa.CheckConstraint("parent_group_id <> id", name="ck_link_group_parent"),
        sa.CheckConstraint("position >= 0", name="ck_link_group_position"),
        sa.ForeignKeyConstraint(
            ["task_id", "level", "parent_group_id"],
            [
                "task_complication_link_groups.task_id",
                "task_complication_link_groups.level",
                "task_complication_link_groups.id",
            ],
            name="fk_link_group_parent",
            ondelete="RESTRICT",
            initially="DEFERRED",
            deferrable=True,
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "task_id", "level", "id", name="uq_link_group_task_level_id"
        ),
    )
    op.create_index(
        "ix_link_groups_tree",
        "task_complication_link_groups",
        ["task_id", "parent_group_id", "position"],
        unique=False,
    )
    op.create_table(
        "task_complications",
        sa.Column("category_id", sa.BigInteger(), nullable=False),
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
        "task_complication_links",
        sa.Column("task_id", sa.BigInteger(), nullable=False),
        sa.Column("group_id", sa.BigInteger(), nullable=True),
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
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
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
        sa.CheckConstraint("position >= 0", name="ck_task_link_position"),
        sa.ForeignKeyConstraint(
            ["complication_id"], ["task_complications.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["task_id", "level", "group_id"],
            [
                "task_complication_link_groups.task_id",
                "task_complication_link_groups.level",
                "task_complication_link_groups.id",
            ],
            name="fk_task_link_group",
            ondelete="RESTRICT",
            initially="DEFERRED",
            deferrable=True,
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
        op.f("ix_task_complication_links_group_id"),
        "task_complication_links",
        ["group_id"],
        unique=False,
    )
    op.create_index(
        "ix_task_links_composition",
        "task_complication_links",
        ["task_id", "level", "position", "id"],
        unique=False,
    )
    op.create_table(
        "task_photos",
        sa.Column("task_id", sa.BigInteger(), nullable=True),
        sa.Column("draft_id", sa.BigInteger(), nullable=True),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
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
            "(task_id IS NOT NULL) <> (draft_id IS NOT NULL)", name="ck_photo_owner"
        ),
        sa.CheckConstraint("position BETWEEN 1 AND 4", name="ck_task_photo_position"),
        sa.CheckConstraint("size_bytes > 0", name="ck_task_photo_size"),
        sa.ForeignKeyConstraint(["draft_id"], ["task_drafts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "draft_id",
            "position",
            deferrable=True,
            initially="DEFERRED",
            name="uq_draft_photo_position",
        ),
        sa.UniqueConstraint("object_key"),
        sa.UniqueConstraint(
            "task_id",
            "position",
            deferrable=True,
            initially="DEFERRED",
            name="uq_task_photo_position",
        ),
    )
    op.create_index(
        op.f("ix_task_photos_draft_id"), "task_photos", ["draft_id"], unique=False
    )
    op.create_index(
        op.f("ix_task_photos_task_id"), "task_photos", ["task_id"], unique=False
    )
    op.create_table(
        "task_resources",
        sa.Column("task_id", sa.BigInteger(), nullable=True),
        sa.Column("draft_id", sa.BigInteger(), nullable=True),
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
        sa.CheckConstraint(
            "(task_id IS NOT NULL) <> (draft_id IS NOT NULL)", name="ck_resource_owner"
        ),
        sa.CheckConstraint("size_bytes >= 0", name="ck_resource_size"),
        sa.ForeignKeyConstraint(["draft_id"], ["task_drafts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_task_resources_draft_id"), "task_resources", ["draft_id"], unique=False
    )
    op.create_index(
        op.f("ix_task_resources_object_key"),
        "task_resources",
        ["object_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_task_resources_task_id"), "task_resources", ["task_id"], unique=False
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


def downgrade() -> None:
    """Откатить изменения схемы."""
    op.drop_index(
        op.f("ix_task_solution_complications_original_complication_link_id"),
        table_name="task_solution_complications",
    )
    op.drop_index("ix_solution_links_order", table_name="task_solution_complications")
    op.drop_table("task_solution_complications")
    op.drop_index("ix_solutions_task_preset", table_name="task_solutions")
    op.drop_index("ix_solutions_author_created", table_name="task_solutions")
    op.drop_table("task_solutions")
    op.drop_index(op.f("ix_task_resources_task_id"), table_name="task_resources")
    op.drop_index(op.f("ix_task_resources_object_key"), table_name="task_resources")
    op.drop_index(op.f("ix_task_resources_draft_id"), table_name="task_resources")
    op.drop_table("task_resources")
    op.drop_index(op.f("ix_task_photos_task_id"), table_name="task_photos")
    op.drop_index(op.f("ix_task_photos_draft_id"), table_name="task_photos")
    op.drop_table("task_photos")
    op.drop_index("ix_task_links_composition", table_name="task_complication_links")
    op.drop_index(
        op.f("ix_task_complication_links_group_id"),
        table_name="task_complication_links",
    )
    op.drop_index(
        op.f("ix_task_complication_links_complication_id"),
        table_name="task_complication_links",
    )
    op.drop_table("task_complication_links")
    op.drop_table("task_level_presets")
    op.drop_index("ix_drafts_owner_updated", table_name="task_drafts")
    op.drop_table("task_drafts")
    op.drop_index(
        op.f("ix_task_complications_category_id"), table_name="task_complications"
    )
    op.drop_table("task_complications")
    op.drop_index("ix_link_groups_tree", table_name="task_complication_link_groups")
    op.drop_table("task_complication_link_groups")
    op.drop_index(op.f("ix_auth_sessions_user_id"), table_name="auth_sessions")
    op.drop_index(op.f("ix_auth_sessions_expires_at"), table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_table("users")
    op.drop_index(op.f("ix_tasks_parent_task_id"), table_name="tasks")
    op.drop_index("ix_tasks_catalog", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index(
        op.f("ix_task_complication_categories_parent_id"),
        table_name="task_complication_categories",
    )
    op.drop_index(
        op.f("ix_task_complication_categories_developer_type"),
        table_name="task_complication_categories",
    )
    op.drop_table("task_complication_categories")
    op.drop_index(
        op.f("ix_pending_file_deletions_next_attempt_at"),
        table_name="pending_file_deletions",
    )
    op.drop_table("pending_file_deletions")
