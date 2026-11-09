import type { QueryClient } from "@tanstack/react-query"

export const publicTaskKey = (slug: string) => ["public-task", slug] as const

/** Инвалидируем и прежний slug: задача могла сменить адрес или стать недоступной. */
export async function invalidateTaskQueries(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["task-catalog"] }),
    client.invalidateQueries({ queryKey: ["public-task"] }),
  ])
}
