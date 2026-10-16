from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import RequestUserRole


class ErrorDetail(BaseModel):
    code: str
    message: str


class APIResponse[T](BaseModel):  # noqa: UP046
    """Базовый единый формат ответа нашего API"""

    success: bool
    data: T | None = None
    errors: ErrorDetail | None = None


class SuccessResponse[T](APIResponse[T]):  # noqa
    success: Literal[True] = True  # type: ignore
    errors: None = None  # type: ignore


class ErrorResponse(APIResponse[None]):  # noqa
    success: Literal[False] = False  # type: ignore
    data: None = None
    errors: ErrorDetail  # type: ignore


class CandidateContactRequestIn(BaseModel):
    name: str = Field(max_length=255)
    email: EmailStr
    content: str | None = Field(max_length=3_500, default=None)
    # Согласен ли получать рекламу
    is_agree_with_mails: bool = Field(default=False)


class EmployerContactRequestIn(CandidateContactRequestIn):
    telegram: str = Field(max_length=255)
    company: str = Field(max_length=255)

    @field_validator("telegram", mode="after")
    @classmethod
    def is_telegram_correct(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.startswith("@"):
            raise ValueError(f"{value} must start with @")
        return value.strip()


class ContactRequestPublic(CandidateContactRequestIn):
    id: int
    telegram: str | None = Field(max_length=255, default=None)
    company: str | None = Field(max_length=255, default=None)
    role: RequestUserRole
