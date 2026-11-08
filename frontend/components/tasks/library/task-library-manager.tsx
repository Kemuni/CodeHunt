"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BookOpenIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import type { CategoryLibrary, DeveloperType, TemplateRead } from "@/lib/api/task-contract"
import { taskLibraryApi, type CategoryPayload, type TemplatePayload } from "@/lib/api/task-library"
import { useTaskLibrary, taskLibraryQueryKey } from "@/hooks/tasks/use-task-library"
import { flattenLibraryCategories } from "@/lib/tasks/task-library"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import ResponsiveModal from "@/components/ui/responsive-modal"
import LibraryBrowser from "./library-browser"
import { LibraryCategoryForm, LibraryTemplateForm } from "./library-entry-form"

type Editor =
  | { kind: "category"; category?: CategoryLibrary }
  | { kind: "template"; template?: TemplateRead; categoryId?: number }
type DeleteTarget =
  { kind: "category"; value: CategoryLibrary } | { kind: "template"; value: TemplateRead }
type Command =
  | { action: "save-category"; id?: number; body: CategoryPayload }
  | { action: "save-template"; id?: number; body: TemplatePayload }
  | { action: "delete"; target: DeleteTarget }

export default function TaskLibraryManager() {
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<DeveloperType>("frontend")
  const [editor, setEditor] = useState<Editor | null>(null)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const library = useTaskLibrary(open)
  const queryClient = useQueryClient()
  const categories = flattenLibraryCategories(
    library.data?.flatMap((section) => section.categories) ?? [],
  )
  const directionCategories = categories.filter((category) => category.developer_type === direction)
  const mutation = useMutation({
    retry: false,
    mutationFn: async (command: Command) => {
      switch (command.action) {
        case "save-category":
          return command.id === undefined
            ? taskLibraryApi.createCategory(command.body)
            : taskLibraryApi.updateCategory(command.id, command.body)
        case "save-template":
          return command.id === undefined
            ? taskLibraryApi.createTemplate(command.body)
            : taskLibraryApi.updateTemplate(command.id, command.body)
        case "delete":
          return command.target.kind === "category"
            ? taskLibraryApi.deleteCategory(command.target.value.id)
            : taskLibraryApi.deleteTemplate(command.target.value.id)
      }
    },
    onSuccess: async (_, command) => {
      if (command.action === "save-category") setDirection(command.body.developer_type)
      if (command.action === "save-template") {
        const category = categories.find((item) => item.id === command.body.category_id)
        if (category) setDirection(category.developer_type)
      }
      setEditor(null)
      setDeleting(null)
      toast.success(
        command.action === "delete" ? "Удалено из библиотеки" : "Сохранено в библиотеке",
      )
      await queryClient.invalidateQueries({ queryKey: taskLibraryQueryKey })
    },
  })
  const edit = (value: Editor) => {
    mutation.reset()
    setEditor(value)
  }
  const remove = (target: DeleteTarget) => {
    mutation.reset()
    setDeleting(target)
  }
  const formState = {
    pending: mutation.isPending,
    error: mutation.error,
    onCancel: () => {
      if (!mutation.isPending) setEditor(null)
    },
  }

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending && !editor && !deleting) setOpen(value)
        }}
        title="Библиотека пунктов"
        description="Заготовки пунктов для импорта в задачи. Организуйте их по направлениям и категориям."
        trigger={
          <Button type="button" variant="outline">
            <BookOpenIcon />
            Библиотека пунктов
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!library.data || !!library.error || mutation.isPending}
            onClick={() => edit({ kind: "category" })}
          >
            <PlusIcon />
            Добавить категорию
          </Button>
          <Button
            type="button"
            disabled={!directionCategories.length || !!library.error || mutation.isPending}
            onClick={() =>
              edit({
                kind: "template",
                categoryId: directionCategories[0]?.id,
              })
            }
          >
            <PlusIcon />
            Добавить пункт
          </Button>
        </div>
        <LibraryBrowser
          data={library.data}
          pending={library.isPending}
          error={library.error}
          onRetry={() => void library.refetch()}
          direction={direction}
          onDirectionChange={setDirection}
          categoryActions={(category) => (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Добавить пункт в «${category.title}»`}
                disabled={mutation.isPending}
                onClick={() => edit({ kind: "template", categoryId: category.id })}
              >
                <PlusIcon />
              </Button>
              <LibraryActions
                title={category.title}
                kind="категорию"
                disabled={mutation.isPending}
                onEdit={() => edit({ kind: "category", category })}
                onDelete={() => remove({ kind: "category", value: category })}
              />
            </div>
          )}
          templateActions={(template) => (
            <LibraryActions
              title={template.title}
              kind="пункт"
              disabled={mutation.isPending}
              onEdit={() => edit({ kind: "template", template })}
              onDelete={() => remove({ kind: "template", value: template })}
            />
          )}
        />
      </ResponsiveModal>
      {editor?.kind === "category" && (
        <LibraryCategoryForm
          {...formState}
          category={editor.category}
          direction={direction}
          categories={categories}
          onSave={(body) => {
            if (!mutation.isPending)
              mutation.mutate({ action: "save-category", id: editor.category?.id, body })
          }}
        />
      )}
      {editor?.kind === "template" && (
        <LibraryTemplateForm
          {...formState}
          template={editor.template}
          categoryId={editor.categoryId}
          categories={editor.template ? categories : directionCategories}
          onSave={(body) => {
            if (!mutation.isPending)
              mutation.mutate({ action: "save-template", id: editor.template?.id, body })
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(value) => {
            if (!value && !mutation.isPending) setDeleting(null)
          }}
          title={deleting.kind === "category" ? "Удалить категорию?" : "Удалить пункт?"}
          description={`«${deleting.value.title}» будет ${deleting.kind === "category" ? "удалена" : "удалён"} из библиотеки. Восстановить запись не получится. ${deleting.kind === "category" ? "Удаление доступно только для пустых категорий." : "Пункты, используемые в задачах, удалить нельзя."}`}
          confirmText="Удалить"
          pendingText="Удаляем…"
          variant="destructive"
          pending={mutation.isPending}
          error={mutation.error?.message}
          onConfirm={() => {
            if (!mutation.isPending) mutation.mutate({ action: "delete", target: deleting })
          }}
        />
      )}
    </>
  )
}

function LibraryActions({
  title,
  kind,
  disabled,
  onEdit,
  onDelete,
}: {
  title: string
  kind: string
  disabled: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={`Изменить ${kind} «${title}»`}
        onClick={onEdit}
      >
        <PencilIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={`Удалить ${kind} «${title}»`}
        onClick={onDelete}
      >
        <Trash2Icon className="text-destructive" />
      </Button>
    </div>
  )
}
