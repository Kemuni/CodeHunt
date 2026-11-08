const backendOrigin =
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"

/** Проксирует API с одного origin; временный ID администратора задаётся только на сервере frontend. */
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const url = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, backendOrigin)
  url.search = new URL(request.url).search
  const headers = new Headers()
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  const isMedia = path[0] === "media" || (path[0] === "editor" && path[1] === "media")
  if (isMedia && request.headers.has("if-none-match"))
    headers.set("if-none-match", request.headers.get("if-none-match")!)
  const libraryWrite =
    ["task-complications", "task-complication-categories"].includes(path[0]) &&
    ["POST", "PATCH", "DELETE"].includes(request.method)
  if (path[0] === "editor" || libraryWrite)
    headers.set("x-user-id", process.env.EDITOR_USER_ID ?? "1")
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: request.signal,
    })
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": isMedia
          ? (response.headers.get("cache-control") ?? "no-store")
          : "no-store",
        ...(isMedia
          ? Object.fromEntries(
              [
                "etag",
                "vary",
                "x-content-type-options",
                "content-length",
                "content-disposition",
              ].flatMap((name) =>
                response.headers.has(name) ? [[name, response.headers.get(name)!]] : [],
              ),
            )
          : {}),
      },
    })
  } catch {
    return Response.json(
      {
        success: false,
        errors: {
          code: "backend_unavailable",
          message: "Не удалось связаться с сервером. Повторите попытку.",
        },
      },
      { status: 502 },
    )
  }
}

export { proxy as GET, proxy as HEAD, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE }
