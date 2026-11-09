import { backendOrigin } from "./backend-origin"
import { backendSessionToken } from "./backend-session"
import { requestBodyLimit } from "./request-limits"

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

export async function proxyBackend(
  request: Request,
  path: string[],
  timeoutMs = 120_000,
): Promise<Response> {
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
  const isMedia = path[0] === "media"
  const limit = requestBodyLimit(path, request.method)
  const length = request.headers.get("content-length")
  const tooLarge = () =>
    errorResponse(413, "request_too_large", "Запрос превышает допустимый размер")
  if (!readOnly && length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
    return tooLarge()
  const controller = new AbortController()
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = AbortSignal.any([request.signal, timeout, controller.signal])
  let exceeded = false

  try {
    // Передаём только нужные заголовки. Пользователя определяет сессия, а его
    // права проверяет backend; клиентские Cookie и X-User-ID туда не попадают.
    const headers = copyHeaders(
      request.headers,
      isMedia ? ["content-type", "if-none-match"] : ["content-type"],
    )
    const token = await backendSessionToken(request.headers.get("cookie") ?? "")
    if (token) headers.set("authorization", `Bearer ${token}`)

    // Передаём тело потоком с обратным давлением, считая байты даже без Content-Length.
    let body: ReadableStream<Uint8Array> | undefined
    if (!readOnly && request.body) {
      let received = 0
      body = request.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, stream) {
            received += chunk.byteLength
            if (received > limit) {
              exceeded = true
              const error = new Error("request_too_large")
              stream.error(error)
              controller.abort(error)
            } else stream.enqueue(chunk)
          },
        }),
        { signal },
      )
    }

    const init: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      body,
      duplex: body ? "half" : undefined,
      cache: "no-store",
      signal,
    }
    const response = await fetch(url, init)
    if (exceeded) {
      await response.body?.cancel()
      return tooLarge()
    }

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
    if (exceeded) return tooLarge()
    if (timeout.aborted)
      return errorResponse(504, "backend_timeout", "Сервер не ответил вовремя. Повторите попытку.")
    return errorResponse(
      502,
      "backend_unavailable",
      "Не удалось связаться с сервером. Повторите попытку.",
    )
  }
}
