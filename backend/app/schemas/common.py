from datetime import datetime
from typing import Annotated, ClassVar, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list[dict] | None = None


class APIResponse[T](BaseModel):  # noqa: UP046
    """Базовый единый формат ответа нашего API"""

    success: bool
    data: T | None = None
    errors: ErrorDetail | None = None


class SuccessResponse[T](APIResponse[T]):  # noqa
    success: Literal[True] = True  # type: ignore
    errors: None = None  # ty: ignore[invalid-mutable-override]


class ErrorResponse(APIResponse[None]):  # noqa
    success: Literal[False] = False  # type: ignore
    data: None = None
    errors: ErrorDetail  # ty: ignore[invalid-mutable-override]


Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


Content = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100_000)
]


Slug = Annotated[
    str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=255)
]


PositiveID = Annotated[int, Field(gt=0)]


Rating = Annotated[int, Field(ge=0, le=10)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int


class Dates(BaseModel):
    created_at: datetime
    updated_at: datetime


class PatchInput(Input):
    """Пропуск поля сохраняет значение. null разрешён только для очищаемых полей."""

    nullable_fields: ClassVar[frozenset[str]] = frozenset()

    @field_validator("*", mode="before")
    @classmethod
    def check_null(cls, value, info: ValidationInfo):
        if value is None and info.field_name not in cls.nullable_fields:
            raise ValueError(
                "Это поле нельзя очистить. Не передавайте его, чтобы оставить без изменений"
            )
        return value


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int


class ValidationIssue(BaseModel):
    field: str
    code: str
    message: str
