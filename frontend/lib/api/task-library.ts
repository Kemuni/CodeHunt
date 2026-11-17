import type { CategoryLibrary, DeveloperLibrary, TemplateRead } from "./task-contract"
import {
  createCategoryApiTaskComplicationCategoriesPost as createCategory,
  createTemplateApiTaskComplicationsPost as createTemplate,
  deleteCategoryApiTaskComplicationCategoriesCategoryIdDelete as deleteCategory,
  deleteTemplateApiTaskComplicationsTemplateIdDelete as deleteTemplate,
  libraryApiTaskComplicationsLibraryGet as library,
  updateCategoryApiTaskComplicationCategoriesCategoryIdPatch as updateCategory,
  updateTemplateApiTaskComplicationsTemplateIdPatch as updateTemplate,
} from "./generated/sdk.gen"
import { apiData, apiVoid } from "./request"

export type CategoryPayload = Pick<CategoryLibrary, "title" | "parent_id" | "developer_type">
export type TemplatePayload = Pick<TemplateRead, "title" | "description" | "category_id">

export const taskLibraryApi = {
  list: (): Promise<DeveloperLibrary[]> => apiData(library()),
  createCategory: (body: CategoryPayload): Promise<CategoryLibrary> =>
    apiData(createCategory({ body })),
  updateCategory: (id: number, body: CategoryPayload): Promise<CategoryLibrary> =>
    apiData(updateCategory({ path: { category_id: id }, body })),
  deleteCategory: (id: number) => apiVoid(deleteCategory({ path: { category_id: id } })),
  createTemplate: (body: TemplatePayload): Promise<TemplateRead> =>
    apiData(createTemplate({ body })),
  updateTemplate: (id: number, body: TemplatePayload): Promise<TemplateRead> =>
    apiData(updateTemplate({ path: { template_id: id }, body })),
  deleteTemplate: (id: number) => apiVoid(deleteTemplate({ path: { template_id: id } })),
}
