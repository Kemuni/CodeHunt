from app.api.base import APIResponseRouter

router = APIResponseRouter(tags=["utils"])


@router.get("/health-check/", summary="Проверить доступность API.")
async def health_check():
    return {"status": "ok"}
