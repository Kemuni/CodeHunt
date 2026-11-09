import type { TaskLevel } from "@/lib/tasks/task-level"

/** Используемые frontend типы текущего API. UI-модели и преобразования находятся в lib/tasks. */
type TaskFields = {
  parent_task_id?: number | null
  slug: string
  title: string
  short_description: string
  full_description: string
  developer_type: DeveloperType
  difficulty_from: number
  difficulty_to: number
  design_author_name?: string | null
  design_author_link?: string | null
  is_hidden?: boolean
  is_paid?: boolean
}

export type TaskUpdate = Partial<TaskFields> & { status?: TaskStatus }

export type TaskDetail = TaskRead & {
  presets: TaskPresets
  photos: PhotoRead[]
  resources: ResourceRead[]
}

/** Все уровни присутствуют; каждый содержит только собственные пункты. */
export type TaskPresets = Record<TaskLevel, TaskPresetRead>

export type TaskPresetRead = {
  preset: PresetRead | null
  complications: Array<ComplicationItem | ComplicationGroupRead>
}

export type TaskRead = TaskFields & {
  created_at: string
  updated_at: string
  id: number
  status: TaskStatus
  cover_photo?: PhotoRead | null
}

export type DraftRead = {
  created_at: string
  updated_at: string
  id: number
  owner_id: number
  payload: Record<string, JsonValue>
  revision: number
  validation_errors: Array<ValidationIssue>
  is_valid: boolean
  photos: Array<PhotoRead>
  resources: Array<ResourceRead>
}

export type PhotoRead = {
  created_at: string
  updated_at: string
  id: number
  task_id: number | null
  draft_id: number | null
  position: number
  is_cover: boolean
  original_filename: string
  content_type: string
  size_bytes: number
  url: string
}

export type ResourceRead = {
  created_at: string
  updated_at: string
  id: number
  task_id: number | null
  draft_id: number | null
  title: string
  type: ResourceType
  original_filename: string
  content_type: string | null
  size_bytes: number | null
  url: string
}

export type Page<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

export type DeveloperLibrary = {
  developer_type: DeveloperType
  categories: Array<CategoryLibrary>
}

export type DeveloperType = "frontend" | "fullstack"

export type CompositionLink = {
  complication_id?: number | null
  title: string
  description: string
  acceptance_criteria: string
  level: TaskLevel
  is_required?: boolean
  kind?: "complication"
  id?: number | null
}

export type CompositionGroup = {
  level: TaskLevel
  kind?: "group"
  id?: number | null
  title: string
  items?: Array<CompositionLink | CompositionGroup>
}

export type PresetCreate = {
  level: TaskLevel
  description: string
  average_days_to_complete?: number | null
}

export type TaskStatus = "published" | "archived"

export type ComplicationItem = {
  complication_id?: number | null
  title: string
  description: string
  acceptance_criteria: string
  level: TaskLevel
  is_required?: boolean
  group_id?: number | null
  order_number: number
  position: number
  created_at: string
  updated_at: string
  id: number
  task_id: number
  kind?: "complication"
}

export type ComplicationGroupRead = {
  level: TaskLevel
  created_at: string
  updated_at: string
  id: number
  kind?: "group"
  task_id: number
  parent_group_id: number | null
  title: string
  position: number
  items?: Array<ComplicationItem | ComplicationGroupRead>
}

export type PresetRead = {
  level: TaskLevel
  description: string
  average_days_to_complete?: number | null
  created_at: string
  updated_at: string
  id: number
  task_id: number
}

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type ValidationIssue = {
  field: string
  code: string
  message: string
}

export type ResourceType = "design" | "specification" | "asset" | "other"

export type CategoryLibrary = {
  title: string
  parent_id?: number | null
  developer_type: DeveloperType
  id: number
  complications?: Array<TemplateRead>
  children?: Array<CategoryLibrary>
}

export type TemplateRead = {
  category_id: number
  title: string
  description: string
  created_at: string
  updated_at: string
  id: number
}

/** Полная запись готовой задачи; уровни сохраняют ID существующих пресетов. */
export type TaskSave = TaskFields & {
  presets: PresetCreate[]
  items: Array<CompositionLink | CompositionGroup>
}

export type DraftSummary = {
  id: number
  title: string
  short_description: string
  revision: number
  created_at: string
  updated_at: string
  cover_photo: PhotoRead | null
}
