from pydantic import Field, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_ignore_empty=True,
        extra="ignore",
    )

    PROJECT_NAME: str
    DATABASE_URL: PostgresDsn
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY: SecretStr | None = None
    S3_SECRET_KEY: SecretStr | None = None
    S3_BUCKET: str = "codehunt"
    S3_REGION: str = "us-east-1"
    MAX_PHOTO_BYTES: int = Field(default=5 * 1024 * 1024, gt=0)
    MAX_RESOURCE_BYTES: int = Field(default=50 * 1024 * 1024, gt=0)
    REDIS_URL: str | None = None
    MEDIA_CACHE_TTL: int = Field(default=300, ge=1, le=86400)
    MEDIA_CACHE_MAX_BYTES: int = Field(default=1024 * 1024, ge=0, le=5 * 1024 * 1024)
    GITHUB_ID: str | None = None
    GITHUB_SECRET: SecretStr | None = None
    ADMIN_EMAILS: str = ""

    @property
    def admin_emails(self) -> frozenset[str]:
        return frozenset(
            email.strip().casefold()
            for email in self.ADMIN_EMAILS.split(",")
            if email.strip()
        )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _use_asyncpg_driver(cls, value: str | PostgresDsn) -> str:
        database_url = str(value)
        for scheme in ("postgres://", "postgresql://"):
            if database_url.startswith(scheme):
                return database_url.replace(scheme, "postgresql+asyncpg://", 1)
        return database_url


settings = Settings()
