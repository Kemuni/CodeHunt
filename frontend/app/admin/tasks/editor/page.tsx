"use client"

import FormInput from "@/components/ui/form/input"
import FormField from "@/components/ui/form/form-field"
import Form from "@/components/ui/form/form"
import { z } from "zod"
import FormTextarea from "@/components/ui/form/textarea"
import FormCheckbox from "@/components/ui/form/checkbox"
import { PageLayout, PageLayoutContent, PageLayoutHeader } from "@/components/ui/layouts/page"
import {
  SectionLayout,
  SectionLayoutContent,
  SectionLayoutDescription,
  SectionLayoutHeader,
} from "@/components/ui/layouts/section"
import { GalleryUpload } from "@/components/ui/form/gallery-upload"
import { FileUpload } from "@/components/ui/form/file-upload"
import FormSelect from "@/components/ui/form/select"
import FormSlider from "@/components/ui/form/slider"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { ChevronDownIcon } from "lucide-react"
import TaskItemsEditor from "./task-items-editor"
import type { TaskItem } from "./task-items-state"

/** Данные основной секции. Пункты, фотографии и вложения управляются отдельно. */
const taskInfoSchema = z.object({
  title: z.string().trim().min(1, "Введите название задачи"),
  designerAuthor: z.string().trim().optional(),
  designerLink: z
    .string()
    .trim()
    .refine((value) => value === "" || z.url({ protocol: /^https?$/ }).safeParse(value).success, {
      message: "Введите корректную ссылку на дизайнера (http или https)",
    })
    .optional(),
  shortDescription: z.string().trim().min(1, "Введите краткое описание задачи"),
  fullDescription: z.string().trim().min(1, "Введите полное описание задачи"),
  developerType: z.enum(["frontend", "backend"], {
    error: "Выберите направление разработки",
  }),
  difficulty: z
    .tuple([
      z
        .number()
        .int("Сложность должна быть целым числом")
        .min(1, "Минимальная сложность — 1")
        .max(10, "Максимальная сложность — 10"),
      z
        .number()
        .int("Сложность должна быть целым числом")
        .min(1, "Минимальная сложность — 1")
        .max(10, "Максимальная сложность — 10"),
    ])
    .refine(([first, second]) => first <= second, {
      message: "Минимальная сложность не может быть больше максимальной",
    }),
  isFree: z.boolean(),
  isHidden: z.boolean(),
})

const defaultItems: TaskItem[] = [
  {
    id: "1",
    required: true,
    difficultyLevel: "base",
    title: "Проведение тестирования скорости печати с просмотром результата",
    description:
      "Возможность начать тест, нажав кнопку “Пуск”. После начала появляется текст и можно сразу начинать вводить символы. Тест позволяет оценить скорость набора текста (WPM - Words Per Minute) и оценить корректность введенных символов.",
    criteria:
      "Проверяется путем нажатия на кнопку запуска тестирования. После запуска пользователь должен сразу иметь возможность вводить текст, без необходимости нажатия мышкой на блок. Каждый раз текст для проверки должен быть разным и не показываться заранее пользователю. Возможен ввод неверного символа с его подсветкой и учета в последующем результате теста. Имеется выделяющиеся цвета, которые показывают корректность ввода и текущий курсор ввода.",
  },
  {
    id: "2",
    required: true,
    difficultyLevel: "base",
    title: "Выбор уровня сложности",
    description:
      "Подготовить несколько текстов для проверки скорости печати разных уровней сложности: “Легкий”, “Средний” и “Сложный”. Пример данных текстов вы можете найти в ресурсах, приложенных к заданию.",
    criteria:
      "Проверяется путем нажатия на кнопку запуска тестирования. После запуска пользователь должен сразу иметь возможность вводить текст, без необходимости нажатия мышкой на блок. Каждый раз текст для проверки должен быть разным и не показываться заранее пользователю. Возможен ввод неверного символа с его подсветкой и учета в последующем результате теста. Имеется выделяющиеся цвета, которые показывают корректность ввода и текущий курсор ввода.",
  },
  {
    id: "3",
    required: true,
    difficultyLevel: "base",
    title: "Режимы тестирования",
    description:
      'Добавьте режимы тестирования "Таймер (60 секунд)" и "Прохождение" (таймер отсчитывает время, без ограничений). Адаптируйте под него рассчет WPM и корректность введенных символов. ',
    criteria:
      "Проверяется путем нажатия на кнопку запуска тестирования. После запуска пользователь должен сразу иметь возможность вводить текст, без необходимости нажатия мышкой на блок. Каждый раз текст для проверки должен быть разным и не показываться заранее пользователю. Возможен ввод неверного символа с его подсветкой и учета в последующем результате теста. Имеется выделяющиеся цвета, которые показывают корректность ввода и текущий курсор ввода.",
  },
]

export default function AdminTasksPage() {
  const developerTypes = [
    { label: "Фронтенд", value: "frontend" },
    { label: "Фуллстак", value: "fullstack" },
  ]

  return (
    <PageLayout>
      <PageLayoutHeader>Управление задачей</PageLayoutHeader>
      <PageLayoutContent>
        <SectionLayout>
          <SectionLayoutHeader>Основная информация</SectionLayoutHeader>
          <SectionLayoutDescription>
            То, что пользователь видит в первой карточке товара
          </SectionLayoutDescription>
          <SectionLayoutContent>
            <Form
              schema={taskInfoSchema}
              defaultValues={{
                title: "",
                designerAuthor: "",
                designerLink: "",
                shortDescription: "",
                fullDescription: "",
                developerType: undefined,
                difficulty: [2, 6],
                isFree: false,
                isHidden: false,
              }}
              onSubmit={(v) => console.log(v)}
              className="grid grid-cols-1 gap-y-8 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-4 2xl:gap-x-24"
            >
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <FormField name="title" label="Название задачи" className="col-span-2">
                  <FormInput name="title" placeholder="Введите название" />
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
                        <FormInput name="designerAuthor" placeholder="Введите автора дизайна" />
                      </FormField>
                      <FormField name="designerLink" label="Ссылка на дизайнера">
                        <FormInput name="designerLink" placeholder="Введите ссылку" />
                      </FormField>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <FormField
                  name="shortDescription"
                  label="Краткое описание задачи"
                  className="col-span-2"
                >
                  <FormTextarea
                    name="shortDescription"
                    placeholder="Кратко опишите"
                    className="field-sizing-fixed min-h-24 max-h-80 resize-y overflow-y-auto"
                  />
                </FormField>
                <FormField name="fullDescription" label="Общее описание" className="col-span-2">
                  <FormTextarea
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
                  <FormSlider name="difficulty" range min={1} max={10} />
                </FormField>
                <FormField
                  name="isFree"
                  label="Задача бесплатная"
                  orientation="horizontal"
                  className="*:font-normal col-span-2 sm:col-span-1"
                >
                  <FormCheckbox name="isFree" />
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
                <span className="grid gap-y-0.5">
                  <h2 className="text-base font-medium">Фото задачи</h2>
                  <span className="text-sm text-muted-foreground">
                    Первое фото является титульным
                  </span>
                </span>
                <GalleryUpload maxFiles={4} />
              </div>
            </Form>
          </SectionLayoutContent>
        </SectionLayout>
        <TaskItemsEditor initialItems={defaultItems} />
        <SectionLayout>
          <SectionLayoutHeader>Вложения</SectionLayoutHeader>
          <SectionLayoutDescription>
            Файлы и материалы для выполнения задачи
          </SectionLayoutDescription>
          <SectionLayoutContent>
            <FileUpload />
          </SectionLayoutContent>
        </SectionLayout>
      </PageLayoutContent>
    </PageLayout>
  )
}
