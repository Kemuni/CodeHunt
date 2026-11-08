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
        "cache-control": "no-store",
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

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE }
