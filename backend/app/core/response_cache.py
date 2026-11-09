from starlette.types import ASGIApp, Message, Receive, Scope, Send


class ResponseCacheMiddleware:
    """Запрещает кеширование API-ответов, сохраняя отдельные правила медиа."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"].startswith("/api/media/"):
            await self.app(scope, receive, send)
            return

        async def no_store(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() != b"cache-control"
                ]
                message = {
                    **message,
                    "headers": [*headers, (b"cache-control", b"no-store")],
                }
            await send(message)

        await self.app(scope, receive, no_store)
