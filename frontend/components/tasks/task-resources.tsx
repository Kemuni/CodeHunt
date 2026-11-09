"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FileIcon, UploadIcon, Trash2Icon, DownloadIcon, PencilIcon } from "lucide-react"
import { formatBytes } from "@/lib/format-bytes"
import type { ResourceRead } from "@/lib/api/task-contract"

import { ResourceTitleEditor } from "./resource-title-editor"

interface TaskResourcesProps {
  resources: ResourceRead[]
  busy: boolean
  onUpload: (files: File[]) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onDownload: (id: number) => Promise<void>
  onRename: (id: number, title: string) => Promise<void>
}

/** Показывает подтверждённые сервером вложения; сохранение и toast об ошибках выполняет владелец редактора. */
export function TaskResources({
  resources,
  busy,
  onUpload,
  onRemove,
  onDownload,
  onRename,
}: TaskResourcesProps) {
  const [editing, setEditing] = useState<ResourceRead | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const upload = (files: File[]) => {
    if (busy || !files.length) return
    if (files.some((file) => file.size > 50 * 1024 * 1024)) {
      toast.error("Размер файла не должен превышать 50 МБ")
      return
    }
    void onUpload(files).catch(() => {})
  }
  return (
    <div className="space-y-4" aria-busy={busy}>
      <div
        className="rounded-xl border border-dashed p-5 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          upload(Array.from(event.dataTransfer.files))
        }}
      >
        <input
          ref={input}
          type="file"
          multiple
          disabled={busy}
          className="sr-only"
          aria-label="Прикрепить файлы"
          onChange={(event) => {
            upload(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <UploadIcon />
          {busy ? "Сохраняем…" : "Добавить файлы"}
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">
          Можно перетащить сюда. До 50 МБ на файл.
        </p>
      </div>
      <ul className="space-y-2">
        {resources.map((file) => (
          <li key={file.id} className="flex items-center gap-3 rounded-xl border p-3">
            <FileIcon className="shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.title}</p>
              <p className="text-xs text-muted-foreground">
                {file.original_filename} · {formatBytes(file.size_bytes ?? 0)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={`Изменить подпись ${file.title}`}
              onClick={() => setEditing(file)}
            >
              <PencilIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Скачать ${file.title}`}
              onClick={() => void onDownload(file.id).catch(() => {})}
            >
              <DownloadIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={`Удалить ${file.title}`}
              onClick={() => void onRemove(file.id).catch(() => {})}
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
      {editing && (
        <ResourceTitleEditor
          key={editing.id}
          title={editing.title}
          filename={editing.original_filename}
          busy={busy}
          onSave={(title) => onRename(editing.id, title)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
