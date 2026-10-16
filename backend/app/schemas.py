import datetime
from typing import Literal, Annotated

from pydantic import BaseModel, ConfigDict, Field, EmailStr, AfterValidator, field_validator

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
    success: Literal[True] = True
    errors: None = None


class ErrorResponse(APIResponse[None]):  # noqa
    success: Literal[False] = False
    data: None = None
    errors: ErrorDetail


class CandidateContactRequestIn(BaseModel):
    name: str = Field(max_length=255)
    email: EmailStr
    content: str | None = Field(max_length=3_500, default=None)
    # Согласен ли получать рекламу
    is_agree_with_mails: bool = Field(default=False)


class EmployerContactRequestIn(CandidateContactRequestIn):
    telegram: str = Field(max_length=255)
    company: str = Field(max_length=255)

    @field_validator('telegram', mode='after')
    @classmethod
    def is_even(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.startswith('@'):
            raise ValueError(f'{value} must start with @')
        return value.strip()


class ContactRequestPublic(EmployerContactRequestIn):
    id: int
    telegram: str | None = Field(max_length=255, default=None)
    company: str | None = Field(max_length=255, default=None)
    role: RequestUserRole
