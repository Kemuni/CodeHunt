import type { CategoryLibrary, TemplateRead } from "@/lib/api/task-contract"
import type { TaskItem } from "./task-items-state"
import type { TaskLevel } from "./task-level"

export function flattenLibraryCategories(categories: CategoryLibrary[]): CategoryLibrary[] {
  return categories.flatMap((category) => [
    category,
    ...flattenLibraryCategories(category.children ?? []),
  ])
}

export function libraryTemplates(categories: CategoryLibrary[]): TemplateRead[] {
  return flattenLibraryCategories(categories).flatMap((category) => category.complications ?? [])
}

/** Проверяем реальные parent_id: дерево ответа разделено по направлениям. */
export function libraryParentOptions(categories: CategoryLibrary[], editingId?: number) {
  const excluded = new Set(editingId === undefined ? [] : [editingId])
  let size: number
  do {
    size = excluded.size
    categories.forEach((category) => {
      if (category.parent_id != null && excluded.has(category.parent_id)) excluded.add(category.id)
    })
  } while (size !== excluded.size)
  return categories.filter((category) => !excluded.has(category.id))
}

/** Шаблоны не содержат критериев проверки; их можно дополнить в самой задаче. */
export function importLibraryTemplates(
  templates: TemplateRead[],
  selected: Set<number>,
  difficultyLevel: TaskLevel,
): TaskItem[] {
  return templates
    .filter((template) => selected.has(template.id))
    .map((template) => ({
      id: crypto.randomUUID(),
      complicationId: template.id,
      title: template.title,
      description: template.description,
      criteria: "",
      required: true,
      difficultyLevel,
    }))
}
