export const JSON_BODY_LIMIT = 2 * 1024 * 1024
const MULTIPART_OVERHEAD = 1024 * 1024

/** Лимиты входящего прокси: 4 фото по 5 МиБ либо одно вложение до 50 МиБ. */
export function requestBodyLimit(path: string[], method: string): number {
  if (
    method === "POST" &&
    path.length === 4 &&
    path[0] === "editor" &&
    ["tasks", "task-drafts"].includes(path[1]) &&
    /^[1-9][0-9]*$/.test(path[2])
  ) {
    if (path[3] === "photos") return 20 * 1024 * 1024 + MULTIPART_OVERHEAD
    if (path[3] === "resources") return 50 * 1024 * 1024 + MULTIPART_OVERHEAD
  }
  return JSON_BODY_LIMIT
}
