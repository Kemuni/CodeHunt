import { tasksApi, type DraftPayload } from "@/lib/api/tasks"
import { ApiError } from "@/lib/api/request"
import type { DraftRead, TaskRead } from "@/lib/api/task-contract"

type DraftApi = Pick<typeof tasksApi, "createDraft" | "updateDraft" | "publish">
export interface DraftSnapshot {
  draft: DraftRead | null
  pending: number
  dirty: boolean
  error: string | null
  conflict: boolean
}

/** Последовательная очередь черновика: автосохранение, загрузки и публикация всегда используют последнюю подтверждённую revision. */
export class DraftCoordinator {
  private latest: DraftPayload
  private saved: string
  private queue: Promise<unknown> = Promise.resolve()
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Set<() => void>()
  private snapshot: DraftSnapshot
  private published = false

  constructor(
    initial: DraftRead | null,
    payload: DraftPayload,
    private onError: (error: Error) => void,
    private api: DraftApi = tasksApi,
    private delay = 650,
  ) {
    this.latest = payload
    this.saved = JSON.stringify(payload)
    this.snapshot = { draft: initial, pending: 0, dirty: false, error: null, conflict: false }
  }
  /** Снимок меняет ссылку только при обновлении: это контракт useSyncExternalStore. */
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private update(patch: Partial<DraftSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  /** Обновляет локальные данные и откладывает запрос до паузы во вводе (debounce). */
  setPayload(payload: DraftPayload) {
    if (this.published) return
    this.latest = payload
    const dirty = JSON.stringify(payload) !== this.saved
    this.update({ dirty })
    clearTimeout(this.timer)
    if (dirty && !this.snapshot.conflict)
      this.timer = setTimeout(() => {
        void this.flush().catch(() => {})
      }, this.delay)
  }
  /** Последовательно выполняет запросы и один раз сообщает об ошибке через onError. */
  private run<T>(operation: () => Promise<T>): Promise<T> {
    clearTimeout(this.timer)
    this.update({ pending: this.snapshot.pending + 1 })
    const result = this.queue
      .then(async () => {
        if (this.snapshot.conflict)
          throw new Error("Черновик изменён в другом окне. Перезагрузите его перед сохранением.")
        try {
          const value = await operation()
          this.update({ error: null })
          return value
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error("Не удалось сохранить черновик")
          this.update({
            error: error.message,
            conflict: cause instanceof ApiError && cause.code === "draft_revision_conflict",
          })
          this.onError(error)
          throw error
        }
      })
      .finally(() => this.update({ pending: this.snapshot.pending - 1 }))
    // Ошибка возвращается вызывающему коду, но не ломает последующие операции очереди.
    this.queue = result.catch(() => {})
    return result
  }
  private async saveLatest(forceCreate: boolean) {
    if (this.published) throw new Error("Черновик уже опубликован")
    // Пока шёл запрос, пользователь мог продолжить ввод — досохраняем новую версию.
    while ((!this.snapshot.draft && forceCreate) || JSON.stringify(this.latest) !== this.saved) {
      const payload = structuredClone(this.latest)
      const current = this.snapshot.draft
      const draft = current
        ? await this.api.updateDraft(current.id, current.revision, payload)
        : await this.api.createDraft(payload)
      this.saved = JSON.stringify(payload)
      this.update({ draft, dirty: JSON.stringify(this.latest) !== this.saved })
    }
    return this.snapshot.draft
  }
  /** Сохраняет накопленный ввод сразу. Нетронутый новый редактор черновик не создаёт. */
  flush() {
    return this.run(() => this.saveLatest(false))
  }
  /** Сначала сохраняет форму, затем меняет вложения с актуальной revision и принимает новый снимок. */
  mutate(operation: (draft: DraftRead) => Promise<DraftRead>) {
    return this.run(async () => {
      const draft = await this.saveLatest(true)
      const updated = await operation(draft!)
      this.update({ draft: updated })
      return updated
    })
  }
  /** Дожидается сохранения и проверки backend, затем превращает черновик в задачу. */
  publish(): Promise<TaskRead> {
    return this.run(async () => {
      const draft = await this.saveLatest(true)
      if (!draft!.is_valid)
        throw new ApiError(
          "Исправьте ошибки валидации перед сохранением задачи",
          422,
          "draft_invalid",
          draft!.validation_errors,
        )
      const task = await this.api.publish(draft!.id, draft!.revision)
      this.published = true
      this.update({ dirty: false })
      return task
    })
  }
  stopTimer() {
    clearTimeout(this.timer)
  }
}
