"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { z } from "zod"
import { tasksApi, type DraftPayload } from "@/lib/api/tasks"
import { TaskApiError, type ValidationProblem } from "@/lib/api/task-request"
import { draftMediaApi, taskMediaApi } from "@/lib/api/task-media"
import type {
  DraftRead,
  TaskDetail,
  PhotoRead,
  ResourceRead,
  PresetRead,
  CompositionLink,
  CompositionGroup,
} from "@/lib/api/task-contract"
import { DraftCoordinator, type DraftSnapshot } from "@/lib/tasks/draft-coordinator"
import {
  taskInfoSchema,
  createTaskInfoSchema,
  emptyInfo,
  infoFromPayload,
  fromComposition,
  toPayload,
  publication,
  type TaskInfo,
} from "@/lib/tasks/editor-model"
import type { TaskNode } from "@/lib/tasks/task-tree"

interface SavedEditorMode {
  kind: "draft" | "task"
  id: number
}
export type EditorMode = { kind: "new" } | SavedEditorMode
const emptyDraftSnapshot: DraftSnapshot = {
  draft: null,
  dirty: false,
  pending: 0,
  error: null,
  conflict: false,
}
const noSubscribe = () => () => {}
const noDraftSnapshot = () => emptyDraftSnapshot

export interface TaskEditorProps {
  mode: EditorMode
  initial: DraftRead | TaskDetail | null
}

/** Связывает форму и API: черновик сохраняет автоматически, готовую задачу — по кнопке; Sonner показывает результат операций. */
export function useTaskEditor({ mode, initial }: TaskEditorProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const initialDraft = initial && "payload" in initial ? initial : null
  const initialTask = initial && "complications" in initial ? initial : null
  const [initialInfo] = useState(() =>
    initial ? infoFromPayload(initialDraft?.payload ?? initialTask!) : structuredClone(emptyInfo),
  )
  const [tree, setTree] = useState(() =>
    fromComposition(
      initialTask?.complications ??
        (Array.isArray(initialDraft?.payload.items)
          ? (initialDraft.payload.items as Array<CompositionLink | CompositionGroup>)
          : []),
    ),
  )
  const [treeVersion, setTreeVersion] = useState(0)
  const [originalPayload] = useState<DraftPayload>(() => initialDraft?.payload ?? {})
  // Ref хранит последний ввод для асинхронной очереди, не заставляя перерисовывать каждое поле.
  const contentRef = useRef({ info: initialInfo, nodes: tree })
  const schema = useMemo(() => createTaskInfoSchema(tree), [tree])
  const savedPayload = useRef(JSON.stringify(toPayload(initialInfo, tree, originalPayload)))
  const [coordinator] = useState(() =>
    mode.kind === "task"
      ? null
      : new DraftCoordinator(initialDraft, toPayload(initialInfo, tree, originalPayload), (error) =>
          toast.error(error.message),
        ),
  )
  // React подписывается на очередь через useSyncExternalStore; сама очередь не зависит от React.
  const draftSnapshot = useSyncExternalStore(
    coordinator?.subscribe ?? noSubscribe,
    coordinator?.getSnapshot ?? noDraftSnapshot,
    coordinator?.getSnapshot ?? noDraftSnapshot,
  )
  const [task, setTask] = useState(initialTask)
  // Подтверждённые шаги сохраняем даже при частичном сбое, чтобы повторный запрос не создавал дубликаты.
  const persistedTaskRef = useRef(initialTask)
  const [saving, setSaving] = useState(false)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [itemEditing, setItemEditing] = useState(false)
  const [problems, setProblems] = useState<ValidationProblem[]>([])
  const photos = draftSnapshot.draft?.photos ?? task?.photos ?? []
  const resources: ResourceRead[] = draftSnapshot.draft?.resources ?? task?.resources ?? []

  const contentChanged = useCallback(() => {
    const payload = toPayload(contentRef.current.info, contentRef.current.nodes, originalPayload)
    if (coordinator) coordinator.setPayload(payload)
    else setDirty(JSON.stringify(payload) !== savedPayload.current)
    setProblems([])
  }, [coordinator, originalPayload])
  const onInfoChange = useCallback(
    (info: TaskInfo) => {
      contentRef.current.info = info
      contentChanged()
    },
    [contentChanged],
  )
  const onNodesChange = useCallback(
    (nodes: TaskNode[]) => {
      contentRef.current.nodes = nodes
      setTree(nodes)
      contentChanged()
    },
    [contentChanged],
  )
  // Меняем URL без перемонтирования формы, чтобы ввод не потерялся после первого сохранения.
  useEffect(() => {
    if (mode.kind === "new" && draftSnapshot.draft)
      window.history.replaceState(null, "", `/admin/tasks/editor?draftId=${draftSnapshot.draft.id}`)
  }, [mode.kind, draftSnapshot.draft])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty || draftSnapshot.dirty || draftSnapshot.pending || mediaBusy || itemEditing)
        event.preventDefault()
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty, draftSnapshot.dirty, draftSnapshot.pending, mediaBusy, itemEditing])
  useEffect(
    () => () => {
      coordinator?.stopTimer()
      if (coordinator?.getSnapshot().dirty && !coordinator.getSnapshot().conflict)
        void coordinator.flush().catch(() => {})
    },
    [coordinator],
  )

  /** Публикует валидный черновик либо последовательно сохраняет данные, дерево и уровни готовой задачи. */
  const saveTask = async (values: z.infer<typeof taskInfoSchema>) => {
    if (saving || mediaBusy || itemEditing) return
    setSaving(true)
    setProblems([])
    let partial = false
    try {
      contentRef.current.info = values
      if (coordinator) {
        coordinator.setPayload(toPayload(values, contentRef.current.nodes, originalPayload))
        const published = await coordinator.publish()
        toast.success("Черновик опубликован: задача сохранена")
        void queryClient.invalidateQueries({ queryKey: ["task-catalog"] })
        router.replace(`/admin/tasks/editor?taskId=${published.id}`)
        return
      }
      const existing = persistedTaskRef.current!
      const { items, presets, ...info } = publication(values, contentRef.current.nodes)
      const updatedInfo = await tasksApi.updateTask(existing.id, {
        ...info,
        parent_task_id: existing.parent_task_id,
      })
      partial = true
      persistedTaskRef.current = { ...existing, ...updatedInfo }
      const composition = await tasksApi.composition(existing.id, { items: items ?? [] })
      const savedNodes = fromComposition(composition)
      contentRef.current.nodes = savedNodes
      setTree(savedNodes)
      setTreeVersion((v) => v + 1)
      persistedTaskRef.current = { ...persistedTaskRef.current, complications: composition }
      for (const preset of presets) {
        const previous: PresetRead | undefined = persistedTaskRef.current.presets.find(
          (p) => p.level === preset.level,
        )
        const saved: PresetRead = previous
          ? await tasksApi.updatePreset(existing.id, previous.id, preset)
          : await tasksApi.createPreset(existing.id, preset)
        persistedTaskRef.current = {
          ...persistedTaskRef.current,
          presets: [
            ...persistedTaskRef.current.presets.filter((p) => p.level !== saved.level),
            saved,
          ],
        }
      }
      for (const previous of persistedTaskRef.current.presets) {
        if (presets.some((preset) => preset.level === previous.level)) continue
        await tasksApi.deletePreset(existing.id, previous.id)
        persistedTaskRef.current = {
          ...persistedTaskRef.current,
          presets: persistedTaskRef.current.presets.filter((preset) => preset.id !== previous.id),
        }
      }
      setTask(persistedTaskRef.current)
      savedPayload.current = JSON.stringify(
        toPayload(contentRef.current.info, contentRef.current.nodes, originalPayload),
      )
      setDirty(false)
      toast.success("Основная информация и пункты задачи сохранены")
      void queryClient.invalidateQueries({ queryKey: ["task-catalog"] })
    } catch (error) {
      if (error instanceof TaskApiError) setProblems(error.issues)
      if (!coordinator)
        toast.error(
          `${partial ? "Сохранение выполнено частично. Повторите сохранение. " : ""}${error instanceof Error ? error.message : "Не удалось сохранить задачу"}`,
        )
    } finally {
      setSaving(false)
    }
  }

  /** Общий индикатор загрузки и toast; ошибки черновика уже сообщает DraftCoordinator. */
  const runMediaOperation = async (operation: () => Promise<void>, label: string) => {
    setMediaBusy(true)
    try {
      await operation()
      toast.success(
        mode.kind === "task"
          ? `${label}. Изменения уже сохранены в задаче.`
          : `${label}. Изменения сохранены в черновике.`,
      )
      void queryClient.invalidateQueries({ queryKey: ["task-catalog"] })
    } catch (error) {
      if (!coordinator)
        toast.error(error instanceof Error ? error.message : "Не удалось сохранить файл")
      throw error
    } finally {
      setMediaBusy(false)
    }
  }
  const updatePhotos = (next: PhotoRead[]) => {
    if (!persistedTaskRef.current) return
    persistedTaskRef.current = { ...persistedTaskRef.current, photos: next }
    setTask(persistedTaskRef.current)
  }
  const uploadPhotos = (files: File[]) =>
    runMediaOperation(async () => {
      if (coordinator)
        await coordinator.mutate((draft) =>
          draftMediaApi.uploadPhotos(draft.id, draft.revision, files),
        )
      else {
        const uploaded = await taskMediaApi.uploadPhotos(persistedTaskRef.current!.id, files)
        const merged = new Map(persistedTaskRef.current!.photos.map((photo) => [photo.id, photo]))
        uploaded.forEach((photo) => merged.set(photo.id, photo))
        updatePhotos([...merged.values()].sort((a, b) => a.position - b.position))
      }
    }, "Фотографии добавлены")
  const reorderPhotos = (change: (ids: number[]) => number[], label: string) =>
    runMediaOperation(async () => {
      if (coordinator)
        await coordinator.mutate((draft) =>
          draftMediaApi.setPhotos(
            draft.id,
            draft.revision,
            change(draft.photos.map((photo) => photo.id)),
          ),
        )
      else
        updatePhotos(
          await taskMediaApi.setPhotos(
            persistedTaskRef.current!.id,
            change(persistedTaskRef.current!.photos.map((photo) => photo.id)),
          ),
        )
    }, label)
  const removePhoto = (id: number) =>
    reorderPhotos((ids) => ids.filter((x) => x !== id), "Фотография удалена")
  const clearPhotos = () => reorderPhotos(() => [], "Фотографии удалены")
  const coverPhoto = (id: number) =>
    reorderPhotos((ids) => [id, ...ids.filter((x) => x !== id)], "Титульное фото изменено")
  const uploadResources = (files: File[]) =>
    runMediaOperation(async () => {
      for (const file of files) {
        if (coordinator)
          await coordinator.mutate((draft) =>
            draftMediaApi.uploadResource(draft.id, draft.revision, file),
          )
        else {
          const resource = await taskMediaApi.uploadResource(persistedTaskRef.current!.id, file)
          persistedTaskRef.current = {
            ...persistedTaskRef.current!,
            resources: [
              ...persistedTaskRef.current!.resources,
              { ...resource, url: "", expires_in: 0 },
            ],
          }
          setTask(persistedTaskRef.current)
        }
      }
    }, "Файлы добавлены")
  const removeResource = (id: number) =>
    runMediaOperation(async () => {
      if (coordinator)
        await coordinator.mutate((draft) =>
          draftMediaApi.deleteResource(draft.id, draft.revision, id),
        )
      else {
        await taskMediaApi.deleteResource(persistedTaskRef.current!.id, id)
        persistedTaskRef.current = {
          ...persistedTaskRef.current!,
          resources: persistedTaskRef.current!.resources.filter((r) => r.id !== id),
        }
        setTask(persistedTaskRef.current)
      }
    }, "Файл удалён")
  // Ссылка на файл временная: получаем свежую непосредственно перед скачиванием.
  const downloadResource = async (id: number) => {
    try {
      const url = await tasksApi.resourceUrl(
        coordinator ? "draft" : "task",
        coordinator ? coordinator.getSnapshot().draft!.id : persistedTaskRef.current!.id,
        id,
      )
      const link = document.createElement("a")
      link.href = url.url
      link.download = ""
      link.click()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось скачать файл")
    }
  }
  const retrySave = () => {
    if (draftSnapshot.conflict) window.location.reload()
    else void coordinator?.flush().catch(() => {})
  }

  return {
    initialInfo,
    schema,
    tree,
    treeVersion,
    photos,
    resources,
    saving,
    itemEditing,
    draftSnapshot,
    status: editorStatus(mode, dirty, draftSnapshot),
    issues: problems.length ? problems : (draftSnapshot.draft?.validation_errors ?? []),
    saveDisabled: saving || mediaBusy || itemEditing || draftSnapshot.conflict,
    mediaDisabled: saving || mediaBusy || draftSnapshot.pending > 0 || draftSnapshot.conflict,
    onInfoChange,
    onNodesChange,
    setItemEditing,
    saveTask,
    retrySave,
    uploadPhotos,
    removePhoto,
    coverPhoto,
    clearPhotos,
    uploadResources,
    removeResource,
    downloadResource,
  }
}

function editorStatus(mode: EditorMode, dirty: boolean, draft: DraftSnapshot) {
  if (mode.kind === "task")
    return dirty
      ? "Есть несохранённые изменения. Основная информация и пункты сохраняются по кнопке."
      : "Изменения сохранены"
  if (draft.pending) return "Сохраняем черновик…"
  if (draft.error) return `Не удалось сохранить: ${draft.error}`
  if (draft.dirty) return "Есть несохранённые изменения"
  return draft.draft
    ? "Черновик сохранён автоматически"
    : "Черновик появится после первого изменения или загрузки файла"
}
