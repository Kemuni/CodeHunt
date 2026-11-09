from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.exception_handlers import error_response

# Общий предел для прямого доступа к API. Правила отдельных маршрутов задаёт Next.js.
MAX_REQUEST_BYTES = 64 * 1024 * 1024


class RequestLimitsMiddleware:
    """Ограничивает фактически полученные байты до разбора JSON/multipart."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = MAX_REQUEST_BYTES
        for name, value in scope["headers"]:
            if name == b"content-length":
                try:
                    length = int(value)
                except ValueError:
                    length = -1
                if length < 0 or length > limit:
                    response = error_response(
                        "http_413", "Запрос превышает допустимый размер", 413
                    )
                    await response(scope, receive, send)
                    return
        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise HTTPException(413, "Запрос превышает допустимый размер")
            return message

        await self.app(scope, limited_receive, send)
