/** Контракт задач из предоставленного OpenAPI 3.1. UI-модели и преобразования находятся в lib/tasks. */
export type TaskPublication = {
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
  items?: Array<CompositionLink | CompositionGroup>
  presets: Array<PresetCreate>
}

export type TaskUpdate = {
  parent_task_id?: number | null
  slug?: string | null
  title?: string | null
  short_description?: string | null
  full_description?: string | null
  developer_type?: DeveloperType | null
  difficulty_from?: number | null
  difficulty_to?: number | null
  design_author_name?: string | null
  design_author_link?: string | null
  status?: TaskStatus | null
  is_hidden?: boolean | null
}

export type TaskDetail = {
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
  created_at: string
  updated_at: string
  id: number
  status: TaskStatus
  presets: TaskPresets
  photos: Array<PhotoRead>
  resources: Array<ResourceDownloadRead>
}

/** Все уровни присутствуют; каждый содержит только собственные пункты. */
export type TaskPresets = Record<Level, TaskPresetRead>

export type TaskPresetRead = {
  preset: PresetRead | null
  complications: Array<ComplicationItem | ComplicationGroupRead>
}

export type TaskRead = {
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
  created_at: string
  updated_at: string
  id: number
  status: TaskStatus
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
  resources: Array<ResourceDownloadRead>
}

export type DraftCreate = {
  payload?: Record<string, JsonValue>
}

export type DraftUpdate = {
  payload?: Record<string, JsonValue>
  revision: number
}

export type DraftPublish = {
  revision: number
}

export type CompositionUpdate = {
  items: Array<CompositionLink | CompositionGroup>
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
  expires_in: number
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
}

export type ResourceDownloadRead = {
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
  expires_in: number
}

export type DownloadURL = {
  url: string
  expires_in: number
}

export type DraftGalleryUpdate = {
  photo_ids: Array<number>
  revision: number
}

export type GalleryUpdate = {
  photo_ids: Array<number>
}

export type PresetUpdate = {
  level?: Level | null
  description?: string | null
  average_days_to_complete?: number | null
}

export type ErrorResponse = {
  success?: false
  data?: null
  errors: ErrorDetail
}

export type Page_TaskRead_ = {
  items: Array<TaskRead>
  total: number
  limit: number
  offset: number
}

export type Page_DraftRead_ = {
  items: Array<DraftRead>
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
  level: Level
  is_required?: boolean
  kind?: "complication"
  id?: number | null
}

export type CompositionGroup = {
  level: Level
  kind?: "group"
  id?: number | null
  title: string
  items?: Array<CompositionLink | CompositionGroup>
}

export type PresetCreate = {
  level: Level
  description: string
  average_days_to_complete?: number | null
}

export type TaskStatus = "published" | "archived"

export type ComplicationItem = {
  complication_id?: number | null
  title: string
  description: string
  acceptance_criteria: string
  level: Level
  is_required?: boolean
  group_id?: number | null
  order_number?: number
  created_at: string
  updated_at: string
  id: number
  task_id: number
  kind?: "complication"
}

export type ComplicationGroupRead = {
  level: Level
  created_at: string
  updated_at: string
  id: number
  kind?: "group"
  task_id: number
  parent_group_id: number | null
  title: string
  order_number: number
  items?: Array<ComplicationItem | ComplicationGroupRead>
}

export type PresetRead = {
  level: Level
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

export type Level = "easy" | "medium" | "high"

export type ErrorDetail = {
  code: string
  message: string
  details?: Array<Record<string, unknown>> | null
}

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
  slug: string
  description: string
  created_at: string
  updated_at: string
  id: number
}

export type Configuration = {
  preset: PresetRead
  complications: Array<ComplicationItem | ComplicationGroupRead>
}
