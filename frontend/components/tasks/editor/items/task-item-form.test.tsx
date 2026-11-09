import { TaskLevel } from "@/lib/tasks/task-level"
import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { useFormContext, type UseFormReturn } from "react-hook-form"
import Form from "@/components/ui/form/form"
import FormField from "@/components/ui/form/form-field"
import FormInput from "@/components/ui/form/input"
import FormTextarea from "@/components/ui/form/textarea"
import FormCheckbox from "@/components/ui/form/checkbox"
import TaskItemForm from "./task-item-form"
import {
  taskItemFieldsSchema,
  type TaskItemFields,
  type TaskItem,
} from "@/lib/tasks/task-items-state"

test("Form uses the Zod resolver to reject empty fields and submit trimmed values", async () => {
  let methods!: UseFormReturn<TaskItemFields>
  const submissions: TaskItemFields[] = []
  const onSubmit = (values: TaskItemFields) => {
    submissions.push(values)
  }
  function Fields() {
    methods = useFormContext<TaskItemFields>()
    return (
      <>
        <FormField name="title" label="Название" controlId="test-title">
          <FormInput name="title" required />
        </FormField>
        <FormField name="description" label="Описание" controlId="test-description">
          <FormTextarea name="description" required />
        </FormField>
        <FormField name="criteria" label="Критерии" controlId="test-criteria">
          <FormTextarea name="criteria" required />
        </FormField>
        <FormField name="required" label="Обязательный" controlId="test-required">
          <FormCheckbox name="required" />
        </FormField>
      </>
    )
  }
  const html = renderToStaticMarkup(
    <Form
      schema={taskItemFieldsSchema}
      defaultValues={{ title: " ", description: "", criteria: "\n", required: false }}
      onSubmit={onSubmit}
    >
      <Fields />
    </Form>,
  )
  assert.match(html, /novalidate=""/i)
  assert.equal(methods.control._options.mode, "onSubmit")
  assert.equal(methods.control._options.reValidateMode, "onChange")
  await methods.handleSubmit(onSubmit)()
  assert.equal(submissions.length, 0)
  assert.equal(methods.getFieldState("title").error?.message, "Введите название пункта")
  assert.equal(methods.getFieldState("description").error?.message, "Введите описание пункта")
  assert.equal(methods.getFieldState("criteria").error?.message, "Введите критерии проверки")

  methods.setValue("title", " Название ")
  await methods.trigger("title")
  assert.equal(methods.getFieldState("title").invalid, false)
  assert.equal(methods.getFieldState("description").invalid, true)
  methods.setValue("description", " Описание ")
  methods.setValue("criteria", " Критерии ")
  await methods.handleSubmit(onSubmit)()
  assert.deepEqual(submissions, [
    { title: "Название", description: "Описание", criteria: "Критерии", required: false },
  ])
})

test("item forms render shared fields with unique ids and matching labels", () => {
  const item: TaskItem = {
    id: "first",
    difficultyLevel: TaskLevel.Easy,
    title: "Название",
    description: "Описание",
    criteria: "Критерии",
    required: true,
  }
  const html = renderToStaticMarkup(
    <>
      <TaskItemForm item={item} onSave={() => {}} onCancel={() => {}} />
      <TaskItemForm
        item={{ ...item, id: "second", difficultyLevel: TaskLevel.Medium }}
        onSave={() => {}}
        onCancel={() => {}}
      />
    </>,
  )
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(ids.length, new Set(ids).size)
  for (const id of ["first", "second"]) {
    for (const field of ["title", "description", "criteria", "required"]) {
      assert.ok(html.includes(`for="${id}-${field}"`))
      assert.ok(ids.includes(`${id}-${field}`))
    }
  }
  assert.equal((html.match(/<form\b/g) ?? []).length, 2)
  assert.equal((html.match(/<textarea\b/g) ?? []).length, 4)
})

test("category form validates blank names through RHF and exposes an id for modal controls", async () => {
  const { taskCategorySchema } = await import("./task-category-form")
  let methods!: UseFormReturn<{ title: string }>
  const submissions: { title: string }[] = []
  const onSubmit = (values: { title: string }) => {
    submissions.push(values)
  }
  function Fields() {
    methods = useFormContext<{ title: string }>()
    return (
      <FormField name="title" label="Название категории">
        <FormInput name="title" form="category-form" />
      </FormField>
    )
  }
  const html = renderToStaticMarkup(
    <Form
      id="category-form"
      schema={taskCategorySchema}
      defaultValues={{ title: " \n " }}
      onSubmit={onSubmit}
    >
      <Fields />
    </Form>,
  )
  assert.match(html, /<form id="category-form"/)
  assert.match(html, /<input[^>]*form="category-form"/)
  await methods.handleSubmit(onSubmit)()
  assert.deepEqual(submissions, [])
  assert.equal(methods.getFieldState("title").error?.message, "Введите название категории")
  methods.setValue("title", " Интерфейс ")
  await methods.handleSubmit(onSubmit)()
  assert.deepEqual(submissions, [{ title: "Интерфейс" }])
})
