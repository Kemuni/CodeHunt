from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import DeveloperType, Level, TaskStatus
from app.schemas.common import PositiveID


class TaskCatalogQuery(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    q: str = Field(default="", max_length=300)
    developer_type: list[DeveloperType] = Field(default_factory=list)
    access: Literal["free", "subscription"] | None = None
    level: Level | None = None
    difficulty_min: int | None = None
    difficulty_max: int | None = None
    parent_task_id: PositiveID | None = None
    sort: Literal["oldest", "newest", "title", "difficulty_asc", "difficulty_desc"] = (
        "oldest"
    )


class EditorTaskCatalogQuery(TaskCatalogQuery):
    status: TaskStatus | None = None
    is_hidden: bool | None = None
