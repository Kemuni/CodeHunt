"""Начальная схема

Ревизия: ff0767990d87
Предыдущая ревизия:
Дата создания: 2026-10-17 00:33:11.771782

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# Идентификаторы ревизии для Alembic.
revision: str = "ff0767990d87"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Применить изменения схемы."""
    # Команды, первоначально сформированные Alembic.
    op.create_table(
        "contact_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "role",
            sa.Enum("candidate", "employer", name="requestuserrole", native_enum=False),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("is_agree_with_mails", sa.Boolean(), nullable=False),
        sa.Column("telegram", sa.String(length=255), nullable=True),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column(
            "created_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_contact_requests_email"), "contact_requests", ["email"], unique=False
    )
    op.create_index(
        op.f("ix_contact_requests_id"), "contact_requests", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_contact_requests_role"), "contact_requests", ["role"], unique=False
    )
    # Конец команд Alembic.


def downgrade() -> None:
    """Откатить изменения схемы."""
    # Команды, первоначально сформированные Alembic.
    op.drop_index(op.f("ix_contact_requests_role"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_id"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_email"), table_name="contact_requests")
    op.drop_table("contact_requests")
    # Конец команд Alembic.
