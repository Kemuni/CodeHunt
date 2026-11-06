import type {
  DraftRead,
  TaskDetail,
  TaskRead,
  CompositionUpdate,
  ComplicationItem,
  ComplicationGroupRead,
  DownloadURL,
  Page_TaskRead_,
  Page_DraftRead_,
  TaskUpdate,
  PresetCreate,
  PresetRead,
  JsonValue,
  Configuration,
} from "./task-contract"

import { taskRequest } from "./task-request"

/** Неполная форма черновика: обязательные поля проверяет backend перед публикацией. */
export type DraftPayload = Record<string, JsonValue>
/** Операции с данными задач. Кэш и уведомления остаются на стороне React Query и редактора. */
export const tasksApi = {
  list: (admin: boolean, offset = 0, q = "") =>
    taskRequest<Page_TaskRead_>(
      `${admin ? "editor/tasks/all" : "tasks"}?limit=20&offset=${offset}${!admin && q ? `&q=${encodeURIComponent(q)}` : ""}`,
    ),
  drafts: (offset = 0) =>
    taskRequest<Page_DraftRead_>(`editor/task-drafts?limit=20&offset=${offset}`),
  task: (id: number, admin = true) =>
    taskRequest<TaskDetail>(`${admin ? "editor/" : ""}tasks/${id}`),
  configuration: (id: number, presetId: number) =>
    taskRequest<Configuration>(`tasks/${id}/presets/${presetId}/configuration`),
  draft: (id: number) => taskRequest<DraftRead>(`editor/task-drafts/${id}`),
  createDraft: (payload: DraftPayload) =>
    taskRequest<DraftRead>("editor/task-drafts", { method: "POST", body: { payload } }),
  updateDraft: (id: number, revision: number, payload: DraftPayload) =>
    taskRequest<DraftRead>(`editor/task-drafts/${id}`, {
      method: "PATCH",
      body: { revision, payload },
    }),
  publish: (id: number, revision: number) =>
    taskRequest<TaskRead>(`editor/task-drafts/${id}/publish`, {
      method: "POST",
      body: { revision },
    }),
  updateTask: (id: number, body: TaskUpdate) =>
    taskRequest<TaskRead>(`editor/tasks/${id}`, { method: "PATCH", body }),
  composition: (id: number, body: CompositionUpdate) =>
    taskRequest<Array<ComplicationItem | ComplicationGroupRead>>(`editor/tasks/${id}/composition`, {
      method: "PUT",
      body,
    }),
  createPreset: (id: number, body: PresetCreate) =>
    taskRequest<PresetRead>(`editor/tasks/${id}/presets`, { method: "POST", body }),
  updatePreset: (id: number, presetId: number, body: PresetCreate) =>
    taskRequest<PresetRead>(`editor/tasks/${id}/presets/${presetId}`, { method: "PATCH", body }),
  deletePreset: (id: number, presetId: number) =>
    taskRequest<null>(`editor/tasks/${id}/presets/${presetId}`, { method: "DELETE" }),
  resourceUrl: (kind: "draft" | "task", id: number, resourceId: number, admin = true) =>
    taskRequest<DownloadURL>(
      `${admin ? "editor/" : ""}${kind === "draft" ? "task-drafts" : "tasks"}/${id}/resources/${resourceId}/download-url`,
    ),
}
