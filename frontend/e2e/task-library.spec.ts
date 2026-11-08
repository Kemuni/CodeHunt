import type { Page } from "@playwright/test"
import { test, expect } from "./auth-fixture"
import type {
  CategoryLibrary,
  DeveloperLibrary,
  TemplateRead,
  TaskDetail,
} from "../lib/api/task-contract"

async function mockLibrary(page: Page) {
  const state = {
    categories: [] as CategoryLibrary[],
    templates: [] as TemplateRead[],
    writes: [] as { method: string; path: string; body?: unknown }[],
    failLoad: false,
    failWrite: false,
  }
  let nextId = 1
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace("/api/backend/", "")
    const method = request.method()
    const reply = (data: unknown) => route.fulfill({ json: { success: true, data } })
    const fail = () =>
      route.fulfill({
        status: 409,
        json: {
          success: false,
          errors: { code: "reference_conflict", message: "Запись используется в задачах" },
        },
      })
    if (path === "editor/tasks/all") return reply({ items: [], total: 0, limit: 20, offset: 0 })
    if (path === "editor/tasks/91") {
      const task: TaskDetail = {
        id: 91,
        title: "Проверка импорта",
        slug: "library-import",
        short_description: "Описание",
        full_description: "Описание задачи",
        developer_type: "frontend",
        difficulty_from: 1,
        difficulty_to: 5,
        status: "published",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        photos: [],
        resources: [],
        presets: {
          easy: { preset: null, complications: [] },
          medium: { preset: null, complications: [] },
          high: { preset: null, complications: [] },
        },
      }
      return reply(task)
    }
    if (path === "task-complications/library") {
      if (state.failLoad) return fail()
      const tree = (parent: number | null, direction: string): CategoryLibrary[] =>
        state.categories
          .filter(
            (category) =>
              (category.parent_id ?? null) === parent && category.developer_type === direction,
          )
          .map((category) => ({
            ...category,
            complications: state.templates.filter((item) => item.category_id === category.id),
            children: tree(category.id, direction),
          }))
      const data: DeveloperLibrary[] = ["frontend", "fullstack"].map((direction) => ({
        developer_type: direction as DeveloperLibrary["developer_type"],
        categories: tree(null, direction),
      }))
      return reply(data)
    }
    if (method !== "GET") {
      const body = method === "DELETE" ? undefined : request.postDataJSON()
      state.writes.push({ method, path, body })
      if (state.failWrite) return fail()
      const category = path.startsWith("task-complication-categories")
      const collection = category ? state.categories : state.templates
      const id = Number(path.split("/")[1])
      if (method === "POST") {
        const item = {
          ...body,
          id: nextId++,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }
        collection.push(item)
        return reply(item)
      }
      if (method === "PATCH") {
        const item = collection.find((item) => item.id === id)!
        Object.assign(item, body)
        return reply(item)
      }
      if (method === "DELETE") {
        collection.splice(
          collection.findIndex((item) => item.id === id),
          1,
        )
        return reply(null)
      }
    }
    throw new Error(`Unexpected request ${method} ${path}`)
  })
  return state
}

for (const width of [1280, 375]) {
  test(`library CRUD and responsive form at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await mockLibrary(page)
    await page.goto("/admin/tasks")
    await page.getByRole("button", { name: "Библиотека пунктов", exact: true }).click()
    const library = page.getByRole("dialog", { name: "Библиотека пунктов", exact: true })
    await expect(library).toBeVisible()
    await expect(library.getByText("В этом направлении пока нет категорий.")).toBeVisible()
    await expect(
      library.getByRole("button", { name: "Добавить пункт", exact: true }),
    ).toBeDisabled()
    await library.getByRole("button", { name: "Добавить категорию" }).click()
    let form = page.getByRole("dialog", { name: "Новая категория", exact: true })
    await form.getByLabel("Название категории", { exact: true }).fill("Интерфейс")
    await form.getByRole("button", { name: "Сохранить", exact: true }).click()
    await expect(form).toBeHidden()
    expect(state.writes[0]).toEqual({
      method: "POST",
      path: "task-complication-categories",
      body: { title: "Интерфейс", developer_type: "frontend", parent_id: null },
    })
    await library.getByRole("tab", { name: "Фуллстек", exact: true }).click()
    await expect(
      library.getByRole("button", { name: "Добавить пункт", exact: true }),
    ).toBeDisabled()
    await library.getByRole("tab", { name: "Фронтенд", exact: true }).click()
    await library.getByRole("button", { name: "Добавить пункт в «Интерфейс»" }).click()
    form = page.getByRole("dialog", { name: "Новый пункт", exact: true })
    await expect(form.getByLabel("Идентификатор (slug)", { exact: true })).toHaveCount(0)
    await form.getByLabel("Описание пункта", { exact: true }).fill("Работает на телефоне")
    await form.getByRole("button", { name: "Сохранить", exact: true }).click()
    await expect(form.getByText("Введите название пункта", { exact: true })).toBeVisible()
    expect(state.writes).toHaveLength(1)
    await form.getByLabel("Название пункта", { exact: true }).fill("Адаптивная вёрстка")
    await page.setViewportSize({ width: width === 375 ? 1280 : 375, height: 900 })
    await expect(form.getByLabel("Название пункта", { exact: true })).toHaveValue(
      "Адаптивная вёрстка",
    )
    await expect(form.getByLabel("Описание пункта", { exact: true })).toHaveValue(
      "Работает на телефоне",
    )
    await form.getByRole("button", { name: "Сохранить", exact: true }).click()
    await expect(form).toBeHidden()
    expect(state.templates[0]).toMatchObject({
      title: "Адаптивная вёрстка",
      description: "Работает на телефоне",
      category_id: 1,
    })
    expect(state.writes[1].body).not.toHaveProperty("slug")
    await library.getByRole("button", { name: "Изменить пункт «Адаптивная вёрстка»" }).click()
    form = page.getByRole("dialog", { name: "Изменить пункт", exact: true })
    await form.getByLabel("Название пункта", { exact: true }).fill("Адаптивность")
    await form.getByRole("button", { name: "Сохранить", exact: true }).click()
    await expect(form).toBeHidden()
    await library.getByRole("button", { name: "Удалить пункт «Адаптивность»" }).click()
    let confirmation = page.getByRole("alertdialog")
    await confirmation.getByRole("button", { name: "Отмена", exact: true }).click()
    expect(state.templates).toHaveLength(1)
    await library.getByRole("button", { name: "Удалить пункт «Адаптивность»" }).click()
    await confirmation.getByRole("button", { name: "Удалить", exact: true }).click()
    await expect(confirmation).toBeHidden()
    expect(state.templates).toHaveLength(0)
    await library.getByRole("button", { name: "Изменить категорию «Интерфейс»" }).click()
    form = page.getByRole("dialog", { name: "Изменить категорию", exact: true })
    await form.getByLabel("Название категории", { exact: true }).fill("Новая категория")
    await form.getByRole("button", { name: "Сохранить", exact: true }).click()
    await expect(form).toBeHidden()
    await library.getByRole("button", { name: "Удалить категорию «Новая категория»" }).click()
    confirmation = page.getByRole("alertdialog")
    await confirmation.getByRole("button", { name: "Удалить", exact: true }).click()
    await expect(confirmation).toBeHidden()
    await expect(library.getByText("В этом направлении пока нет категорий.")).toBeVisible()
    expect(state.categories).toHaveLength(0)
    expect(await library.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    )
  })
}

test("library retries loading and retains input on write and delete conflicts", async ({
  page,
}) => {
  const state = await mockLibrary(page)
  state.failLoad = true
  state.categories.push({ id: 10, title: "Интерфейс", developer_type: "frontend" })
  await page.goto("/admin/tasks")
  await page.getByRole("button", { name: "Библиотека пунктов", exact: true }).click()
  const library = page.getByRole("dialog", { name: "Библиотека пунктов", exact: true })
  await expect(library.getByRole("alert")).toContainText("Запись используется в задачах")
  state.failLoad = false
  await library.getByRole("button", { name: "Повторить загрузку" }).click()
  await library.getByRole("button", { name: "Изменить категорию «Интерфейс»" }).click()
  const form = page.getByRole("dialog", { name: "Изменить категорию", exact: true })
  await form.getByLabel("Название категории", { exact: true }).fill("Мои правки")
  state.failWrite = true
  await form.getByRole("button", { name: "Сохранить", exact: true }).click()
  await expect(form.getByRole("alert")).toContainText("Запись используется в задачах")
  await expect(form.getByLabel("Название категории", { exact: true })).toHaveValue("Мои правки")
  state.failWrite = false
  await form.getByRole("button", { name: "Сохранить", exact: true }).click()
  await expect(form).toBeHidden()
  state.failWrite = true
  await library.getByRole("button", { name: "Удалить категорию «Мои правки»" }).click()
  const confirmation = page.getByRole("alertdialog")
  await confirmation.getByRole("button", { name: "Удалить", exact: true }).click()
  await expect(confirmation.getByRole("alert")).toContainText("Запись используется в задачах")
  expect(state.categories).toHaveLength(1)
  await confirmation.getByRole("button", { name: "Отмена", exact: true }).click()
  await expect(library.getByText("Мои правки", { exact: true })).toBeVisible()
})

test("library imports backend templates across directions into the selected task level", async ({
  page,
}) => {
  const state = await mockLibrary(page)
  state.categories.push(
    { id: 10, title: "Интерфейс", developer_type: "frontend" },
    { id: 11, title: "Доступность", parent_id: 10, developer_type: "frontend" },
    { id: 12, title: "Сервер", developer_type: "fullstack" },
  )
  for (const [id, category_id, title] of [
    [101, 10, "Вёрстка"],
    [102, 11, "Клавиатура"],
    [103, 12, "API"],
  ] as const) {
    state.templates.push({
      id,
      category_id,
      title,
      description: `Описание: ${title}`,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    })
  }
  await page.goto("/admin/tasks/editor?taskId=91")
  await page.getByRole("tab", { name: "Продвинутый (0 пунктов)", exact: true }).click()
  await page.getByRole("button", { name: "Импортировать пункты" }).click()
  const library = page.getByRole("dialog", { name: "Библиотека пунктов", exact: true })
  await library
    .getByRole("checkbox", { name: "Выбрать категорию «Интерфейс»", exact: true })
    .check()
  await library.getByRole("tab", { name: "Фуллстек", exact: true }).click()
  await library.getByRole("checkbox", { name: "Выбрать пункт «API»", exact: true }).check()
  await library.getByRole("tab", { name: "Фронтенд", exact: true }).click()
  await expect(
    library.getByRole("checkbox", { name: "Выбрать пункт «Клавиатура»", exact: true }),
  ).toBeChecked()
  await library.getByRole("button", { name: "Добавить выделенные (3)" }).click()
  await expect(library).toBeHidden()
  await expect(page.getByRole("tab", { name: "Продвинутый (3 пункта)", exact: true })).toBeVisible()
  for (const title of ["Вёрстка", "Клавиатура", "API"])
    await expect(page.getByRole("article").getByText(title, { exact: true })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Базовый (0 пунктов)", exact: true })).toBeVisible()
})

test("category forms support nested parents and moving templates between categories", async ({
  page,
}) => {
  const state = await mockLibrary(page)
  state.categories.push(
    { id: 10, title: "Интерфейс", developer_type: "frontend" },
    { id: 11, title: "Сервер", developer_type: "fullstack" },
  )
  await page.goto("/admin/tasks")
  await page.getByRole("button", { name: "Библиотека пунктов", exact: true }).click()
  const library = page.getByRole("dialog", { name: "Библиотека пунктов", exact: true })
  await library.getByRole("button", { name: "Добавить категорию" }).click()
  let form = page.getByRole("dialog", { name: "Новая категория", exact: true })
  await form.getByLabel("Название категории", { exact: true }).fill("Формы")
  await form.getByRole("combobox", { name: "Родительская категория" }).click()
  await expect(page.getByRole("option", { name: "Фуллстек / Сервер", exact: true })).toHaveCount(0)
  await page.getByRole("option", { name: "Фронтенд / Интерфейс", exact: true }).click()
  await form.getByRole("combobox", { name: "Направление разработки" }).click()
  await page.getByRole("option", { name: "Фуллстек", exact: true }).click()
  await expect(form.getByRole("combobox", { name: "Родительская категория" })).toContainText(
    "Без родительской категории",
  )
  await form.getByRole("combobox", { name: "Родительская категория" }).click()
  await expect(page.getByRole("option", { name: "Фронтенд / Интерфейс", exact: true })).toHaveCount(
    0,
  )
  await expect(page.getByRole("option", { name: "Фуллстек / Сервер", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await form.getByRole("combobox", { name: "Направление разработки" }).click()
  await page.getByRole("option", { name: "Фронтенд", exact: true }).click()
  await form.getByRole("combobox", { name: "Родительская категория" }).click()
  await page.getByRole("option", { name: "Фронтенд / Интерфейс", exact: true }).click()
  await form.getByRole("button", { name: "Сохранить", exact: true }).click()
  await expect(form).toBeHidden()
  expect(state.categories.find((category) => category.title === "Формы")?.parent_id).toBe(10)
  await library.getByRole("button", { name: "Добавить пункт в «Формы»" }).click()
  form = page.getByRole("dialog", { name: "Новый пункт", exact: true })
  await form.getByLabel("Название пункта", { exact: true }).fill("Валидация")
  await form.getByLabel("Описание пункта", { exact: true }).fill("Проверять ввод")
  await form.getByRole("combobox", { name: "Категория", exact: true }).click()
  await expect(page.getByRole("option", { name: "Фуллстек / Сервер", exact: true })).toHaveCount(0)
  await page.getByRole("option", { name: "Фронтенд / Интерфейс", exact: true }).click()
  await form.getByRole("button", { name: "Сохранить", exact: true }).click()
  await expect(form).toBeHidden()
  expect(state.templates[0].category_id).toBe(10)
  await library.getByRole("button", { name: "Изменить пункт «Валидация»" }).click()
  form = page.getByRole("dialog", { name: "Изменить пункт", exact: true })
  await form.getByRole("combobox", { name: "Категория", exact: true }).click()
  await page.getByRole("option", { name: "Фуллстек / Сервер", exact: true }).click()
  await form.getByRole("button", { name: "Сохранить", exact: true }).click()
  await expect(form).toBeHidden()
  await expect(library.getByRole("tab", { name: "Фуллстек" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(library.getByText("Валидация", { exact: true })).toBeVisible()
  expect(state.templates[0].category_id).toBe(11)
  await library.getByRole("button", { name: "Добавить пункт", exact: true }).click()
  form = page.getByRole("dialog", { name: "Новый пункт", exact: true })
  await expect(form.getByRole("combobox", { name: "Категория", exact: true })).toContainText(
    "Сервер",
  )
  await form.getByRole("combobox", { name: "Категория", exact: true }).click()
  await expect(page.getByRole("option")).toHaveCount(1)
  await expect(page.getByRole("option", { name: "Фуллстек / Сервер", exact: true })).toBeVisible()
})
