from datetime import datetime

from pydantic import Field, SecretStr

from app.schemas.common import Input, Read


class GitHubLogin(Input):
    access_token: SecretStr = Field(min_length=1, max_length=512)


class AuthUser(Read):
    email: str
    is_admin: bool


class LoginResult(Input):
    token: str
    expires_at: datetime
    user: AuthUser
