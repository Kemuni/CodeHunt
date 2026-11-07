"use client"

import { useRef, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  pendingText?: string
  variant?: "default" | "destructive"
  pending?: boolean
  error?: string
}

/** Простое подтверждение. Владелец выполняет действие и закрывает окно после успеха; при ошибке окно остаётся открытым. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  pendingText = "Выполняем…",
  variant = "default",
  pending = false,
  error,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (pending) {
          details.cancel()
          return
        }
        onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent initialFocus={cancelRef} aria-busy={pending}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef} type="button" disabled={pending}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant={variant}
            disabled={pending}
            onClick={() => {
              if (!pending) onConfirm()
            }}
          >
            {pending ? pendingText : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
