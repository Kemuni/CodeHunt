import TaskEditorLoader from "@/components/tasks/editor/task-editor-loader"
import type { EditorMode } from "@/hooks/tasks/use-task-editor"

interface EditorSearchParams {
  taskId?: string | string[]
  draftId?: string | string[]
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<EditorSearchParams>
}) {
  const params = await searchParams
  const value = params.taskId ?? params.draftId
  if (
    (params.taskId && params.draftId) ||
    (value !== undefined &&
      (typeof value !== "string" || !Number.isSafeInteger(Number(value)) || Number(value) <= 0))
  ) {
    return (
      <p className="p-10 text-destructive">
        Некорректный адрес задачи. Откройте её из списка задач.
      </p>
    )
  }
  const mode: EditorMode = params.taskId
    ? { kind: "task", id: Number(params.taskId) }
    : params.draftId
      ? { kind: "draft", id: Number(params.draftId) }
      : { kind: "new" }
  return <TaskEditorLoader mode={mode} />
}
