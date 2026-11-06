"use client"

import { useQuery } from "@tanstack/react-query"
import { PageLayout } from "@/components/ui/layouts/page"
import { Button } from "@/components/ui/button"
import { tasksApi } from "@/lib/api/tasks"
import type { DraftRead, TaskDetail } from "@/lib/api/task-contract"
import TaskEditor from "./task-editor"
import type { EditorMode } from "@/hooks/tasks/use-task-editor"

/** React Query загружает начальный снимок. Новый редактор открывается без запроса на создание черновика. */
export default function TaskEditorLoader({ mode }: { mode: EditorMode }) {
  const query = useQuery<TaskDetail | DraftRead | null>({
    queryKey: ["task-editor", mode],
    queryFn: () =>
      mode.kind === "task"
        ? tasksApi.task(mode.id)
        : mode.kind === "draft"
          ? tasksApi.draft(mode.id)
          : Promise.resolve(null),
    enabled: mode.kind !== "new",
    // Фоновая перезагрузка не должна заменять редактируемый снимок. При повторном открытии читаем заново.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
    retry: false,
  })
  if (mode.kind !== "new" && query.isPending)
    return (
      <PageLayout>
        <p>Загружаем задачу…</p>
      </PageLayout>
    )
  if (query.error)
    return (
      <PageLayout>
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
        <Button className="mt-4 w-fit" onClick={() => void query.refetch()}>
          Повторить
        </Button>
      </PageLayout>
    )
  return (
    <TaskEditor
      key={`${mode.kind}-${"id" in mode ? mode.id : "new"}`}
      mode={mode}
      initial={query.data ?? null}
    />
  )
}
