from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, BinaryIO, Protocol, TypedDict

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings
from app.core.errors import (
    DomainError,
    FileNotFoundInStorageError,
    StorageNotConfiguredError,
    StorageUnavailableError,
)

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


class ObjectMetadata(TypedDict):
    ContentLength: int


class Storage(Protocol):
    def upload(self, file: BinaryIO, key: str, content_type: str) -> None: ...
    def stat(self, key: str) -> ObjectMetadata: ...
    def get_download_url(self, key: str) -> str: ...
    def delete(self, key: str) -> None: ...
    def read(self, key: str) -> bytes: ...


class S3Storage:
    def __init__(self):
        if (
            not settings.S3_ENDPOINT_URL
            or not settings.S3_ACCESS_KEY
            or not settings.S3_SECRET_KEY
        ):
            raise StorageNotConfiguredError()
        self._access_key = settings.S3_ACCESS_KEY.get_secret_value()
        self._secret_key = settings.S3_SECRET_KEY.get_secret_value()
        self.client = self._client(settings.S3_ENDPOINT_URL)
        self.url_client = (
            self._client(settings.S3_PUBLIC_ENDPOINT_URL)
            if settings.S3_PUBLIC_ENDPOINT_URL
            else self.client
        )

    def _client(self, endpoint: str) -> S3Client:
        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=self._access_key,
            aws_secret_access_key=self._secret_key,
            region_name=settings.S3_REGION,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                connect_timeout=5,
                read_timeout=30,
                retries={"max_attempts": 2},
            ),
        )

    def upload(self, file: BinaryIO, key: str, content_type: str) -> None:
        self.client.upload_fileobj(
            file, settings.S3_BUCKET, key, ExtraArgs={"ContentType": content_type}
        )

    def stat(self, key: str) -> ObjectMetadata:
        metadata = self.client.head_object(Bucket=settings.S3_BUCKET, Key=key)
        return {"ContentLength": metadata["ContentLength"]}

    def get_download_url(self, key: str) -> str:
        return self.url_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": key},
            ExpiresIn=settings.S3_URL_TTL,
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=settings.S3_BUCKET, Key=key)

    def read(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=settings.S3_BUCKET, Key=key)
        body = response["Body"]
        try:
            return body.read()
        finally:
            body.close()


@lru_cache
def get_storage() -> Storage:
    return S3Storage()


def storage_error(exc: Exception) -> DomainError:
    if isinstance(exc, ClientError) and exc.response.get("Error", {}).get("Code") in {
        "404",
        "NoSuchKey",
        "NotFound",
    }:
        return FileNotFoundInStorageError()
    return StorageUnavailableError()


STORAGE_EXCEPTIONS = (BotoCoreError, ClientError)
