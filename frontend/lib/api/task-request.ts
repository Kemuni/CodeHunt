export interface ValidationProblem {
  field: string
  message: string
  code?: string
}

interface TaskRequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

/** Сохраняет HTTP-статус, код и ошибки полей для toast, формы и обработки конфликта revision. */
export class TaskApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public issues: ValidationProblem[] = [],
  ) {
    super(message)
  }
}

/** Обёртка fetch: отправляет JSON или FormData через Next.js-прокси и разбирает единый ответ backend. */
export async function taskRequest<T>(path: string, options: TaskRequestOptions = {}): Promise<T> {
  const multipart = options.body instanceof FormData
  const response = await fetch(`/api/backend/${path}`, {
    method: options.method ?? "GET",
    headers: options.body && !multipart ? { "Content-Type": "application/json" } : undefined,
    body:
      options.body === undefined
        ? undefined
        : multipart
          ? (options.body as FormData)
          : JSON.stringify(options.body),
    cache: "no-store",
    signal: options.signal,
  }).catch((cause) => {
    if (cause instanceof Error && cause.name === "AbortError") throw cause
    throw new TaskApiError(
      "Не удалось связаться с сервером. Повторите попытку.",
      0,
      "network_error",
    )
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.success) {
    const error = json?.errors
    const details: Record<string, unknown>[] = Array.isArray(error?.details)
      ? error.details
      : Array.isArray(json?.detail)
        ? json.detail
        : []
    const issues = details.map((detail) => ({
      field:
        typeof detail.field === "string"
          ? detail.field
          : Array.isArray(detail.loc)
            ? detail.loc.filter((x) => x !== "body").join(".")
            : "",
      message:
        typeof detail.message === "string"
          ? detail.message
          : typeof detail.msg === "string"
            ? detail.msg
            : "Проверьте значение",
      code: typeof detail.code === "string" ? detail.code : undefined,
    }))
    throw new TaskApiError(
      error?.message ?? `Ошибка сервера (${response.status})`,
      response.status,
      error?.code ?? "request_failed",
      issues,
    )
  }
  return json.data as T
}
