import type { CategoryLibrary, DeveloperLibrary, TemplateRead } from "./task-contract"
import { apiRequest } from "./request"

export type CategoryPayload = Pick<CategoryLibrary, "title" | "parent_id" | "developer_type">
export type TemplatePayload = Pick<TemplateRead, "title" | "description" | "category_id">

export const taskLibraryApi = {
  list: () => apiRequest<DeveloperLibrary[]>("task-complications/library"),
  createCategory: (body: CategoryPayload) =>
    apiRequest<CategoryLibrary>("task-complication-categories", { method: "POST", body }),
  updateCategory: (id: number, body: CategoryPayload) =>
    apiRequest<CategoryLibrary>(`task-complication-categories/${id}`, { method: "PATCH", body }),
  deleteCategory: (id: number) =>
    apiRequest<null>(`task-complication-categories/${id}`, { method: "DELETE" }),
  createTemplate: (body: TemplatePayload) =>
    apiRequest<TemplateRead>("task-complications", { method: "POST", body }),
  updateTemplate: (id: number, body: TemplatePayload) =>
    apiRequest<TemplateRead>(`task-complications/${id}`, { method: "PATCH", body }),
  deleteTemplate: (id: number) =>
    apiRequest<null>(`task-complications/${id}`, { method: "DELETE" }),
}
