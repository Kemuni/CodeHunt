from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import RequestUserRole


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
    model_config = {"from_attributes": True}
    id: int
    telegram: str | None = Field(max_length=255, default=None)
    company: str | None = Field(max_length=255, default=None)
    role: RequestUserRole
