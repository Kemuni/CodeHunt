import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base


class RequestUserRole(enum.StrEnum):
    CANDIDATE = "candidate"
    EMPLOYER = "employer"


class ContactRequest(Base):
    """Обращение пользователя"""

    __tablename__ = "contact_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    role: Mapped[RequestUserRole] = mapped_column(
        Enum(
            RequestUserRole,
            native_enum=False,
            values_callable=lambda enum_class: [member.value for member in enum_class],
        ),
        default=RequestUserRole.CANDIDATE,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Согласен ли получать рекламу
    is_agree_with_mails: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    telegram: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
