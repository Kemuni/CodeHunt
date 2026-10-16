from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.base import APIResponseRouter
from app.api.deps import get_db
from app.models import ContactRequest, RequestUserRole
from app.schemas import (
    CandidateContactRequestIn,
    ContactRequestPublic,
    EmployerContactRequestIn,
    SuccessResponse,
)

router = APIResponseRouter(prefix="/contact-request", tags=["contact-request"])


@router.post(
    "/candidate",
    summary="Создание запроса на связь от соискателя",
    response_model=SuccessResponse[ContactRequestPublic],
)
async def create_by_candidate(
    contact_request_in: CandidateContactRequestIn, db: AsyncSession = Depends(get_db)
):
    post = ContactRequest(
        role=RequestUserRole.CANDIDATE, **contact_request_in.model_dump()
    )
    db.add(post)
    await db.commit()

    return SuccessResponse(data=post)


@router.post(
    "/employer",
    summary="Создание запроса на связь от работодателя",
    response_model=SuccessResponse[ContactRequestPublic],
)
async def create_by_employer(
    contact_request_in: EmployerContactRequestIn, db: AsyncSession = Depends(get_db)
):
    post = ContactRequest(
        role=RequestUserRole.EMPLOYER, **contact_request_in.model_dump()
    )
    db.add(post)
    await db.commit()

    return SuccessResponse(data=post)
