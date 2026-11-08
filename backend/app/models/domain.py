from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Computed,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import (
    DeveloperType,
    Level,
    ResourceType,
    TaskStatus,
)


def choice(enum_class, name: str):
    return Enum(
        enum_class,
        name=name,
        native_enum=False,
        create_constraint=True,
        values_callable=lambda cls: [item.value for item in cls],
    )


class IdentityMixin:
    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        # SQLAlchemy обновляет дату при UPDATE через ORM и Core.
        # При прямом SQL вне приложения дату нужно задавать явно.
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.clock_timestamp(),
    )


class User(IdentityMixin, Timestamps, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    github_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    verified_emails: Mapped[list[str]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class TaskComplicationCategory(IdentityMixin, Base):
    __tablename__ = "task_complication_categories"
    __table_args__ = (CheckConstraint("parent_id <> id", name="ck_category_parent"),)
    title: Mapped[str] = mapped_column(String(100))
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("task_complication_categories.id", ondelete="RESTRICT"), index=True
    )
    developer_type: Mapped[DeveloperType] = mapped_column(
        choice(DeveloperType, "category_developer_type"), index=True
    )


class TaskComplication(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_complications"
    category_id: Mapped[int] = mapped_column(
        ForeignKey("task_complication_categories.id", ondelete="RESTRICT"), index=True
    )
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)


class Task(IdentityMixin, Timestamps, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "difficulty_from >= 0 AND difficulty_to <= 10 AND difficulty_from <= difficulty_to",
            name="ck_task_difficulty",
        ),
        CheckConstraint("parent_task_id <> id", name="ck_task_parent"),
        Index("ix_tasks_catalog", "status", "developer_type", "id"),
    )
    parent_task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="RESTRICT"), index=True
    )
    slug: Mapped[str] = mapped_column(String(255), unique=True)
    title: Mapped[str] = mapped_column(String(255))
    short_description: Mapped[str] = mapped_column(String(300))
    full_description: Mapped[str] = mapped_column(Text)
    developer_type: Mapped[DeveloperType] = mapped_column(
        choice(DeveloperType, "task_developer_type")
    )
    difficulty_from: Mapped[int] = mapped_column(SmallInteger)
    difficulty_to: Mapped[int] = mapped_column(SmallInteger)
    design_author_name: Mapped[str | None] = mapped_column(String(255))
    design_author_link: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(
        choice(TaskStatus, "task_status"), server_default="published"
    )
    is_hidden: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class TaskComplicationLinkGroup(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_complication_link_groups"
    __table_args__ = (
        UniqueConstraint("task_id", "level", "id", name="uq_link_group_task_level_id"),
        ForeignKeyConstraint(
            ["task_id", "level", "parent_group_id"],
            [
                "task_complication_link_groups.task_id",
                "task_complication_link_groups.level",
                "task_complication_link_groups.id",
            ],
            ondelete="RESTRICT",
            name="fk_link_group_parent",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint("parent_group_id <> id", name="ck_link_group_parent"),
        CheckConstraint("position >= 0", name="ck_link_group_position"),
        Index("ix_link_groups_tree", "task_id", "parent_group_id", "position"),
    )
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="RESTRICT"))
    parent_group_id: Mapped[int | None] = mapped_column(BigInteger)
    title: Mapped[str] = mapped_column(String(255))
    level: Mapped[Level] = mapped_column(choice(Level, "task_link_group_level"))

    # Порядок среди соседей
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class TaskComplicationLink(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_complication_links"
    __table_args__ = (
        ForeignKeyConstraint(
            ["task_id", "level", "group_id"],
            [
                "task_complication_link_groups.task_id",
                "task_complication_link_groups.level",
                "task_complication_link_groups.id",
            ],
            ondelete="RESTRICT",
            name="fk_task_link_group",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint("position >= 0", name="ck_task_link_position"),
        Index("ix_task_links_composition", "task_id", "level", "position", "id"),
    )
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="RESTRICT"))
    group_id: Mapped[int | None] = mapped_column(BigInteger, index=True)
    complication_id: Mapped[int | None] = mapped_column(
        ForeignKey("task_complications.id", ondelete="RESTRICT"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    acceptance_criteria: Mapped[str] = mapped_column(Text)
    level: Mapped[Level] = mapped_column(choice(Level, "task_link_level"))
    is_required: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class TaskLevelPreset(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_level_presets"
    __table_args__ = (
        UniqueConstraint("task_id", "level", name="uq_task_preset_level"),
        UniqueConstraint("task_id", "id", name="uq_task_preset_task_id"),
        CheckConstraint("average_days_to_complete > 0", name="ck_preset_days"),
    )
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="RESTRICT"))
    level: Mapped[Level] = mapped_column(choice(Level, "preset_level"))
    description: Mapped[str] = mapped_column(Text)
    average_days_to_complete: Mapped[int | None] = mapped_column(SmallInteger)


class TaskSolution(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_solutions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["task_id", "task_level_preset_id"],
            ["task_level_presets.task_id", "task_level_presets.id"],
            ondelete="RESTRICT",
            name="fk_solution_task_preset",
        ),
        CheckConstraint(
            "difficulty_rating BETWEEN 0 AND 10", name="ck_solution_rating"
        ),
        Index("ix_solutions_author_created", "author_id", "created_at", "id"),
        Index("ix_solutions_task_preset", "task_id", "task_level_preset_id"),
    )
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="RESTRICT"))
    task_level_preset_id: Mapped[int] = mapped_column(BigInteger)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    description: Mapped[str] = mapped_column(Text, server_default="")
    difficulty_rating: Mapped[int | None] = mapped_column(SmallInteger)
    github_link: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(20),
        Computed(
            "CASE WHEN resolved_at IS NULL THEN 'in_progress' ELSE 'completed' END",
            persisted=True,
        ),
    )
    task_title_snapshot: Mapped[str] = mapped_column(String(255))
    task_description_snapshot: Mapped[str] = mapped_column(Text)
    preset_level_snapshot: Mapped[Level] = mapped_column(
        choice(Level, "solution_preset_level")
    )
    preset_description_snapshot: Mapped[str] = mapped_column(Text)


class TaskSolutionComplication(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_solution_complications"
    __table_args__ = (
        CheckConstraint("order_number >= 0", name="ck_solution_link_order"),
        Index("ix_solution_links_order", "solution_id", "order_number", "id"),
    )
    solution_id: Mapped[int] = mapped_column(
        ForeignKey("task_solutions.id", ondelete="CASCADE")
    )
    original_complication_link_id: Mapped[int | None] = mapped_column(
        ForeignKey("task_complication_links.id", ondelete="RESTRICT"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    acceptance_criteria: Mapped[str | None] = mapped_column(Text)
    implementation_description: Mapped[str | None] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    order_number: Mapped[int] = mapped_column(Integer, server_default="0")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TaskResource(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_resources"
    __table_args__ = (
        CheckConstraint("size_bytes >= 0", name="ck_resource_size"),
        CheckConstraint(
            "(task_id IS NOT NULL) <> (draft_id IS NOT NULL)", name="ck_resource_owner"
        ),
    )
    task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="RESTRICT"), index=True
    )
    draft_id: Mapped[int | None] = mapped_column(
        ForeignKey("task_drafts.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    type: Mapped[ResourceType] = mapped_column(choice(ResourceType, "resource_type"))
    object_key: Mapped[str] = mapped_column(Text)
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(255))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)


class TaskPhoto(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_photos"
    __table_args__ = (
        # Четыре уникальные позиции ограничивают число фотографий на уровне БД.
        UniqueConstraint(
            "task_id",
            "position",
            name="uq_task_photo_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        UniqueConstraint(
            "draft_id",
            "position",
            name="uq_draft_photo_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(
            "(task_id IS NOT NULL) <> (draft_id IS NOT NULL)", name="ck_photo_owner"
        ),
        CheckConstraint("position BETWEEN 1 AND 4", name="ck_task_photo_position"),
        CheckConstraint("size_bytes > 0", name="ck_task_photo_size"),
    )
    task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="RESTRICT"), index=True
    )
    draft_id: Mapped[int | None] = mapped_column(
        ForeignKey("task_drafts.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(SmallInteger)
    object_key: Mapped[str] = mapped_column(Text, unique=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)

    @property
    def is_cover(self) -> bool:
        return self.position == 1


class TaskDraft(IdentityMixin, Timestamps, Base):
    __tablename__ = "task_drafts"
    __table_args__ = (
        CheckConstraint("revision > 0", name="ck_draft_revision"),
        CheckConstraint("jsonb_typeof(payload) = 'object'", name="ck_draft_payload"),
        Index("ix_drafts_owner_updated", "owner_id", "updated_at", "id"),
    )
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    revision: Mapped[int] = mapped_column(Integer, server_default="1")
