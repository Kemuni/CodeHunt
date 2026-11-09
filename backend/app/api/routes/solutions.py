from typing import Literal

from sqlalchemy import select

from app.api.base import APIResponseRouter
from app.api.deps import CurrentUser, SessionDep
from app.api.pagination import Limit, Offset
from app.models import Task, TaskSolution, TaskSolutionComplication
from app.schemas import SuccessResponse
from app.schemas.common import Page, PositiveID
from app.schemas.domain import (
    OrderInput,
    SolutionCreate,
    SolutionDetail,
    SolutionLinkCreate,
    SolutionLinkRead,
    SolutionLinkUpdate,
    SolutionRead,
    SolutionUpdate,
)
from app.services import catalog, solutions
from app.services.common import assign, commit, get, page

router = APIResponseRouter(tags=["solutions"])


@router.post(
    "/tasks/{task_id}/solutions",
    response_model=SuccessResponse[SolutionDetail],
    status_code=201,
    summary="Начать решение из пресета с возможностью исключить любые пункты.",
)
async def create(
    task_id: PositiveID, data: SolutionCreate, db: SessionDep, user: CurrentUser
):
    return SuccessResponse(data=await solutions.create(db, task_id, user, data))


@router.get(
    "/solutions",
    response_model=SuccessResponse[Page[SolutionRead]],
    summary="Список решений текущего пользователя с фильтрами.",
)
async def listing(
    db: SessionDep,
    user: CurrentUser,
    limit: Limit = 20,
    offset: Offset = 0,
    task_id: PositiveID | None = None,
    author_id: PositiveID | None = None,
    status: Literal["in_progress", "completed"] | None = None,
):
    query = (
        select(TaskSolution)
        .where(TaskSolution.author_id == user.id)
        .order_by(TaskSolution.created_at.desc(), TaskSolution.id.desc())
    )
    if not user.is_admin:
        query = query.join(Task, Task.id == TaskSolution.task_id).where(
            Task.is_paid.is_(False)
        )
    if task_id is not None:
        query = query.where(TaskSolution.task_id == task_id)
    if author_id is not None:
        query = query.where(TaskSolution.author_id == author_id)
    if status:
        query = query.where(TaskSolution.status == status)
    return SuccessResponse(data=await page(db, query, limit, offset))


@router.get(
    "/solutions/{solution_id}",
    response_model=SuccessResponse[SolutionDetail],
    summary="Получить своё решение с чек-листом и количеством выполненных пунктов.",
)
async def read(solution_id: PositiveID, db: SessionDep, user: CurrentUser):
    obj = await solutions.solution(db, solution_id, user)
    return SuccessResponse(data=await solutions.detail(db, obj))


@router.patch(
    "/solutions/{solution_id}",
    response_model=SuccessResponse[SolutionRead],
    summary="Заполнить описание подхода, ссылку на репозиторий или оценку сложности.",
)
async def update(
    solution_id: PositiveID, data: SolutionUpdate, db: SessionDep, user: CurrentUser
):
    obj = await solutions.solution(db, solution_id, user, lock=True)
    assign(obj, data.model_dump(exclude_unset=True, mode="json"))
    return SuccessResponse(data=await commit(db, obj))


@router.delete(
    "/solutions/{solution_id}",
    response_model=SuccessResponse[None],
    summary="Удалить своё решение вместе с его чек-листом.",
)
async def delete(solution_id: PositiveID, db: SessionDep, user: CurrentUser):
    await db.delete(await solutions.solution(db, solution_id, user, lock=True))
    await commit(db)
    return SuccessResponse()


@router.put(
    "/solutions/{solution_id}/completion",
    response_model=SuccessResponse[SolutionRead],
    summary="Отметить решение завершённым независимо от состояния чек-листа.",
)
async def complete(solution_id: PositiveID, db: SessionDep, user: CurrentUser):
    obj = await solutions.solution(db, solution_id, user, lock=True)
    return SuccessResponse(data=await solutions.completion(db, obj, True))


@router.delete(
    "/solutions/{solution_id}/completion",
    response_model=SuccessResponse[SolutionRead],
    summary="Вернуть решение в работу, очистив дату завершения.",
)
async def reopen(solution_id: PositiveID, db: SessionDep, user: CurrentUser):
    obj = await solutions.solution(db, solution_id, user, lock=True)
    return SuccessResponse(data=await solutions.completion(db, obj, False))


@router.get(
    "/solutions/{solution_id}/complications",
    response_model=SuccessResponse[list[SolutionLinkRead]],
    summary="Получить независимый чек-лист своего решения.",
)
async def links(solution_id: PositiveID, db: SessionDep, user: CurrentUser):
    obj = await solutions.solution(db, solution_id, user)
    return SuccessResponse(data=(await solutions.detail(db, obj)).complications)


@router.post(
    "/solutions/{solution_id}/complications",
    response_model=SuccessResponse[SolutionLinkRead],
    status_code=201,
    summary="Добавить собственное требование в решение.",
)
async def create_link(
    solution_id: PositiveID, data: SolutionLinkCreate, db: SessionDep, user: CurrentUser
):
    await solutions.solution(db, solution_id, user, lock=True)
    obj = TaskSolutionComplication(solution_id=solution_id, **data.model_dump())
    db.add(obj)
    return SuccessResponse(data=await commit(db, obj))


@router.put(
    "/solutions/{solution_id}/complications/order",
    response_model=SuccessResponse[None],
    summary="Установить порядок пунктов чек-листа, передав все их ID.",
)
async def order_links(
    solution_id: PositiveID, data: OrderInput, db: SessionDep, user: CurrentUser
):
    await solutions.solution(db, solution_id, user, lock=True)
    await catalog.reorder(
        db, TaskSolutionComplication, "solution_id", solution_id, data.ids
    )
    await commit(db)
    return SuccessResponse()


@router.get(
    "/solutions/{solution_id}/complications/{link_id}",
    response_model=SuccessResponse[SolutionLinkRead],
    summary="Получить конкретный пункт своего чек-листа.",
)
async def link(
    solution_id: PositiveID, link_id: PositiveID, db: SessionDep, user: CurrentUser
):
    await solutions.solution(db, solution_id, user)
    return SuccessResponse(
        data=await get(db, TaskSolutionComplication, link_id, solution_id=solution_id)
    )


@router.patch(
    "/solutions/{solution_id}/complications/{link_id}",
    response_model=SuccessResponse[SolutionLinkRead],
    summary="Изменить текст пункта или описание его реализации.",
)
async def update_link(
    solution_id: PositiveID,
    link_id: PositiveID,
    data: SolutionLinkUpdate,
    db: SessionDep,
    user: CurrentUser,
):
    await solutions.solution(db, solution_id, user, lock=True)
    obj = await get(db, TaskSolutionComplication, link_id, solution_id=solution_id)
    assign(obj, data.model_dump(exclude_unset=True))
    return SuccessResponse(data=await commit(db, obj))


@router.delete(
    "/solutions/{solution_id}/complications/{link_id}",
    response_model=SuccessResponse[None],
    summary="Убрать любой пункт из своего чек-листа.",
)
async def delete_link(
    solution_id: PositiveID, link_id: PositiveID, db: SessionDep, user: CurrentUser
):
    await solutions.solution(db, solution_id, user, lock=True)
    await db.delete(
        await get(db, TaskSolutionComplication, link_id, solution_id=solution_id)
    )
    await commit(db)
    return SuccessResponse()


@router.put(
    "/solutions/{solution_id}/complications/{link_id}/completion",
    response_model=SuccessResponse[SolutionLinkRead],
    summary="Отметить пункт выполненным с сохранением даты при повторном запросе.",
)
async def complete_link(
    solution_id: PositiveID, link_id: PositiveID, db: SessionDep, user: CurrentUser
):
    await solutions.solution(db, solution_id, user, lock=True)
    obj = await get(db, TaskSolutionComplication, link_id, solution_id=solution_id)
    return SuccessResponse(data=await solutions.completion(db, obj, True))


@router.delete(
    "/solutions/{solution_id}/complications/{link_id}/completion",
    response_model=SuccessResponse[SolutionLinkRead],
    summary="Снять отметку выполнения пункта без изменения статуса решения.",
)
async def reopen_link(
    solution_id: PositiveID, link_id: PositiveID, db: SessionDep, user: CurrentUser
):
    await solutions.solution(db, solution_id, user, lock=True)
    obj = await get(db, TaskSolutionComplication, link_id, solution_id=solution_id)
    return SuccessResponse(data=await solutions.completion(db, obj, False))
