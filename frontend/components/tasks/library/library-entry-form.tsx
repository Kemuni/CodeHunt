"use client"

import { useEffect, useId, type ReactNode } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { z } from "zod"
import type { CategoryLibrary, DeveloperType, TemplateRead } from "@/lib/api/task-contract"
import type { CategoryPayload, TemplatePayload } from "@/lib/api/task-library"
import { ApiError } from "@/lib/api/request"
import { developerTypeLabels } from "@/lib/tasks/labels"
import { libraryParentOptions } from "@/lib/tasks/task-library"
import Form from "@/components/ui/form/form"
import FormField from "@/components/ui/form/form-field"
import FormInput from "@/components/ui/form/input"
import FormTextarea from "@/components/ui/form/textarea"
import FormSelect from "@/components/ui/form/select"
import ResponsiveModal from "@/components/ui/responsive-modal"
import { Button } from "@/components/ui/button"

const categorySchema = z.object({
  title: z.string().trim().min(1, "Введите название категории").max(100, "Не более 100 символов"),
  developer_type: z.enum(["frontend", "fullstack"]),
  parent_id: z.number().int().nonnegative(),
})
const templateSchema = z.object({
  title: z.string().trim().min(1, "Введите название пункта").max(150, "Не более 150 символов"),
  description: z
    .string()
    .trim()
    .min(1, "Введите описание")
    .max(100000, "Не более 100 000 символов"),
  category_id: z.number().int().positive("Выберите категорию"),
})

interface FormStateProps {
  pending: boolean
  error: Error | null
  onCancel: () => void
}

function LibraryFormModal({
  id,
  title,
  pending,
  error,
  onCancel,
  children,
}: FormStateProps & {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !pending) onCancel()
      }}
      title={title}
      footer={
        <>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Отменить
          </Button>
          <Button type="submit" form={id} disabled={pending}>
            {pending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <fieldset disabled={pending} aria-busy={pending} className="min-w-0 space-y-4">
        {children}
        {error && (
          <div role="alert" className="space-y-1 text-sm text-destructive">
            <p>{error.message}</p>
            {error instanceof ApiError &&
              error.issues.map((issue, index) => <p key={index}>{issue.message}</p>)}
          </div>
        )}
      </fieldset>
    </ResponsiveModal>
  )
}

function categoryOptions(categories: CategoryLibrary[]) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return categories.map((category) => {
    const titles = [category.title]
    const seen = new Set([category.id])
    let parent = byId.get(category.parent_id ?? 0)
    while (parent && !seen.has(parent.id)) {
      titles.unshift(parent.title)
      seen.add(parent.id)
      parent = byId.get(parent.parent_id ?? 0)
    }
    return {
      value: category.id,
      label: `${developerTypeLabels[category.developer_type]} / ${titles.join(" / ")}`,
    }
  })
}

export function LibraryCategoryForm({
  category,
  direction,
  categories,
  onSave,
  ...state
}: FormStateProps & {
  category?: CategoryLibrary
  direction: DeveloperType
  categories: CategoryLibrary[]
  onSave: (values: CategoryPayload) => void
}) {
  const id = useId()
  const allowed = new Set(libraryParentOptions(categories, category?.id).map((item) => item.id))
  return (
    <Form
      id={id}
      detached
      schema={categorySchema}
      defaultValues={{
        title: category?.title ?? "",
        developer_type: category?.developer_type ?? direction,
        parent_id: category?.parent_id ?? 0,
      }}
      onSubmit={(values) => onSave({ ...values, parent_id: values.parent_id || null })}
    >
      <LibraryFormModal
        id={id}
        title={category ? "Изменить категорию" : "Новая категория"}
        {...state}
      >
        <FormField name="title" controlId={`${id}-title`} label="Название категории">
          <FormInput name="title" form={id} maxLength={100} autoFocus />
        </FormField>
        <FormField
          name="developer_type"
          controlId={`${id}-direction`}
          label="Направление разработки"
        >
          <FormSelect
            name="developer_type"
            id={`${id}-direction`}
            disabled={state.pending}
            items={Object.entries(developerTypeLabels).map(([value, label]) => ({ value, label }))}
          />
        </FormField>
        <LibraryCategoryParentField
          id={`${id}-parent`}
          categories={categories.filter((item) => allowed.has(item.id))}
          disabled={state.pending}
        />
      </LibraryFormModal>
    </Form>
  )
}

function LibraryCategoryParentField({
  id,
  categories,
  disabled,
}: {
  id: string
  categories: CategoryLibrary[]
  disabled: boolean
}) {
  const { control, setValue } = useFormContext<z.infer<typeof categorySchema>>()
  const [direction, parentId] = useWatch({ control, name: ["developer_type", "parent_id"] })
  const available = categories.filter((category) => category.developer_type === direction)
  const parentAllowed = parentId === 0 || available.some((category) => category.id === parentId)

  useEffect(() => {
    if (!parentAllowed) setValue("parent_id", 0, { shouldDirty: true, shouldValidate: true })
  }, [parentAllowed, setValue])

  return (
    <FormField name="parent_id" controlId={id} label="Родительская категория">
      <FormSelect
        name="parent_id"
        id={id}
        disabled={disabled}
        items={[{ value: 0, label: "Без родительской категории" }, ...categoryOptions(available)]}
        className="w-full min-w-0"
      />
    </FormField>
  )
}

export function LibraryTemplateForm({
  template,
  categoryId,
  categories,
  onSave,
  ...state
}: FormStateProps & {
  template?: TemplateRead
  categoryId?: number
  categories: CategoryLibrary[]
  onSave: (values: TemplatePayload) => void
}) {
  const id = useId()
  return (
    <Form
      id={id}
      detached
      schema={templateSchema}
      defaultValues={{
        title: template?.title ?? "",
        description: template?.description ?? "",
        category_id: template?.category_id ?? categoryId ?? 0,
      }}
      onSubmit={onSave}
    >
      <LibraryFormModal id={id} title={template ? "Изменить пункт" : "Новый пункт"} {...state}>
        <FormField name="title" controlId={`${id}-title`} label="Название пункта">
          <FormInput name="title" form={id} maxLength={150} autoFocus />
        </FormField>
        <FormField name="category_id" controlId={`${id}-category`} label="Категория">
          <FormSelect
            name="category_id"
            id={`${id}-category`}
            disabled={state.pending}
            items={categoryOptions(categories)}
            className="w-full min-w-0"
          />
        </FormField>
        <FormField name="description" controlId={`${id}-description`} label="Описание пункта">
          <FormTextarea
            name="description"
            form={id}
            maxLength={100000}
            className="field-sizing-fixed min-h-32 max-h-80 resize-y overflow-y-auto"
          />
        </FormField>
      </LibraryFormModal>
    </Form>
  )
}
