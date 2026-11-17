import { client } from "./generated/client.gen"

export interface ValidationProblem {
  field: string
  message: string
  code?: string
}

/** Сохраняет HTTP-статус, код и ошибки полей для toast, формы и обработки конфликта revision. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public issues: ValidationProblem[] = [],
  ) {
    super(message)
  }
}

type SuccessEnvelope<T> = { success?: true; data?: T | null }
type SdkResult<T> = Promise<{ data?: T; error?: unknown; response?: Response }>

client.setConfig({ cache: "no-store" })

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function apiError(cause: unknown, response?: Response): ApiError {
  if (cause instanceof ApiError) return cause
  if (cause instanceof Error && cause.name === "AbortError") throw cause
  if (!response)
    return new ApiError("Не удалось связаться с сервером. Повторите попытку.", 0, "network_error")

  const json = record(cause)
  const error = record(json?.errors)
  const details = Array.isArray(error?.details)
    ? error.details
    : Array.isArray(json?.detail)
      ? json.detail
      : []
  const issues = details.map((value): ValidationProblem => {
    const detail = record(value)
    return {
      field:
        typeof detail?.field === "string"
          ? detail.field
          : Array.isArray(detail?.loc)
            ? detail.loc.filter((part) => part !== "body").join(".")
            : "",
      message:
        typeof detail?.message === "string"
          ? detail.message
          : typeof detail?.msg === "string"
            ? detail.msg
            : "Проверьте значение",
      code: typeof detail?.code === "string" ? detail.code : undefined,
    }
  })
  return new ApiError(
    typeof error?.message === "string" ? error.message : `Ошибка сервера (${response.status})`,
    response.status,
    typeof error?.code === "string" ? error.code : "request_failed",
    issues,
  )
}

async function settle<T>(request: SdkResult<T>) {
  try {
    const result = await request
    if (result.error !== undefined) throw apiError(result.error, result.response)
    if (record(result.data)?.success === false) throw apiError(result.data, result.response)
    return result.data
  } catch (cause) {
    throw apiError(cause)
  }
}

/** Извлекает полезные данные из общего ответа backend и отклоняет неполный ответ. */
export async function apiData<T extends SuccessEnvelope<unknown>>(
  request: SdkResult<T>,
): Promise<NonNullable<T["data"]>> {
  const envelope = await settle(request)
  if (!envelope?.success || envelope.data == null)
    throw new ApiError("Сервер вернул неполный ответ", 0, "invalid_response")
  return envelope.data as NonNullable<T["data"]>
}

/** Удаляющие операции возвращают успешный ответ с data: null. */
export async function apiVoid<T extends SuccessEnvelope<unknown>>(
  request: SdkResult<T>,
): Promise<null> {
  const envelope = await settle(request)
  if (!envelope?.success) throw new ApiError("Сервер вернул неполный ответ", 0, "invalid_response")
  return null
}
