import { getToken } from "next-auth/jwt"
import { NextRequest } from "next/server"
import { backendOrigin } from "./backend-origin"

const MEDIA_HEADERS = [
  "etag",
  "vary",
  "x-content-type-options",
  "content-length",
  "content-disposition",
]

function copyHeaders(source: Headers, names: string[]): Headers {
  const headers = new Headers()
  for (const name of names) {
    const value = source.get(name)
    if (value !== null) headers.set(name, value)
  }
  return headers
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { success: false, errors: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  )
}

async function getBackendToken(request: Request): Promise<string | null> {
  // NextAuth умеет читать и cookie, и Authorization. Оставляем только cookie,
  // чтобы клиент не мог подставить другой способ авторизации через заголовок.
  const cookieRequest = new NextRequest(request.url, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  })
  const session = await getToken({ req: cookieRequest, secret: process.env.NEXTAUTH_SECRET })
  const expiresAt = Date.parse(session?.backendExpiresAt ?? "")
  return session?.backendToken && expiresAt > Date.now() ? session.backendToken : null
}

export async function proxyBackend(request: Request, path: string[]): Promise<Response> {
  // Обмен OAuth-токена доступен серверному NextAuth напрямую. Не открываем его
  // через прокси; сегменты пути также не должны менять адрес назначения через ../.
  if (path[0] === "auth" || path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    return errorResponse(404, "not_found", "Маршрут не найден")
  }

  const readOnly = request.method === "GET" || request.method === "HEAD"
  // Браузер отправляет cookie автоматически. Для мутаций проверяем источник,
  // чтобы чужой сайт не мог выполнить действие от имени вошедшего пользователя.
  if (!readOnly) {
    const expectedOrigin = new URL(process.env.NEXTAUTH_URL ?? request.url).origin
    if (request.headers.get("origin") !== expectedOrigin) {
      return errorResponse(403, "invalid_origin", "Недопустимый источник запроса")
    }
  }

  const url = new URL(`/api/${path.join("/")}`, backendOrigin)
  url.search = new URL(request.url).search
  const isMedia = path[0] === "media" || (path[0] === "editor" && path[1] === "media")

  try {
    // Передаём только нужные заголовки. Пользователя определяет сессия, а его
    // права проверяет backend; клиентские Cookie и X-User-ID туда не попадают.
    const headers = copyHeaders(
      request.headers,
      isMedia ? ["content-type", "if-none-match"] : ["content-type"],
    )
    const token = await getBackendToken(request)
    if (token) headers.set("authorization", `Bearer ${token}`)

    const response = await fetch(url, {
      method: request.method,
      headers,
      body: readOnly ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: request.signal,
    })

    // Next.js не кеширует ответы от backend. Браузер сохраняет правила кеша
    // медиа и ETag: backend проверяет доступ даже перед ответом 304.
    const responseHeaders = copyHeaders(response.headers, isMedia ? MEDIA_HEADERS : [])
    responseHeaders.set("content-type", response.headers.get("content-type") ?? "application/json")
    responseHeaders.set(
      "cache-control",
      isMedia ? (response.headers.get("cache-control") ?? "no-store") : "no-store",
    )

    // Отдаём поток без разбора JSON или загрузки всего файла в память.
    return new Response(response.body, { status: response.status, headers: responseHeaders })
  } catch {
    return errorResponse(
      502,
      "backend_unavailable",
      "Не удалось связаться с сервером. Повторите попытку.",
    )
  }
}
