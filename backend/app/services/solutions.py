from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    InvalidExclusionsError,
    NotFoundError,
    SolutionAuthorMismatchError,
)
from app.models import Task, TaskSolution, TaskSolutionComplication, User
from app.schemas.domain import (
    SolutionCreate,
    SolutionDetail,
    SolutionLinkRead,
    SolutionRead,
)
from app.services import catalog, composition
from app.services.common import commit, flush, get
from app.services.composition import flatten


async def solution(session: AsyncSession, solution_id: int, user: User, *, lock=False):
    obj = await get(session, TaskSolution, solution_id, lock=lock, author_id=user.id)
    parent = await get(session, Task, obj.task_id)
    # Снимок решения не должен обходить ограничение доступа к платному ТЗ.
    if parent.is_paid and not user.is_admin:
        raise NotFoundError()
    return obj


async def detail(session: AsyncSession, obj: TaskSolution) -> SolutionDetail:
    links = (
        await session.scalars(
            select(TaskSolutionComplication)
            .where(TaskSolutionComplication.solution_id == obj.id)
            .order_by(
                TaskSolutionComplication.order_number, TaskSolutionComplication.id
            )
        )
    ).all()
    return SolutionDetail(
        **SolutionRead.model_validate(obj).model_dump(),
        complications=[SolutionLinkRead.model_validate(link) for link in links],
        total_count=len(links),
        completed_count=sum(link.resolved_at is not None for link in links),
    )


async def create(session: AsyncSession, task_id: int, user: User, data: SolutionCreate):
    if data.author_id != user.id:
        raise SolutionAuthorMismatchError()
    parent = await catalog.task(session, task_id, public=True, lock=True, user=user)
    config = await composition.configuration(
        session, task_id, data.task_level_preset_id
    )
    preset, links = config["preset"], flatten(config["complications"])
    excluded = set(data.excluded_complication_link_ids)
    if not excluded.issubset({link.id for link in links}):
        raise InvalidExclusionsError()
    obj = TaskSolution(
        task_id=task_id,
        task_level_preset_id=preset.id,
        author_id=user.id,
        task_title_snapshot=parent.title,
        task_description_snapshot=parent.full_description,
        preset_level_snapshot=preset.level,
        preset_description_snapshot=preset.description,
    )
    session.add(obj)
    await flush(session)
    for position, link in enumerate(links):
        if link.id not in excluded:
            session.add(
                TaskSolutionComplication(
                    solution_id=obj.id,
                    original_complication_link_id=link.id,
                    title=link.title,
                    description=link.description,
                    acceptance_criteria=link.acceptance_criteria,
                    is_required=link.is_required,
                    order_number=position,
                )
            )
    await commit(session, obj)
    return await detail(session, obj)


async def completion(session: AsyncSession, obj, completed: bool):
    if completed:
        if obj.resolved_at is None:
            obj.resolved_at = datetime.now(UTC)
    else:
        obj.resolved_at = None
    return await commit(session, obj)
