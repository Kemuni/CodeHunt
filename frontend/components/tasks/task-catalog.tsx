"use client"

import { taskPhotoUrl } from "@/lib/api/task-media"

import TaskDifficulty from "@/components/tasks/task-difficulty"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ImageOffIcon, PlusIcon, Trash2Icon, ArrowRightIcon } from "lucide-react"
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
import Image from "next/image"
import { Badge } from "@/components/reui/badge"
import { cn } from "cn"
import { developerTypeLabels } from "@/lib/tasks/labels"

const PAGE_SIZE = 20

type DeleteTarget = { kind: "task"; task: TaskRead } | { kind: "draft"; draft: DraftRead }

/** Публичный каталог и административный список. Собственные черновики запрашиваются отдельным API только в административном режиме. */
export default function TaskCatalog({
  admin = false,
  adminActions,
}: {
  admin?: boolean
  adminActions?: ReactNode
}) {
  const [tab, setTab] = useState("tasks")
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const isDrafts = admin && tab === "drafts"
  const tasksQuery = useQuery({
    queryKey: ["task-catalog", admin, "tasks", offset, query],
    queryFn: () => tasksApi.list(admin, offset, query),
    enabled: !isDrafts,
    retry: false,
  })
  const draftsQuery = useQuery({
    queryKey: ["task-catalog", true, "drafts", offset],
    queryFn: () => tasksApi.drafts(offset),
    enabled: isDrafts,
    retry: false,
  })
  const result = isDrafts ? draftsQuery : tasksQuery
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
      <PageLayoutHeader>{admin ? "Управление задачами" : "Каталог задач"}</PageLayoutHeader>
      <PageLayoutContent>
        {admin ? (
          <TaskCatalogTabs value={tab} onValueChange={handleTabChange} actions={adminActions} />
        ) : (
          <TaskCatalogSearch value={search} onValueChange={setSearch} onSearch={handleSearch} />
        )}
        <TaskCatalogResults
          isPending={result.isPending}
          error={result.error}
          onRetry={() => void result.refetch()}
          total={total}
          isDrafts={isDrafts}
        >
          <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {isDrafts
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

interface TaskCatalogTabsProps {
  value: string
  onValueChange: (value: string) => void
  actions?: ReactNode
}

function TaskCatalogTabs({ value, onValueChange, actions }: TaskCatalogTabsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={value} onValueChange={(value) => onValueChange(String(value))}>
        <TabsList>
          <TabsTrigger value="tasks">Все задачи</TabsTrigger>
          <TabsTrigger value="drafts">Мои черновики</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-2">
        {actions}
        <Button render={<Link href="/admin/tasks/editor" />} nativeButton={false}>
          <PlusIcon />
          Создать задачу
        </Button>
      </div>
    </div>
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
  isDrafts: boolean
  children: ReactNode
}

function TaskCatalogResults({
  isPending,
  error,
  onRetry,
  total,
  isDrafts,
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
          {isDrafts ? "У вас пока нет черновиков" : "Задач пока нет"}
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
  const href = `/admin/tasks/editor?draftId=${draft.id}`
  let shortDescription
  if (draft.payload?.short_description && typeof draft.payload.short_description === "string") {
    shortDescription = draft.payload.short_description
  } else {
    shortDescription = `Черновик #${draft.id}`
  }
  const coverPhoto = draft.photos.find((i) => i.is_cover)

  return (
    <Card className="relative pt-0 gap-4 pb-4">
      <div className="relative w-full aspect-video bg-black/15" />
      <div className="absolute inset-0 w-full aspect-video">
        {coverPhoto ? (
          <Image
            src={taskPhotoUrl(coverPhoto, true)}
            unoptimized
            alt="taskImage"
            fill
            sizes="20vw"
            loading="eager"
            className="aspect-video object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col justify-center items-center gap-2 text-muted-foreground">
            <ImageOffIcon className="size-14" />
            <p className="text-md">Нет изображения</p>
          </div>
        )}
      </div>
      <CardHeader className="flex flex-col gap-0.5 px-3">
        <Link href={href}>
          <CardTitle className="w-full text-xl line-clamp-1 wrap-break-word hover:underline cursor-pointer">
            {title}
          </CardTitle>
        </Link>
        <CardDescription className="w-full line-clamp-3 wrap-break-word">
          {shortDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3">
        <p>
          {draft.is_valid
            ? "Готов к публикации!"
            : `Проблем с валидацией: ${draft.validation_errors.length}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Фото: {draft.photos.length}
          <br />
          Вложения: {draft.resources.length}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        <DeleteCatalogItemButton label={`Удалить черновик «${title}»`} onClick={onDelete} />
        <Button render={<Link href={href} />} nativeButton={false} size="icon" variant="outline">
          <ArrowRightIcon />
        </Button>
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
    <Card className="relative pt-0 rounded-xl gap-4 pb-4">
      <Badge
        className={cn("absolute inset-3 z-11", task.is_hidden && "bg-gray-200 text-black")}
        variant="free"
      >
        {task.is_hidden ? "Скрыто" : "Бесплатно"}
      </Badge>
      <Badge className="absolute right-3 top-3 z-11" variant={task.developer_type}>
        {developerTypeLabels[task.developer_type]}
      </Badge>

      <div className="relative w-full z-9 aspect-video" />
      <div className="absolute inset-0 w-full z-10 aspect-video bg-black/15">
        {task.cover_photo ? (
          <Image
            src={taskPhotoUrl(task.cover_photo, admin)}
            unoptimized
            alt="taskImage"
            fill
            sizes="20vw"
            loading="eager"
            className="aspect-video object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col justify-center items-center gap-2 text-muted-foreground">
            <ImageOffIcon className="size-14" />
            <p className="text-md">Нет изображения</p>
          </div>
        )}
      </div>

      <CardHeader className="flex flex-col gap-0.5 px-3">
        <Link href={href}>
          <CardTitle className="w-full text-xl line-clamp-1 wrap-break-word hover:underline cursor-pointer">
            {task.title}
          </CardTitle>
        </Link>
        <CardDescription className="w-full min-h-15 line-clamp-3 wrap-break-word">
          {task.short_description}
        </CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter className="mt-auto flex justify-between">
        <TaskDifficulty from={task.difficulty_from} to={task.difficulty_to} />
        <div className="flex gap-2">
          {admin && (
            <DeleteCatalogItemButton label={`Удалить задачу «${task.title}»`} onClick={onDelete} />
          )}
          <Button render={<Link href={href} />} nativeButton={false} variant="default" size="icon">
            <ArrowRightIcon />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

function DeleteCatalogItemButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" size="icon" variant="destructive" aria-label={label} onClick={onClick}>
      <Trash2Icon />
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
