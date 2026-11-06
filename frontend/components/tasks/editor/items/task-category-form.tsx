"use client"

import { useId } from "react"
import { z } from "zod"
import Form from "@/components/ui/form/form"
import FormField from "@/components/ui/form/form-field"
import FormInput from "@/components/ui/form/input"
import { Button } from "@/components/ui/button"
import ResponsiveModal from "@/components/ui/responsive-modal"

export const taskCategorySchema = z.object({
  title: z.string().trim().min(1, "Введите название категории"),
})

/** Форма названия категории. Контекст Form остаётся снаружи модального окна, чтобы ввод и ошибки сохранялись при смене Drawer на Dialog. */
export default function TaskCategoryForm({
  title,
  editing,
  disabled,
  onSave,
  onCancel,
}: {
  title: string
  editing: boolean
  disabled: boolean
  onSave: (values: z.infer<typeof taskCategorySchema>) => void
  onCancel: () => void
}) {
  const formId = useId()
  return (
    <Form id={formId} schema={taskCategorySchema} defaultValues={{ title }} onSubmit={onSave}>
      <ResponsiveModal
        open
        onOpenChange={(open) => {
          if (!open) onCancel()
        }}
        title={editing ? "Переименовать категорию" : "Сгруппировать выделенные"}
        description="Категории могут содержать пункты и другие категории, до трёх уровней вложенности."
        footer={
          <>
            <Button type="button" variant="outline" onClick={onCancel}>
              Отменить
            </Button>
            <Button type="submit" form={formId} disabled={disabled}>
              Сохранить
            </Button>
          </>
        }
      >
        <FormField name="title" controlId={`${formId}-title`} label="Название категории">
          <FormInput
            name="title"
            form={formId}
            placeholder="Название категории"
            required
            autoFocus
          />
        </FormField>
      </ResponsiveModal>
    </Form>
  )
}
