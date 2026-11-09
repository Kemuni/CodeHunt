from collections import Counter, defaultdict
from collections.abc import Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    EmptyConfigurationError,
    MissingPresetsError,
    NotFoundError,
    TemplateConfirmationRequiredError,
)
from app.models import (
    Task,
    TaskComplication,
    TaskComplicationLink,
    TaskComplicationLinkGroup,
    TaskLevelPreset,
)
from app.models.enums import LEVELS, Level, TaskStatus
from app.schemas.domain import (
    ComplicationGroupRead,
    ComplicationItem,
    CompositionGroup,
    CompositionItem,
    CompositionUpdate,
    LinkRead,
)
from app.services.common import assign, flush, get
from app.services.photos import ensure_present


def confirm_template(obj: TaskComplicationLink, values: dict) -> None:
    if obj.complication_id is not None and "complication_id" not in values:
        if any(
            key in values and values[key] != getattr(obj, key)
            for key in ("title", "description", "acceptance_criteria")
        ):
            raise TemplateConfirmationRequiredError()


async def read(
    session: AsyncSession, task_id: int, level: Level | None = None
) -> list[CompositionItem]:
    # Загружаем всё дерево двумя запросами независимо от глубины вложенности.
    group_query = select(TaskComplicationLinkGroup).where(
        TaskComplicationLinkGroup.task_id == task_id
    )
    query = select(TaskComplicationLink).where(TaskComplicationLink.task_id == task_id)
    if level is not None:
        allowed_levels = LEVELS[: LEVELS.index(level) + 1]
        group_query = group_query.where(
            TaskComplicationLinkGroup.level.in_(allowed_levels)
        )
        query = query.where(TaskComplicationLink.level.in_(allowed_levels))
    groups = (await session.scalars(group_query)).all()
    links = (await session.scalars(query)).all()
    children: dict[int | None, list] = defaultdict(list)
    for group in groups:
        children[group.parent_group_id].append(group)
    for link in links:
        children[link.group_id].append(link)
    numbers: Counter[Level] = Counter()

    def branch(parent_id: int | None) -> list[CompositionItem]:
        result: list[CompositionItem] = []
        for obj in sorted(
            children[parent_id],
            key=lambda item: (
                LEVELS.index(item.level),
                item.position,
                isinstance(item, TaskComplicationLink),
                item.id,
            ),
        ):
            if isinstance(obj, TaskComplicationLink):
                numbers[obj.level] += 1
                result.append(
                    ComplicationItem(
                        **{
                            key: getattr(obj, key)
                            for key in LinkRead.model_fields
                            if key != "order_number"
                        },
                        order_number=numbers[obj.level],
                    )
                )
            else:
                nested = branch(obj.id)
                # В редакторе пустые группы видны, в пресете пустые ветки не показываем.
                if nested or level is None:
                    group = ComplicationGroupRead.model_validate(obj)
                    group.items = nested
                    result.append(group)
        return result

    return branch(None)


def flatten(items: Sequence[CompositionItem]) -> list[ComplicationItem]:
    result: list[ComplicationItem] = []
    for item in items:
        if isinstance(item, ComplicationGroupRead):
            result.extend(flatten(item.items))
        else:
            result.append(item)
    return result


def by_level(items: Sequence[CompositionItem]) -> dict[Level, list[CompositionItem]]:
    """Группы уже однородны по уровню; пустые ветки сохраняют свой явный level."""
    result: dict[Level, list[CompositionItem]] = {level: [] for level in LEVELS}
    for item in items:
        result[item.level].append(item)
    return result


async def configuration(session: AsyncSession, task_id: int, preset_id: int):
    preset = await get(session, TaskLevelPreset, preset_id, task_id=task_id)
    return {
        "preset": preset,
        "complications": await read(session, task_id, preset.level),
    }


async def ensure_publishable(session: AsyncSession, obj: Task) -> None:
    await flush(session)
    if obj.status != TaskStatus.PUBLISHED:
        return
    await ensure_present(session, obj.id)
    presets = (
        await session.scalars(
            select(TaskLevelPreset).where(TaskLevelPreset.task_id == obj.id)
        )
    ).all()
    if not presets:
        raise MissingPresetsError()
    # Для проверки достаточно уровней пунктов, структура групп на доступность не влияет.
    levels = set(
        (
            await session.scalars(
                select(TaskComplicationLink.level)
                .where(TaskComplicationLink.task_id == obj.id)
                .distinct()
            )
        ).all()
    )
    for preset in presets:
        if not levels.intersection(LEVELS[: LEVELS.index(preset.level) + 1]):
            raise EmptyConfigurationError(
                f"Пресет {preset.level} не содержит требований"
            )


async def save(session: AsyncSession, parent: Task, data: CompositionUpdate):
    task_id = parent.id
    groups = {
        obj.id: obj
        for obj in (
            await session.scalars(
                select(TaskComplicationLinkGroup).where(
                    TaskComplicationLinkGroup.task_id == task_id
                )
            )
        ).all()
    }
    links = {
        obj.id: obj
        for obj in (
            await session.scalars(
                select(TaskComplicationLink).where(
                    TaskComplicationLink.task_id == task_id
                )
            )
        ).all()
    }
    entries = []

    def collect(items, parent_node=None):
        positions = Counter()
        for item in items:
            position = positions[item.level]
            positions[item.level] += 1
            entries.append((item, parent_node, position))
            if isinstance(item, CompositionGroup):
                collect(item.items, item)

    collect(data.items)
    template_ids = set()
    for item, _, _ in entries:
        existing = groups if isinstance(item, CompositionGroup) else links
        if item.id is not None and item.id not in existing:
            raise NotFoundError("Элемент структуры не принадлежит этому заданию")
        if not isinstance(item, CompositionGroup) and item.complication_id is not None:
            template_ids.add(item.complication_id)
    if template_ids:
        available = set(
            (
                await session.scalars(
                    select(TaskComplication.id)
                    .where(TaskComplication.id.in_(template_ids))
                    .order_by(TaskComplication.id)
                    .with_for_update()
                )
            ).all()
        )
        if available != template_ids:
            raise NotFoundError("Один из шаблонов требований не найден")

    group_nodes = {}
    retained_groups = set()
    retained_links = set()
    for item, _, position in entries:
        if isinstance(item, CompositionGroup):
            obj = (
                groups[item.id]
                if item.id is not None
                else TaskComplicationLinkGroup(task_id=task_id)
            )
            obj.title, obj.level, obj.position = item.title, item.level, position
            session.add(obj)
            group_nodes[id(item)] = obj
            if item.id is not None:
                retained_groups.add(item.id)
    await flush(session)
    for item, parent_node, position in entries:
        parent_group_id = (
            group_nodes[id(parent_node)].id if parent_node is not None else None
        )
        if isinstance(item, CompositionGroup):
            group_nodes[id(item)].parent_group_id = parent_group_id
            continue
        values = item.model_dump(exclude={"id", "kind"})
        if item.id is not None:
            obj = links[item.id]
            if "complication_id" not in item.model_fields_set:
                values.pop("complication_id")
            confirm_template(obj, values)
            retained_links.add(item.id)
        else:
            obj = TaskComplicationLink(task_id=task_id)
            session.add(obj)
        assign(obj, values)
        obj.group_id, obj.position = parent_group_id, position
    for link_id, obj in links.items():
        if link_id not in retained_links:
            await session.delete(obj)
    removed_groups = groups.keys() - retained_groups
    for group_id in removed_groups:
        groups[group_id].parent_group_id = None
    # Сначала переносим пункты и убираем ссылки между удаляемыми группами.
    await flush(session)
    if removed_groups:
        await session.execute(
            delete(TaskComplicationLinkGroup).where(
                TaskComplicationLinkGroup.id.in_(removed_groups)
            )
        )
    parent.updated_at = func.clock_timestamp()
    await ensure_publishable(session, parent)
