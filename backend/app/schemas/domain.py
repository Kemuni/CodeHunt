import json
from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    Field,
    HttpUrl,
    JsonValue,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models.enums import (
    LEVELS,
    DeveloperType,
    Level,
    ResourceType,
    TaskStatus,
)
from app.schemas.common import (
    Content,
    Dates,
    Input,
    PatchInput,
    PositiveID,
    Rating,
    Read,
    Slug,
    Title,
    ValidationIssue,
)


class CategoryCreate(Input):
    title: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    parent_id: PositiveID | None = None
    developer_type: DeveloperType


class TemplateCreate(Input):
    category_id: PositiveID
    title: Annotated[str, StringConstraints(min_length=1, max_length=150)]
    slug: Slug
    description: Content


class TaskCreate(Input):
    parent_task_id: PositiveID | None = None
    slug: Slug
    title: Title
    short_description: Annotated[str, StringConstraints(min_length=1, max_length=300)]
    full_description: Content
    developer_type: DeveloperType
    difficulty_from: Rating
    difficulty_to: Rating
    design_author_name: Title | None = None
    design_author_link: HttpUrl | None = None
    is_hidden: bool = False

    @model_validator(mode="after")
    def difficulty_interval(self) -> Self:
        if self.difficulty_from > self.difficulty_to:
            raise ValueError("difficulty_from не может превышать difficulty_to")
        return self


class LinkContent(Input):
    complication_id: PositiveID | None = None
    title: Title
    description: Content
    acceptance_criteria: Content
    level: Level
    is_required: bool = False


class LinkCreate(LinkContent):
    group_id: PositiveID | None = None
    order_number: Annotated[int, Field(ge=0, le=2_147_483_647)] = 0


class PresetCreate(Input):
    level: Level
    description: Content
    average_days_to_complete: Annotated[int, Field(gt=0, le=32767)] | None = None


class SolutionCreate(Input):
    author_id: PositiveID
    task_level_preset_id: PositiveID
    excluded_complication_link_ids: list[PositiveID] = Field(
        default_factory=list, max_length=1000
    )

    @field_validator("excluded_complication_link_ids")
    @classmethod
    def unique_exclusions(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("ID исключений не должны повторяться")
        return value


class SolutionUpdate(Input):
    description: Annotated[str, Field(max_length=100_000)] = ""
    github_link: HttpUrl | None = None
    difficulty_rating: Rating | None = None


class SolutionLinkCreate(Input):
    title: Title
    description: Content
    acceptance_criteria: Content | None = None
    implementation_description: Annotated[str, Field(max_length=100_000)] | None = None
    is_required: bool = False
    order_number: Annotated[int, Field(ge=0, le=2_147_483_647)] = 0


class ResourceUpdate(Input):
    title: Title
    type: ResourceType


class CategoryUpdate(PatchInput):
    nullable_fields = frozenset(["parent_id"])

    title: Annotated[str, StringConstraints(min_length=1, max_length=100)] | None = None
    parent_id: PositiveID | None = None
    developer_type: DeveloperType | None = None


class TemplateUpdate(PatchInput):
    category_id: PositiveID | None = None
    title: Annotated[str, StringConstraints(min_length=1, max_length=150)] | None = None
    slug: Slug | None = None
    description: Content | None = None


class TaskUpdate(PatchInput):
    nullable_fields = frozenset(
        ["design_author_link", "design_author_name", "parent_task_id"]
    )

    parent_task_id: PositiveID | None = None
    slug: Slug | None = None
    title: Title | None = None
    short_description: (
        Annotated[str, StringConstraints(min_length=1, max_length=300)] | None
    ) = None
    full_description: Content | None = None
    developer_type: DeveloperType | None = None
    difficulty_from: Rating | None = None
    difficulty_to: Rating | None = None
    design_author_name: Title | None = None
    design_author_link: HttpUrl | None = None
    status: TaskStatus | None = None
    is_hidden: bool | None = None


class LinkUpdate(PatchInput):
    nullable_fields = frozenset(["complication_id", "group_id"])

    group_id: PositiveID | None = None

    complication_id: PositiveID | None = None
    title: Title | None = None
    description: Content | None = None
    acceptance_criteria: Content | None = None
    level: Level | None = None
    is_required: bool | None = None
    order_number: Annotated[int, Field(ge=0, le=2_147_483_647)] | None = None


class PresetUpdate(PatchInput):
    nullable_fields = frozenset(["average_days_to_complete"])

    level: Level | None = None
    description: Content | None = None
    average_days_to_complete: Annotated[int, Field(gt=0, le=32767)] | None = None


class SolutionLinkUpdate(PatchInput):
    nullable_fields = frozenset(["acceptance_criteria", "implementation_description"])

    title: Title | None = None
    description: Content | None = None
    acceptance_criteria: Content | None = None
    implementation_description: Annotated[str, Field(max_length=100_000)] | None = None
    is_required: bool | None = None
    order_number: Annotated[int, Field(ge=0, le=2_147_483_647)] | None = None


class ResourcePatch(PatchInput):
    title: Title | None = None
    type: ResourceType | None = None


class OrderInput(Input):
    ids: list[PositiveID] = Field(max_length=1000)


class LinkCopy(Input):
    source_link_id: PositiveID
    title: Title | None = None
    level: Level | None = None
    order_number: Annotated[int, Field(ge=0)] | None = None


class CategoryRead(Read, CategoryCreate):
    pass


class TemplateRead(Read, Dates, TemplateCreate):
    pass


class PhotoRead(Read, Dates):
    task_id: int | None
    draft_id: int | None
    position: int
    is_cover: bool
    original_filename: str
    content_type: str
    size_bytes: int
    url: str
    expires_in: int


class TaskRead(Read, Dates, TaskCreate):
    status: TaskStatus
    cover_photo: PhotoRead | None = Field(
        default=None,
        description="Титульное фото с временной ссылкой, null при отсутствии",
    )


class LinkRead(Read, Dates, LinkCreate):
    task_id: int


class PresetRead(Read, Dates, PresetCreate):
    task_id: int


class SolutionLinkRead(Read, Dates, SolutionLinkCreate):
    solution_id: int
    original_complication_link_id: int | None
    resolved_at: datetime | None


class SolutionRead(Read, Dates):
    task_id: int
    task_level_preset_id: int
    author_id: int
    description: str
    github_link: str | None
    difficulty_rating: int | None
    resolved_at: datetime | None
    status: Literal["in_progress", "completed"]
    task_title_snapshot: str
    task_description_snapshot: str
    preset_level_snapshot: Level
    preset_description_snapshot: str


class ResourceRead(Read, Dates):
    task_id: int | None
    draft_id: int | None
    title: str
    type: ResourceType
    original_filename: str
    content_type: str | None
    size_bytes: int | None


class ResourceDownloadRead(ResourceRead):
    url: str
    expires_in: int


class ComplicationItem(LinkRead):
    kind: Literal["complication"] = "complication"


class ComplicationGroupRead(Read, Dates):
    kind: Literal["group"] = "group"
    task_id: int
    parent_group_id: int | None
    title: str
    order_number: int
    items: list["CompositionItem"] = Field(default_factory=list)


CompositionItem = Annotated[
    ComplicationItem | ComplicationGroupRead, Field(discriminator="kind")
]
ComplicationGroupRead.model_rebuild()


class CompositionLink(LinkContent):
    kind: Literal["complication"] = "complication"
    id: PositiveID | None = None


class CompositionGroup(Input):
    kind: Literal["group"] = "group"
    id: PositiveID | None = None
    title: Title
    items: list["CompositionWriteItem"] = Field(default_factory=list, max_length=1000)


CompositionWriteItem = Annotated[
    CompositionLink | CompositionGroup, Field(discriminator="kind")
]
CompositionGroup.model_rebuild()


class CompositionUpdate(Input):
    items: list[CompositionWriteItem] = Field(max_length=1000)

    @model_validator(mode="after")
    def valid_tree(self) -> Self:
        seen: set[tuple[str, int]] = set()
        count = 0
        stack = [(item, 1) for item in self.items]
        while stack:
            item, depth = stack.pop()
            count += 1
            if depth > 10 or count > 1000:
                raise ValueError("Допустимо не более 10 уровней и 1000 элементов")
            if item.id is not None:
                key = (item.kind, item.id)
                if key in seen:
                    raise ValueError(
                        "Каждая группа и требование могут встречаться только один раз"
                    )
                seen.add(key)
            if isinstance(item, CompositionGroup):
                stack.extend((child, depth + 1) for child in item.items)
        return self


class TaskPublication(TaskCreate):
    items: list[CompositionWriteItem] = Field(default_factory=list, max_length=1000)
    presets: list[PresetCreate] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def publishable(self) -> Self:
        CompositionUpdate(items=self.items)
        levels = set()
        stack = list(self.items)
        while stack:
            item = stack.pop()
            if item.id is not None:
                raise ValueError(
                    "Новые требования и группы не должны содержать ID записей БД"
                )
            if isinstance(item, CompositionGroup):
                stack.extend(item.items)
            else:
                levels.add(item.level)
        preset_levels = [preset.level for preset in self.presets]
        if len(set(preset_levels)) != len(preset_levels):
            raise ValueError("Уровни пресетов не должны повторяться")
        for preset in self.presets:
            if not levels.intersection(LEVELS[: LEVELS.index(preset.level) + 1]):
                raise ValueError(f"Пресет {preset.level} не содержит требований")
        return self


class GalleryUpdate(Input):
    photo_ids: list[PositiveID] = Field(max_length=4)

    @field_validator("photo_ids")
    @classmethod
    def unique_photos(cls, ids: list[int]) -> list[int]:
        if len(ids) != len(set(ids)):
            raise ValueError("Фотографии не должны повторяться")
        return ids


class TaskDetail(TaskRead):
    complications: list[CompositionItem]
    presets: list[PresetRead]
    photos: list[PhotoRead]
    resources: list[ResourceDownloadRead]


class CategoryLibrary(CategoryRead):
    complications: list[TemplateRead] = Field(default_factory=list)
    children: list["CategoryLibrary"] = Field(default_factory=list)


class DeveloperLibrary(BaseModel):
    developer_type: DeveloperType
    categories: list[CategoryLibrary]


class Configuration(BaseModel):
    preset: PresetRead
    complications: list[CompositionItem]


class SolutionDetail(SolutionRead):
    complications: list[SolutionLinkRead]
    total_count: int
    completed_count: int


class DraftCreate(Input):
    payload: dict[str, JsonValue] = Field(default_factory=dict)

    @field_validator("payload")
    @classmethod
    def payload_shape(cls, value: dict[str, JsonValue]) -> dict[str, JsonValue]:
        if len(json.dumps(value, ensure_ascii=False).encode()) > 256_000:
            raise ValueError("Черновик превышает 256 КБ")
        unknown = value.keys() - (TaskCreate.model_fields.keys() | {"items", "presets"})
        if unknown:
            raise ValueError(f"Неизвестные поля: {', '.join(sorted(unknown))}")
        return value


class DraftUpdate(DraftCreate):
    revision: Annotated[int, Field(gt=0)]


class DraftPublish(Input):
    revision: Annotated[int, Field(gt=0)]


class DraftRead(Read, Dates):
    owner_id: int
    payload: dict[str, JsonValue]
    revision: int
    validation_errors: list[ValidationIssue]
    is_valid: bool
    photos: list[PhotoRead]
    resources: list[ResourceDownloadRead]


class DraftGalleryUpdate(GalleryUpdate):
    revision: Annotated[int, Field(gt=0)]


class DraftResourceUpdate(ResourcePatch):
    revision: Annotated[int, Field(gt=0)]
