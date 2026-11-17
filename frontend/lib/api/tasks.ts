import type {
  DraftRead,
  DraftSummary,
  JsonValue,
  Page,
  TaskDetail,
  TaskRead,
  TaskSave,
  TaskUpdate,
} from "./task-contract"
import type { EditorTasksApiEditorTasksGetData } from "./generated/types.gen"
import {
  bySlugApiTasksBySlugSlugGet,
  createApiEditorTaskDraftsPost,
  deleteApiEditorTaskDraftsDraftIdDelete,
  deleteTaskApiEditorTasksTaskIdDelete,
  editorTaskApiEditorTasksTaskIdGet,
  editorTasksApiEditorTasksGet,
  listingApiEditorTaskDraftsGet,
  publishApiEditorTaskDraftsDraftIdPublishPost,
  readApiEditorTaskDraftsDraftIdGet,
  saveTaskApiEditorTasksTaskIdPut,
  tasksApiTasksGet,
  updateApiEditorTaskDraftsDraftIdPatch,
  updateTaskApiEditorTasksTaskIdPatch,
} from "./generated/sdk.gen"
import { apiData, apiVoid } from "./request"
import { defaultCatalogFilters, type CatalogFilters } from "@/lib/tasks/catalog-filters"

/** Неполная форма черновика: обязательные поля проверяет backend перед публикацией. */
export type DraftPayload = Record<string, JsonValue>

function catalogQuery(
  filters: CatalogFilters,
  offset: number,
): NonNullable<EditorTasksApiEditorTasksGetData["query"]> {
  return {
    limit: 20,
    offset,
    sort: filters.sort,
    ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
    ...(filters.access !== "all" ? { access: filters.access } : {}),
    ...(filters.developerTypes.length ? { developer_type: filters.developerTypes } : {}),
    ...(filters.difficulty[0] !== 0 ? { difficulty_min: filters.difficulty[0] } : {}),
    ...(filters.difficulty[1] !== 10 ? { difficulty_max: filters.difficulty[1] } : {}),
  }
}

/** Операции с данными задач. Кэш и уведомления остаются на стороне React Query и редактора. */
export const tasksApi = {
  list: (
    admin: boolean,
    offset = 0,
    filters: CatalogFilters = defaultCatalogFilters,
    signal?: AbortSignal,
  ) => {
    const options = { query: catalogQuery(filters, offset), signal }
    return apiData(
      admin ? editorTasksApiEditorTasksGet(options) : tasksApiTasksGet(options),
    ) as Promise<Page<TaskRead>>
  },
  drafts: (offset = 0) =>
    apiData(listingApiEditorTaskDraftsGet({ query: { limit: 20, offset } })) as Promise<
      Page<DraftSummary>
    >,
  task: (id: number) =>
    apiData(editorTaskApiEditorTasksTaskIdGet({ path: { task_id: id } })) as Promise<TaskDetail>,
  publicTask: (slug: string) =>
    apiData(bySlugApiTasksBySlugSlugGet({ path: { slug } })) as Promise<TaskDetail>,
  draft: (id: number) =>
    apiData(readApiEditorTaskDraftsDraftIdGet({ path: { draft_id: id } })) as Promise<DraftRead>,
  createDraft: (payload: DraftPayload) =>
    apiData(createApiEditorTaskDraftsPost({ body: { payload } })) as Promise<DraftRead>,
  updateDraft: (id: number, revision: number, payload: DraftPayload) =>
    apiData(
      updateApiEditorTaskDraftsDraftIdPatch({
        path: { draft_id: id },
        body: { revision, payload },
      }),
    ) as Promise<DraftRead>,
  deleteDraft: (id: number, revision: number) =>
    apiVoid(
      deleteApiEditorTaskDraftsDraftIdDelete({ path: { draft_id: id }, query: { revision } }),
    ),
  publish: (id: number, revision: number) =>
    apiData(
      publishApiEditorTaskDraftsDraftIdPublishPost({ path: { draft_id: id }, body: { revision } }),
    ) as Promise<TaskDetail>,
  updateTask: (id: number, body: TaskUpdate) =>
    apiData(
      updateTaskApiEditorTasksTaskIdPatch({ path: { task_id: id }, body }),
    ) as Promise<TaskRead>,
  deleteTask: (id: number) =>
    apiVoid(deleteTaskApiEditorTasksTaskIdDelete({ path: { task_id: id } })),
  saveTask: (id: number, body: TaskSave) =>
    apiData(
      saveTaskApiEditorTasksTaskIdPut({ path: { task_id: id }, body }),
    ) as Promise<TaskDetail>,
}
