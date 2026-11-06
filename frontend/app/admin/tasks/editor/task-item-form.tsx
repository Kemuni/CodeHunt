"use client"

import Form from "@/components/ui/form/form"
import FormField from "@/components/ui/form/form-field"
import FormInput from "@/components/ui/form/input"
import FormTextarea from "@/components/ui/form/textarea"
import FormCheckbox from "@/components/ui/form/checkbox"
import { Button } from "@/components/ui/button"
import {
  taskDifficultyLevels,
  taskItemFieldsSchema,
  type TaskItem,
  type TaskItemFields,
} from "./task-items-state"

interface TaskItemFormProps {
  item: TaskItem
  onSave: (values: TaskItemFields) => void
  onCancel: () => void
}

/** Редактирует один пункт через Form и Zod. Хранит ввод и ошибки до сохранения; onSave получает проверенные значения без изменения исходного пункта. */
export default function TaskItemForm({ item, onSave, onCancel }: TaskItemFormProps) {
  const difficultyLevelLabel = taskDifficultyLevels.find(
    (level) => level.value === item.difficultyLevel,
  )?.label

  return (
    <Form
      schema={taskItemFieldsSchema}
      defaultValues={item}
      onSubmit={onSave}
      className="flex min-w-0 flex-1 flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <FormField
          name="title"
          controlId={`${item.id}-title`}
          label="Название пункта"
          labelClassName="sr-only"
          className="min-w-0 flex-1 basis-40"
        >
          <FormInput
            name="title"
            placeholder="Название пункта"
            className="text-xl font-semibold"
            required
            autoFocus
          />
        </FormField>
        <FormField
          name="required"
          controlId={`${item.id}-required`}
          label="Обязательный"
          orientation="horizontal"
          className="w-auto shrink-0 gap-2"
        >
          <FormCheckbox name="required" />
        </FormField>
        <span className="ml-auto shrink-0 rounded-full bg-dark-green/15 px-2 py-0.5 text-sm font-light text-dark-green">
          {difficultyLevelLabel}
        </span>
      </div>
      <FormField name="description" controlId={`${item.id}-description`} label="Описание">
        <FormTextarea name="description" placeholder="Что нужно выполнить" required />
      </FormField>
      <FormField name="criteria" controlId={`${item.id}-criteria`} label="Критерии проверки">
        <FormTextarea name="criteria" placeholder="Как проверить выполнение пункта" required />
      </FormField>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отменить
        </Button>
        <Button type="submit">Сохранить</Button>
      </div>
    </Form>
  )
}
