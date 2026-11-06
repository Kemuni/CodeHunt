"use client"

import FormField from "@/components/ui/form/form-field"
import FormInput from "@/components/ui/form/input"
import FormTextarea from "@/components/ui/form/textarea"
import { levelToApi } from "@/lib/tasks/editor-model"
import type { TaskDifficultyLevel } from "@/lib/tasks/task-items-state"

/** Данные активного уровня входят в общий react-hook-form редактора и сохраняются вместе с задачей. */
export default function TaskLevelFields({
  difficultyLevel,
}: {
  difficultyLevel: TaskDifficultyLevel
}) {
  const name = `presets.${levelToApi[difficultyLevel]}`
  return (
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] items-start gap-4">
      <FormField name={`${name}.description`} label="Описание уровня">
        <FormTextarea
          name={`${name}.description`}
          form="task-info"
          placeholder="Опишите результат этого уровня"
          className="field-sizing-fixed min-h-24 max-h-64 resize-y"
        />
      </FormField>
      <FormField name={`${name}.averageDays`} label="Среднее время выполнения, дней">
        <FormInput
          name={`${name}.averageDays`}
          form="task-info"
          type="number"
          min={1}
          max={32767}
          placeholder="Необязательно"
        />
      </FormField>
    </div>
  )
}
