from typing import Annotated

from pydantic import Field, TypeAdapter, ValidationError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task, TaskComplication, TaskLevelPreset, TaskPhoto, TaskResource
from app.models.enums import LEVELS
from app.schemas.common import PositiveID, ValidationIssue
from app.schemas.domain import (
    CompositionGroup,
    CompositionUpdate,
    PresetCreate,
    TaskCreate,
    TaskPublication,
)
from app.services import composition
from app.services.common import check_parent, flush

PRESETS = TypeAdapter(Annotated[list[PresetCreate], Field(min_length=1, max_length=3)])


async def validate(session: AsyncSession, payload: dict) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    def errors(exc: ValidationError, prefix: str = ""):
        for error in exc.errors():
            parts = [
                str(part)
                for part in error["loc"]
                if part not in {"group", "complication"}
            ]
            field = ".".join(([prefix] if prefix else []) + parts)
            issues.append(
                ValidationIssue(
                    field=field or "difficulty_from",
                    code=error["type"],
                    message=error["msg"],
                )
            )

    try:
        TaskCreate.model_validate(
            {
                key: value
                for key, value in payload.items()
                if key not in {"items", "presets"}
            }
        )
    except ValidationError as exc:
        errors(exc)
    tree = None
    try:
        tree = CompositionUpdate(items=payload.get("items", []))
    except ValidationError as exc:
        errors(exc)
    presets = None
    try:
        presets = PRESETS.validate_python(payload.get("presets", []))
    except ValidationError as exc:
        errors(exc, "presets")
    if presets is not None:
        seen = set()
        levels = set()
        if tree is not None:
            stack = list(tree.items)
            while stack:
                item = stack.pop()
                if isinstance(item, CompositionGroup):
                    stack.extend(item.items)
                else:
                    levels.add(item.level)
        for index, preset in enumerate(presets):
            if preset.level in seen:
                issues.append(
                    ValidationIssue(
                        field=f"presets.{index}.level",
                        code="duplicate_level",
                        message="Уровень пресета уже используется",
                    )
                )
            seen.add(preset.level)
            if tree is not None and not levels.intersection(
                LEVELS[: LEVELS.index(preset.level) + 1]
            ):
                issues.append(
                    ValidationIssue(
                        field=f"presets.{index}.level",
                        code="empty_configuration",
                        message="В этом пресете нет требований",
                    )
                )

    # Проверяем ссылки даже в неполных пунктах формы.
    references: dict[int, list[str]] = {}
    raw_items = payload.get("items")
    stack = (
        [(item, f"items.{i}", 1) for i, item in enumerate(raw_items)]
        if isinstance(raw_items, list)
        else []
    )
    visited = 0
    while stack and visited < 1000:
        item, path, depth = stack.pop()
        visited += 1
        if not isinstance(item, dict):
            continue
        if item.get("id") is not None:
            issues.append(
                ValidationIssue(
                    field=f"{path}.id",
                    code="unexpected_id",
                    message="Черновик создаёт новые группы и пункты без ID записей БД",
                )
            )
        if item.get("kind") == "group":
            children = item.get("items")
            if isinstance(children, list) and depth < 10:
                stack.extend(
                    (child, f"{path}.items.{i}", depth + 1)
                    for i, child in enumerate(children)
                )
        else:
            try:
                template_id = TypeAdapter(PositiveID | None).validate_python(
                    item.get("complication_id")
                )
            except ValidationError:
                continue
            if template_id is not None:
                references.setdefault(template_id, []).append(f"{path}.complication_id")
    if references:
        existing = set(
            (
                await session.scalars(
                    select(TaskComplication.id).where(
                        TaskComplication.id.in_(references)
                    )
                )
            ).all()
        )
        for template_id in references.keys() - existing:
            for field in references[template_id]:
                issues.append(
                    ValidationIssue(
                        field=field,
                        code="template_not_found",
                        message="Шаблон требования больше не существует",
                    )
                )
    slug = payload.get("slug")
    if isinstance(slug, str) and await session.scalar(
        select(Task.id).where(Task.slug == slug.strip())
    ):
        issues.append(
            ValidationIssue(
                field="slug",
                code="slug_taken",
                message="Этот slug уже используется заданием",
            )
        )
    try:
        parent_id = TypeAdapter(PositiveID | None).validate_python(
            payload.get("parent_task_id")
        )
    except ValidationError:
        parent_id = None
    if parent_id is not None and await session.get(Task, parent_id) is None:
        issues.append(
            ValidationIssue(
                field="parent_task_id",
                code="parent_not_found",
                message="Родительское задание больше не существует",
            )
        )
    return issues


async def build(session: AsyncSession, data: TaskPublication, *, draft_id: int) -> Task:
    """Создаёт строгое задание целиком внутри транзакции вызывающего сервиса."""
    values = data.model_dump(mode="json", exclude={"items", "presets"})
    await check_parent(session, Task, data.parent_task_id, None, "parent_task_id")
    obj = Task(**values)
    session.add(obj)
    await flush(session)
    # Переносим файлы до проверки готовности задачи в той же транзакции.
    for model in (TaskPhoto, TaskResource):
        await session.execute(
            update(model)
            .where(model.draft_id == draft_id)
            .values(task_id=obj.id, draft_id=None)
        )
    for preset in data.presets:
        session.add(TaskLevelPreset(task_id=obj.id, **preset.model_dump()))
    await composition.save(session, obj, CompositionUpdate(items=data.items))
    return obj
