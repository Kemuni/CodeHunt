from enum import StrEnum
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    AlreadyExistsError,
    ConstraintViolationError,
    DomainError,
    NotFoundError,
    ParentCycleError,
    ReferenceConflictError,
)


async def get(
    session: AsyncSession, model, object_id: int, *, lock: bool = False, **filters
):
    statement = select(model).filter_by(id=object_id, **filters)
    if lock:
        statement = statement.with_for_update().execution_options(
            populate_existing=True
        )
    obj = await session.scalar(statement)
    if obj is None:
        raise NotFoundError()
    return obj


async def page(
    session: AsyncSession, statement, limit: int, offset: int
) -> dict[str, Any]:
    total = await session.scalar(
        select(func.count()).select_from(statement.order_by(None).subquery())
    )
    items = (await session.scalars(statement.limit(limit).offset(offset))).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def integrity_error(exc: IntegrityError) -> DomainError | None:
    original = exc.orig
    sqlstate = getattr(original, "sqlstate", None)
    if sqlstate == "23505":
        return AlreadyExistsError()
    if sqlstate in {"23503", "23001"}:
        return ReferenceConflictError()
    if sqlstate in {"23514", "23502"}:
        return ConstraintViolationError()
    return None


async def flush(session: AsyncSession) -> None:
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        error = integrity_error(exc)
        if error:
            raise error from exc
        raise


async def commit(session: AsyncSession, obj=None):
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        error = integrity_error(exc)
        if error:
            raise error from exc
        raise
    if obj is not None:
        await session.refresh(obj)
    return obj


class Hierarchy(StrEnum):
    TASKS = "codehunt.tasks.parent"
    CATEGORIES = "codehunt.task_complication_categories.parent"


async def lock_hierarchy(session: AsyncSession, hierarchy: Hierarchy) -> None:
    """Последовательно выполняет смену родителей в одной иерархии до конца транзакции.

    Без блокировки одновременные A -> B и B -> A могут обе пройти проверку цикла.
    PostgreSQL получает стабильный ключ из имени ресурса.
    """
    await session.execute(
        select(func.pg_advisory_xact_lock(func.hashtextextended(hierarchy.value, 0)))
    )


async def check_parent(
    session: AsyncSession,
    model,
    parent_id: int | None,
    object_id: int | None,
    parent_field: str,
):
    """Проверяет существование родителя и циклы одним запросом всей цепочки предков."""
    if parent_id is None:
        return
    parent_column = getattr(model, parent_field)
    ancestors = (
        select(model.id, parent_column.label("parent_id"))
        .where(model.id == parent_id)
        .cte("ancestors", recursive=True)
    )
    # UNION убирает повторы и завершает запрос даже при уже повреждённой иерархии.
    ancestors = ancestors.union(
        select(model.id, parent_column).join(
            ancestors, model.id == ancestors.c.parent_id
        )
    )
    rows = await session.execute(select(ancestors.c.id, ancestors.c.parent_id))
    parents: dict[int, int | None] = {row.id: row.parent_id for row in rows}
    if parent_id not in parents:
        raise NotFoundError("Родительский объект не найден")
    visited: set[int] = set()
    while parent_id is not None:
        if parent_id == object_id or parent_id in visited:
            raise ParentCycleError()
        visited.add(parent_id)
        parent_id = parents[parent_id]


def assign(obj, values: dict) -> None:
    for key, value in values.items():
        setattr(obj, key, value)
