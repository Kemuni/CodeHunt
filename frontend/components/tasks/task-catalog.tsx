"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { tasksApi } from "@/lib/api/tasks"
import { TaskApiError } from "@/lib/api/task-request"
import type { DraftRead, TaskRead } from "@/lib/api/task-contract"
import { PageLayout, PageLayoutHeader, PageLayoutContent } from "@/components/ui/layouts/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

const PAGE_SIZE = 20

type DeleteTarget = { kind: "task"; task: TaskRead } | { kind: "draft"; draft: DraftRead }

/** Публичный каталог и административный список. Собственные черновики запрашиваются отдельным API только в административном режиме. */
export default function TaskCatalog({ admin = false }: { admin?: boolean }) {
  const [tab, setTab] = useState("tasks")
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const drafts = admin && tab === "drafts"
  const tasksQuery = useQuery({
    queryKey: ["task-catalog", admin, "tasks", offset, query],
    queryFn: () => tasksApi.list(admin, offset, query),
    enabled: !drafts,
    retry: false,
  })
  const draftsQuery = useQuery({
    queryKey: ["task-catalog", true, "drafts", offset],
    queryFn: () => tasksApi.drafts(offset),
    enabled: drafts,
    retry: false,
  })
  const result = drafts ? draftsQuery : tasksQuery
  const total = result.data?.total ?? 0
  const deletion = useCatalogDeletion(() => {
    if (result.data?.items.length === 1 && offset > 0) {
      setOffset((value) => Math.max(0, value - PAGE_SIZE))
    }
  })

  function handleTabChange(value: string) {
    setTab(value)
    setOffset(0)
  }

  function handleSearch() {
    setQuery(search)
    setOffset(0)
  }

  return (
    <PageLayout>
      <TaskCatalogHeader admin={admin} />
      <PageLayoutContent>
        {admin ? (
          <TaskCatalogTabs value={tab} onValueChange={handleTabChange} />
        ) : (
          <TaskCatalogSearch value={search} onValueChange={setSearch} onSearch={handleSearch} />
        )}
        <TaskCatalogResults
          isPending={result.isPending}
          error={result.error}
          onRetry={() => void result.refetch()}
          total={total}
          drafts={drafts}
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {drafts
              ? draftsQuery.data?.items.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    onDelete={() => deletion.open({ kind: "draft", draft })}
                  />
                ))
              : tasksQuery.data?.items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    admin={admin}
                    onDelete={() => deletion.open({ kind: "task", task })}
                  />
                ))}
          </div>
          <TaskCatalogPagination total={total} offset={offset} onOffsetChange={setOffset} />
        </TaskCatalogResults>
      </PageLayoutContent>
      {deletion.target && (
        <DeleteCatalogItemDialog
          target={deletion.target}
          pending={deletion.pending}
          error={deletion.error}
          onCancel={deletion.close}
          onConfirm={deletion.confirm}
        />
      )}
    </PageLayout>
  )
}

function TaskCatalogHeader({ admin }: { admin: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <PageLayoutHeader>{admin ? "Управление задачами" : "Каталог задач"}</PageLayoutHeader>
      {admin && (
        <Button render={<Link href="/admin/tasks/editor" />} nativeButton={false}>
          <PlusIcon />
          Добавить задачу
        </Button>
      )}
    </div>
  )
}

interface TaskCatalogTabsProps {
  value: string
  onValueChange: (value: string) => void
}

function TaskCatalogTabs({ value, onValueChange }: TaskCatalogTabsProps) {
  return (
    <Tabs value={value} onValueChange={(value) => onValueChange(String(value))}>
      <TabsList>
        <TabsTrigger value="tasks">Все задачи</TabsTrigger>
        <TabsTrigger value="drafts">Мои черновики</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

interface TaskCatalogSearchProps {
  value: string
  onValueChange: (value: string) => void
  onSearch: () => void
}

function TaskCatalogSearch({ value, onValueChange, onSearch }: TaskCatalogSearchProps) {
  return (
    <div className="flex gap-2">
      <Input
        aria-label="Поиск задач"
        placeholder="Поиск по задачам"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSearch()
        }}
      />
      <Button onClick={onSearch}>Найти</Button>
    </div>
  )
}

interface TaskCatalogResultsProps {
  isPending: boolean
  error: Error | null
  onRetry: () => void
  total: number
  drafts: boolean
  children: ReactNode
}

function TaskCatalogResults({
  isPending,
  error,
  onRetry,
  total,
  drafts,
  children,
}: TaskCatalogResultsProps) {
  if (isPending) return <p role="status">Загружаем…</p>

  if (error) {
    return (
      <div role="alert">
        <p className="text-destructive">{error.message}</p>
        <Button variant="outline" className="mt-3" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    )
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">Всего: {total}</p>
      {!total && (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {drafts ? "У вас пока нет черновиков" : "Задач пока нет"}
        </p>
      )}
      {children}
    </>
  )
}

function draftTitle(draft: DraftRead) {
  return typeof draft.payload.title === "string" && draft.payload.title
    ? draft.payload.title
    : "Без названия"
}

function DraftCard({ draft, onDelete }: { draft: DraftRead; onDelete: () => void }) {
  const title = draftTitle(draft)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Черновик #{draft.id}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          {draft.is_valid
            ? "Готов к публикации"
            : `Проблем с валидацией: ${draft.validation_errors.length}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Фото: {draft.photos.length} · Вложения: {draft.resources.length}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          render={<Link href={`/admin/tasks/editor?draftId=${draft.id}`} />}
          nativeButton={false}
          variant="outline"
        >
          Продолжить редактирование
        </Button>
        <DeleteCatalogItemButton label={`Удалить черновик «${title}»`} onClick={onDelete} />
      </CardFooter>
    </Card>
  )
}

function TaskCard({
  task,
  admin,
  onDelete,
}: {
  task: TaskRead
  admin: boolean
  onDelete: () => void
}) {
  const href = admin ? `/admin/tasks/editor?taskId=${task.id}` : `/tasks/${task.id}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>{task.title}</CardTitle>
        <CardDescription>
          {task.developer_type === "frontend" ? "Фронтенд" : "Фуллстек"} · Сложность{" "}
          {task.difficulty_from}–{task.difficulty_to}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap wrap-anywhere">{task.short_description}</p>
        {admin && (
          <p className="mt-3 text-sm text-muted-foreground">
            {task.status === "archived" ? "В архиве" : "Опубликована"}
            {task.is_hidden ? " · Скрыта" : ""}
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        <Button render={<Link href={href} />} nativeButton={false} variant="outline">
          {admin ? "Редактировать" : "Открыть задачу"}
        </Button>
        {admin && (
          <DeleteCatalogItemButton label={`Удалить задачу «${task.title}»`} onClick={onDelete} />
        )}
      </CardFooter>
    </Card>
  )
}

function DeleteCatalogItemButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="destructive" aria-label={label} onClick={onClick}>
      <Trash2Icon />
      Удалить
    </Button>
  )
}

/** Не повторяет разрушительные запросы автоматически; конфликт версии требует нового подтверждения. */
function useCatalogDeletion(onDeleted: () => void) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<DeleteTarget | null>(null)
  const mutation = useMutation({
    retry: false,
    mutationFn: async (selected: DeleteTarget) => {
      if (selected.kind === "draft") {
        await tasksApi.deleteDraft(selected.draft.id, selected.draft.revision)
        return
      }
      let archived = false
      if (selected.task.status !== "archived") {
        const task = await tasksApi.updateTask(selected.task.id, { status: "archived" })
        archived = true
        setTarget({ kind: "task", task })
      }
      try {
        await tasksApi.deleteTask(selected.task.id)
      } catch (error) {
        const message =
          error instanceof TaskApiError && error.code === "reference_conflict"
            ? "Задача используется в решениях или связана с другими задачами. Удаление недоступно."
            : error instanceof Error
              ? error.message
              : "Не удалось удалить задачу"
        throw new Error(`${archived ? "Задача перенесена в архив, но не удалена. " : ""}${message}`)
      }
    },
    onSuccess: (_, selected) => {
      setTarget(null)
      onDeleted()
      toast.success(selected.kind === "draft" ? "Черновик удалён" : "Задача удалена")
    },
    onError: (error) => {
      if (error instanceof TaskApiError && error.code === "draft_revision_conflict") {
        setTarget(null)
        toast.error(
          "Черновик изменился в другом окне. Проверьте обновлённый список и подтвердите удаление заново.",
        )
      }
    },
    onSettled: (_, __, selected) => {
      const id = selected.kind === "task" ? selected.task.id : selected.draft.id
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["task-editor", { kind: selected.kind, id }] }),
        ...(selected.kind === "task"
          ? [queryClient.invalidateQueries({ queryKey: ["public-task", id] })]
          : []),
      ])
    },
  })

  return {
    target,
    pending: mutation.isPending,
    error: mutation.error?.message,
    open: (selected: DeleteTarget) => {
      if (mutation.isPending) return
      mutation.reset()
      setTarget(selected)
    },
    close: () => {
      if (!mutation.isPending) setTarget(null)
    },
    confirm: () => {
      if (target && !mutation.isPending) mutation.mutate(target)
    },
  }
}

interface DeleteCatalogItemDialogProps {
  target: DeleteTarget
  pending: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
}

function DeleteCatalogItemDialog({
  target,
  pending,
  error,
  onCancel,
  onConfirm,
}: DeleteCatalogItemDialogProps) {
  const isDraft = target.kind === "draft"
  const title = isDraft ? draftTitle(target.draft) : target.task.title
  const needsArchive = target.kind === "task" && target.task.status !== "archived"

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={isDraft ? "Удалить черновик?" : "Удалить задачу?"}
      description={
        <>
          {needsArchive
            ? `Задача «${title}» будет снята с публикации и удалена.`
            : `${isDraft ? "Черновик" : "Задача"} «${title}» будет удалён${isDraft ? "" : "а"}.`}{" "}
          Восстановить {isDraft ? "его" : "её"} не получится.
        </>
      }
      confirmText="Удалить"
      pendingText="Удаляем…"
      variant="destructive"
      pending={pending}
      error={error}
      onConfirm={onConfirm}
    />
  )
}

interface TaskCatalogPaginationProps {
  total: number
  offset: number
  onOffsetChange: (offset: number) => void
}

function TaskCatalogPagination({ total, offset, onOffsetChange }: TaskCatalogPaginationProps) {
  if (total <= PAGE_SIZE) return null

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="outline"
        disabled={!offset}
        onClick={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
      >
        Назад
      </Button>
      <span>
        {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}
      </span>
      <Button
        variant="outline"
        disabled={offset + PAGE_SIZE >= total}
        onClick={() => onOffsetChange(offset + PAGE_SIZE)}
      >
        Далее
      </Button>
    </div>
  )
}
