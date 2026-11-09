import type { DeveloperType } from "@/lib/api/task-contract"

export const catalogSortLabels = {
  newest: "Сначала новые",
  oldest: "Сначала старые",
  title: "По названию",
  difficulty_asc: "Сначала простые",
  difficulty_desc: "Сначала сложные",
} as const

export interface CatalogFilters {
  q: string
  difficulty: [number, number]
  developerTypes: DeveloperType[]
  access: "all" | "free" | "subscription"
  sort: keyof typeof catalogSortLabels
}

export const defaultCatalogFilters: CatalogFilters = {
  q: "",
  access: "all",
  difficulty: [0, 10],
  developerTypes: [],
  sort: "newest",
}

export function catalogSearchParams(filters: CatalogFilters, offset: number) {
  const params = new URLSearchParams({ limit: "20", offset: String(offset), sort: filters.sort })
  if (filters.q.trim()) params.set("q", filters.q.trim())
  if (filters.access !== "all") params.set("access", filters.access)
  for (const direction of filters.developerTypes) params.append("developer_type", direction)
  if (filters.difficulty[0] !== 0) params.set("difficulty_min", String(filters.difficulty[0]))
  if (filters.difficulty[1] !== 10) params.set("difficulty_max", String(filters.difficulty[1]))
  return params
}

export function activeCatalogFilterCount(filters: CatalogFilters) {
  return (
    Number(filters.difficulty[0] !== 0 || filters.difficulty[1] !== 10) +
    Number(filters.developerTypes.length > 0) +
    Number(filters.access !== "all")
  )
}
