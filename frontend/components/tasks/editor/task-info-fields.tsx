"use client"

import type { ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"
import FormField from "@/components/ui/form/form-field"
import FormInput from "@/components/ui/form/input"
import FormTextarea from "@/components/ui/form/textarea"
import FormCheckbox from "@/components/ui/form/checkbox"
import FormSelect from "@/components/ui/form/select"
import FormSlider from "@/components/ui/form/slider"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const developerTypes = [
  { label: "Фронтенд", value: "frontend" },
  { label: "Фуллстек", value: "fullstack" },
]

/** Поля основной информации используют общий Form редактора; галерея в children сохраняется независимо. */
export default function TaskInfoFields({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-y-8 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-4 2xl:gap-x-24">
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <FormField name="title" label="Название задачи" className="col-span-2">
          <FormInput form="task-info" name="title" placeholder="Введите название" maxLength={255} />
        </FormField>
        <FormField name="slug" label="Адрес задачи (slug)" className="col-span-2">
          <FormInput
            form="task-info"
            name="slug"
            placeholder="Например, typing-trainer"
            maxLength={255}
          />
        </FormField>
        <Collapsible className="col-span-2 rounded-2xl border p-2">
          <CollapsibleTrigger
            render={<Button type="button" variant="ghost" />}
            className="group w-full justify-start"
          >
            Данные о дизайнере
            <ChevronDownIcon
              aria-hidden="true"
              className="transition-transform group-aria-expanded:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent keepMounted>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 px-3 pt-4 pb-2 sm:grid-cols-2">
              <FormField name="designerAuthor" label="Автор дизайна">
                <FormInput
                  form="task-info"
                  name="designerAuthor"
                  placeholder="Введите автора дизайна"
                />
              </FormField>
              <FormField name="designerLink" label="Ссылка на дизайнера">
                <FormInput form="task-info" name="designerLink" placeholder="Введите ссылку" />
              </FormField>
            </div>
          </CollapsibleContent>
        </Collapsible>
        <FormField name="shortDescription" label="Краткое описание задачи" className="col-span-2">
          <FormTextarea
            form="task-info"
            name="shortDescription"
            placeholder="Кратко опишите"
            className="field-sizing-fixed min-h-24 max-h-80 resize-y overflow-y-auto"
          />
        </FormField>
        <FormField name="fullDescription" label="Общее описание" className="col-span-2">
          <FormTextarea
            form="task-info"
            name="fullDescription"
            placeholder="Опишите задачу целиком"
            className="field-sizing-fixed min-h-24 max-h-80 resize-y overflow-y-auto"
          />
        </FormField>
        <FormField
          name="developerType"
          label="Направление разработки"
          className="col-span-2 sm:col-span-1 justify-around"
        >
          <FormSelect
            name="developerType"
            items={developerTypes}
            placeholder="Выберите направление"
          />
        </FormField>
        <FormField name="difficulty" label="Сложность" className="col-span-2 sm:col-span-1">
          <FormSlider name="difficulty" range min={0} max={10} />
        </FormField>
        <FormField
          name="isPaid"
          label="Доступ только по подписке"
          orientation="horizontal"
          className="*:font-normal col-span-2 sm:col-span-1"
        >
          <FormCheckbox name="isPaid" />
        </FormField>
        <FormField
          name="isHidden"
          label="Скрытая (только для модерации)"
          orientation="horizontal"
          className="*:font-normal col-span-2 sm:col-span-1"
        >
          <FormCheckbox name="isHidden" />
        </FormField>
      </div>

      {/* Разделитель на мобильных экранах */}
      <div className="h-0 w-full border block sm:hidden" />

      <div className="flex flex-col gap-3">
        <div className="grid gap-y-0.5">
          <h2 className="text-base font-medium">Фото задачи</h2>
          <span className="text-sm text-muted-foreground">Первое фото является титульным</span>
        </div>
        {children}
      </div>
    </div>
  )
}
