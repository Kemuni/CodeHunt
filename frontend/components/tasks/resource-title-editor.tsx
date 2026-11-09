"use client"

import { useId, useState } from "react"
import ResponsiveModal from "@/components/ui/responsive-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Редактирование подписи одинаково для черновика и сохранённой задачи. */
export function ResourceTitleEditor({
  title,
  filename,
  busy,
  onSave,
  onClose,
}: {
  title: string
  filename: string
  busy: boolean
  onSave: (title: string) => Promise<void>
  onClose: () => void
}) {
  const id = useId()
  const [value, setValue] = useState(title)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const disabled = busy || pending
  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !disabled) onClose()
      }}
      title="Подпись файла"
      description={filename}
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (disabled) return
          if (!value.trim()) {
            setError("Введите подпись файла")
            return
          }
          setPending(true)
          setError("")
          try {
            await onSave(value.trim())
            onClose()
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Не удалось сохранить подпись")
          } finally {
            setPending(false)
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={id}>Подпись</Label>
          <Input
            id={id}
            value={value}
            maxLength={255}
            required
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={disabled}>
            {disabled ? "Сохраняем…" : "Сохранить подпись"}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  )
}
