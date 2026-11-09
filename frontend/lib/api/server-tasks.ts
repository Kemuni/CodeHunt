import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { backendOrigin } from "../backend-origin"
import { backendSessionToken } from "../backend-session"
import type { TaskDetail } from "./task-contract"

/** Мемоизация только в пределах серверного рендера; общий кеш персональных ТЗ запрещён. */
export const publicTask = cache(async (slug: string): Promise<TaskDetail> => {
  if (slug.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  const token = await backendSessionToken((await headers()).get("cookie") ?? "")
  const response = await fetch(`${backendOrigin}/api/tasks/by-slug/${encodeURIComponent(slug)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  if (response.status === 404 || response.status === 401 || response.status === 403) notFound()
  if (!response.ok) throw new Error("Не удалось загрузить задачу")
  const result = await response.json()
  if (!result.success || !result.data) throw new Error("Не удалось загрузить задачу")
  return result.data as TaskDetail
})
