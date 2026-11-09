"use client"

import { useQuery } from "@tanstack/react-query"
import { taskLibraryApi } from "@/lib/api/task-library"

export const taskLibraryQueryKey = ["task-item-library"] as const

export function useTaskLibrary(enabled: boolean) {
  return useQuery({
    queryKey: taskLibraryQueryKey,
    queryFn: taskLibraryApi.list,
    enabled,
    retry: false,
  })
}
