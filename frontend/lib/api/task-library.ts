import type { CategoryLibrary, DeveloperLibrary, TemplateRead } from "./task-contract"
import { taskRequest } from "./task-request"

export type CategoryPayload = Pick<CategoryLibrary, "title" | "parent_id" | "developer_type">
export type TemplatePayload = Pick<TemplateRead, "title" | "description" | "category_id">

export const taskLibraryApi = {
  list: () => taskRequest<DeveloperLibrary[]>("task-complications/library"),
  createCategory: (body: CategoryPayload) =>
    taskRequest<CategoryLibrary>("task-complication-categories", { method: "POST", body }),
  updateCategory: (id: number, body: CategoryPayload) =>
    taskRequest<CategoryLibrary>(`task-complication-categories/${id}`, { method: "PATCH", body }),
  deleteCategory: (id: number) =>
    taskRequest<null>(`task-complication-categories/${id}`, { method: "DELETE" }),
  createTemplate: (body: TemplatePayload) =>
    taskRequest<TemplateRead>("task-complications", { method: "POST", body }),
  updateTemplate: (id: number, body: TemplatePayload) =>
    taskRequest<TemplateRead>(`task-complications/${id}`, { method: "PATCH", body }),
  deleteTemplate: (id: number) =>
    taskRequest<null>(`task-complications/${id}`, { method: "DELETE" }),
}
