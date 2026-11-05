"use client"

import FormInput from "@/components/ui/form/input";
import FormField from "@/components/ui/form/form-field";
import Form from "@/components/ui/form/form";
import { z } from 'zod'
import FormTextarea from "@/components/ui/form/textarea";
import FormCheckbox from "@/components/ui/form/checkbox";
import {PageLayout, PageLayoutContent, PageLayoutHeader} from "@/components/ui/layouts/page";
import {
  SectionLayout,
  SectionLayoutContent,
  SectionLayoutDescription,
  SectionLayoutHeader
} from "@/components/ui/layouts/section";
import {GalleryUpload} from "@/components/ui/form/gallery-upload";
import FormSelect from "@/components/ui/form/select";
import FormSlider from "@/components/ui/form/slider";


const schema = z.object({
  title: z.string().trim(),
  developerType: z.enum(["frontend", "backend"], {
    error: "Выберите направление разработки",
  }),
  difficulty: (
    z
    .tuple([
      z.number().min(1).max(10),
      z.number().min(1).max(10),
    ])
    .refine(([first, second]) => first <= second, {
      message: "Первое число не может быть больше второго",
    })
  )

});


export default function AdminTasksPage() {
  const developerTypes = [
    { label: "Фронтенд", value: "frontend" },
    { label: "Бэкенд", value: "backend" },
  ]

  return (
    <PageLayout>
      <PageLayoutHeader>Управление задачей</PageLayoutHeader>
      <PageLayoutContent>
        <SectionLayout>
          <SectionLayoutHeader>Основная информация</SectionLayoutHeader>
          <SectionLayoutDescription>То, что пользователь видит в первой карточке товара</SectionLayoutDescription>
          <SectionLayoutContent>
            <Form
              schema={schema}
              defaultValues={{
                title: "",
                developerType: undefined,
                difficulty: [2, 6],
              }}
              onSubmit={(v) => console.log(v)}
              className="grid grid-cols-1 gap-y-8 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-4 2xl:gap-x-24"
            >
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <FormField name="title" label="Название задачи" className="col-span-2">
                  <FormInput name="title" placeholder="Введите название" />
                </FormField>
                <FormField name="designerAuthor" label="Автор дизайна" className="col-span-2 sm:col-span-1">
                  <FormInput name="designerAuthor" placeholder="Введите автора дизайна" />
                </FormField>
                <FormField name="designerLink" label="Ссылка на дизайнера" className="col-span-2 sm:col-span-1">
                  <FormInput name="designerLink" placeholder="Введите ссылку" />
                </FormField>
                <FormField name="shortDescription" label="Краткое описание задачи" className="col-span-2">
                  <FormTextarea name="shortDescription" placeholder="Кратко опишите" />
                </FormField>
                <FormField name="fullDescription" label="Общее описание" className="col-span-2">
                  <FormTextarea name="fullDescription" placeholder="Опишите задачу целиком" className="h-24" />
                </FormField>
                <FormField name="developerType" label="Направление разработки"
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
                <FormField name="isFree" label="Задача бесплатная"
                           orientation="horizontal" className="*:font-normal col-span-2 sm:col-span-1">
                  <FormCheckbox name="isFree" />
                </FormField>
                <FormField name="isHidden" label="Скрытая (только для модерации)"
                           orientation="horizontal" className="*:font-normal col-span-2 sm:col-span-1">
                  <FormCheckbox name="isHidden" />
                </FormField>
              </div>

              {/* Divider for mobile */}
              <div className="h-0 w-full border block sm:hidden" />

              <div className="flex flex-col gap-3">
                <span className="grid gap-y-0.5">
                  <h2 className="text-base font-medium">Фото задачи</h2>
                  <span className="text-sm text-muted-foreground">Первое фото является титульным</span>
                </span>
                <GalleryUpload maxFiles={4} />
              </div>
            </Form>
          </SectionLayoutContent>
        </SectionLayout>
      </PageLayoutContent>
    </PageLayout>
  );
}
