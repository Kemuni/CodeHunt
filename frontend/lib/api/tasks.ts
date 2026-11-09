import type {
  DraftRead,
  TaskDetail,
  TaskRead,
  DraftSummary,
  Page,
  TaskUpdate,
  TaskSave,
  JsonValue,
} from "./task-contract"

import { apiRequest } from "./request"
import {
  catalogSearchParams,
  defaultCatalogFilters,
  type CatalogFilters,
} from "@/lib/tasks/catalog-filters"

/** Неполная форма черновика: обязательные поля проверяет backend перед публикацией. */
export type DraftPayload = Record<string, JsonValue>
/** Операции с данными задач. Кэш и уведомления остаются на стороне React Query и редактора. */
export const tasksApi = {
  list: (
    admin: boolean,
    offset = 0,
    filters: CatalogFilters = defaultCatalogFilters,
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<TaskRead>>(
      `${admin ? "editor/tasks" : "tasks"}?${catalogSearchParams(filters, offset)}`,
      { signal },
    ),
  drafts: (offset = 0) =>
    apiRequest<Page<DraftSummary>>(`editor/task-drafts?limit=20&offset=${offset}`),
  task: (id: number) => apiRequest<TaskDetail>(`editor/tasks/${id}`),
  publicTask: (slug: string) => apiRequest<TaskDetail>(`tasks/by-slug/${encodeURIComponent(slug)}`),
  draft: (id: number) => apiRequest<DraftRead>(`editor/task-drafts/${id}`),
  createDraft: (payload: DraftPayload) =>
    apiRequest<DraftRead>("editor/task-drafts", { method: "POST", body: { payload } }),
  updateDraft: (id: number, revision: number, payload: DraftPayload) =>
    apiRequest<DraftRead>(`editor/task-drafts/${id}`, {
      method: "PATCH",
      body: { revision, payload },
    }),
  deleteDraft: (id: number, revision: number) =>
    apiRequest<null>(`editor/task-drafts/${id}?revision=${revision}`, { method: "DELETE" }),
  publish: (id: number, revision: number) =>
    apiRequest<TaskDetail>(`editor/task-drafts/${id}/publish`, {
      method: "POST",
      body: { revision },
    }),
  updateTask: (id: number, body: TaskUpdate) =>
    apiRequest<TaskRead>(`editor/tasks/${id}`, { method: "PATCH", body }),
  deleteTask: (id: number) => apiRequest<null>(`editor/tasks/${id}`, { method: "DELETE" }),
  saveTask: (id: number, body: TaskSave) =>
    apiRequest<TaskDetail>(`editor/tasks/${id}`, { method: "PUT", body }),
}
