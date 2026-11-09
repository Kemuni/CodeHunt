from app.schemas.common import APIResponse, ErrorDetail, ErrorResponse, SuccessResponse
from app.schemas.contact_request import (
    CandidateContactRequestIn,
    ContactRequestPublic,
    EmployerContactRequestIn,
)

__all__ = [
    "APIResponse",
    "CandidateContactRequestIn",
    "ContactRequestPublic",
    "EmployerContactRequestIn",
    "ErrorDetail",
    "ErrorResponse",
    "SuccessResponse",
]
