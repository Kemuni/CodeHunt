import { TaskLevel } from "@/lib/tasks/task-level"
import { test, expect } from "@playwright/test"
import { readFile } from "node:fs/promises"
import type {
  TaskDetail,
  CompositionUpdate,
  ComplicationItem,
  DraftRead,
  ResourceDownloadRead,
} from "../lib/api/task-contract"

function taskFixture(): TaskDetail {
  const stamp = "2026-01-01T00:00:00Z"
  const task: TaskDetail = {
    id: 91,
    title: "Задача с уровнями",
    slug: "nested-presets",
    short_description: "Краткое описание",
    full_description: "Общее описание задачи",
    developer_type: "frontend",
    difficulty_from: 1,
    difficulty_to: 5,
    status: "published",
    created_at: stamp,
    updated_at: stamp,
    photos: [],
    resources: [],
    presets: {
      easy: { preset: null, complications: [] },
      medium: { preset: null, complications: [] },
      high: { preset: null, complications: [] },
    },
  }
  for (const [index, level] of Object.values(TaskLevel).entries()) {
    task.presets[level] = {
      preset: {
        id: index + 10,
        task_id: task.id,
        level,
        description: `Описание ${level}`,
        average_days_to_complete: index + 2,
        created_at: stamp,
        updated_at: stamp,
      },
      complications: [
        {
          kind: "complication",
          id: index + 1,
          position: 0,
          order_number: 1,
          task_id: task.id,
          level,
          title: `Пункт ${level}`,
          description: `Реализация ${level}`,
          acceptance_criteria: `Проверка ${level}`,
          is_required: true,
          created_at: stamp,
          updated_at: stamp,
        },
      ],
    }
  }
  return task
}

for (const kind of ["task", "draft"] as const) {
  test(`editor downloads ${kind} attachments through the protected media proxy`, async ({
    page,
  }) => {
    const task = taskFixture()
    const filename = "Материалы проекта.zip"
    const resource: ResourceDownloadRead = {
      id: 42,
      task_id: kind === "task" ? task.id : null,
      draft_id: kind === "draft" ? task.id : null,
      title: "Материалы",
      type: "asset",
      original_filename: filename,
      content_type: "application/zip",
      size_bytes: 10,
      url: "/api/media/resources/42",
      created_at: task.created_at,
      updated_at: task.updated_at,
    }
    task.resources = [resource]
    const draft: DraftRead = {
      id: task.id,
      owner_id: 1,
      payload: {},
      revision: 1,
      validation_errors: [],
      is_valid: false,
      photos: [],
      resources: [resource],
      created_at: task.created_at,
      updated_at: task.updated_at,
    }
    const base = `/api/backend/editor/${kind === "draft" ? "task-drafts" : "tasks"}/${task.id}`
    let mediaRequests = 0
    await page.route("**/api/backend/**", async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === base) {
        await route.fulfill({ json: { success: true, data: kind === "draft" ? draft : task } })
      } else if (path === `${base}/resources/42/download-url`) {
        await route.fulfill({ json: { success: true, data: { url: resource.url } } })
      } else if (path === "/api/backend/editor/media/resources/42") {
        mediaRequests++
        await route.fulfill({
          contentType: "application/zip",
          body: "attachment",
          headers: {
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            "Cache-Control": "private, no-cache",
            ETag: '"file"',
          },
        })
      } else await route.abort()
    })
    await page.goto(`/admin/tasks/editor?${kind}Id=${task.id}`)
    const pending = page.waitForEvent("download")
    await page.getByRole("button", { name: "Скачать Материалы", exact: true }).click()
    const downloaded = await pending
    expect(downloaded.suggestedFilename()).toBe(filename)
    expect(await readFile((await downloaded.path())!, "utf8")).toBe("attachment")
    expect(mediaRequests).toBe(1)
  })
}

test("public task shows all own-level sections without configuration requests", async ({
  page,
}) => {
  const task = taskFixture()
  const requests: string[] = []
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    await route.fulfill({ json: { success: true, data: task } })
  })
  await page.goto(`/tasks/${task.id}`)
  const specification = page.getByRole("region", { name: "Техническое задание", exact: true })
  await expect(specification.getByRole("article")).toHaveCount(3)
  for (const [level, title] of [
    [TaskLevel.Easy, "Базовый функционал"],
    [TaskLevel.Medium, "Продвинутый функционал"],
    [TaskLevel.High, "Максимальный функционал"],
  ]) {
    const section = specification.getByRole("region", { name: title, exact: true })
    await expect(page.getByRole("region", { name: title, exact: true })).toHaveCount(1)
    await expect(section.getByText(`Пункт ${level}`, { exact: true })).toBeVisible()
    await expect(section.getByText(`Описание ${level}`, { exact: true })).toBeVisible()
    await expect(section.getByRole("article")).toHaveCount(1)
    const item = section.getByRole("article")
    await expect(item.getByText(`Проверка ${level}`, { exact: true })).toBeHidden()
    await item.getByRole("button", { name: "Критерии проверки", exact: true }).click()
    await expect(item.getByText(`Проверка ${level}`, { exact: true })).toBeVisible()
    await expect(item.getByRole("button", { name: /Переместить пункт/ })).toHaveCount(0)
  }
  await expect(page.getByText("Сложность: 1–5 из 10", { exact: true })).toHaveCount(1)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(task.title)
  await expect(page.getByText(task.short_description, { exact: true })).toBeVisible()
  await expect(page.getByRole("region", { name: "Техническое задание" })).toContainText(
    task.full_description,
  )
  expect(requests).toEqual([`/api/backend/tasks/${task.id}`])
})

test("editor loads keyed presets and saves existing IDs without creating duplicates", async ({
  page,
}) => {
  const task = taskFixture()
  let savedComposition: CompositionUpdate | undefined
  const updatedLevels: TaskLevel[] = []
  const unexpected: string[] = []
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let data: unknown = task
    if (path === `/api/backend/editor/tasks/${task.id}`) {
      if (request.method() === "PATCH") Object.assign(task, request.postDataJSON())
    } else if (path.endsWith("/composition") && request.method() === "PUT") {
      savedComposition = request.postDataJSON() as CompositionUpdate
      data = Object.values(task.presets).flatMap((value) => value.complications)
    } else if (path.includes("/presets/") && request.method() === "PATCH") {
      const values = request.postDataJSON()
      updatedLevels.push(values.level)
      const preset = task.presets[values.level as TaskLevel].preset!
      expect(path.endsWith(`/presets/${preset.id}`)).toBe(true)
      Object.assign(preset, values)
      data = preset
    } else {
      unexpected.push(`${request.method()} ${path}`)
      await route.abort()
      return
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto(`/admin/tasks/editor?taskId=${task.id}`)
  await expect(page.locator('[id="presets.easy.description"]')).toHaveValue("Описание easy")
  await page.getByRole("tab", { name: "Продвинутый (1 пункт)", exact: true }).click()
  await expect(page.locator('[id="presets.medium.description"]')).toHaveValue("Описание medium")
  await expect(page.getByText("Пункт medium", { exact: true })).toBeVisible()
  const item = page.getByRole("article", { name: "1. Пункт medium", exact: true })
  await expect(item.getByText("Проверка medium", { exact: true })).toBeHidden()
  await item.getByRole("button", { name: "Критерии проверки", exact: true }).click()
  await expect(item.getByText("Проверка medium", { exact: true })).toBeVisible()
  await expect(item.getByRole("button", { name: "Переместить пункт 1", exact: true })).toBeVisible()
  await page.locator('[id="presets.medium.description"]').fill("Новое описание medium")
  await page.getByRole("button", { name: "Сохранить задачу", exact: true }).click()
  await expect(
    page.getByText("Основная информация и пункты задачи сохранены", { exact: true }),
  ).toBeVisible()
  expect(savedComposition?.items.map((item) => item.id)).toEqual([1, 2, 3])
  expect(updatedLevels).toEqual([TaskLevel.Easy, TaskLevel.Medium, TaskLevel.High])
  expect(unexpected).toEqual([])
  await page.reload()
  await page.getByRole("tab", { name: "Продвинутый (1 пункт)", exact: true }).click()
  await expect(page.locator('[id="presets.medium.description"]')).toHaveValue(
    "Новое описание medium",
  )
})

test("each level previews four numbered leaves across nested collapsible categories", async ({
  page,
}) => {
  const task = taskFixture()
  for (const level of [TaskLevel.Easy, TaskLevel.Medium, TaskLevel.High] as const) {
    const template = task.presets[level].complications[0] as ComplicationItem
    const item = (id: number): ComplicationItem => ({
      ...template,
      id,
      title: `${level} требование ${id}`,
      order_number: id,
      position: id - 1,
      is_required: id !== 6,
    })
    const group = {
      kind: "group" as const,
      level,
      task_id: task.id,
      created_at: task.created_at,
      updated_at: task.updated_at,
      parent_group_id: null,
      position: 0,
    }
    task.presets[level].complications = [
      item(1),
      {
        ...group,
        id: 1,
        title: "Категория",
        items: [
          item(2),
          { ...group, id: 2, title: "Подкатегория", items: [item(3), item(4), item(5)] },
        ],
      },
      item(6),
    ]
  }
  await page.route("**/api/backend/**", (route) =>
    route.fulfill({ json: { success: true, data: task } }),
  )
  await page.goto(`/tasks/${task.id}`)
  for (const title of ["Базовый", "Продвинутый", "Максимальный"]) {
    const section = page.getByRole("region", { name: `${title} функционал`, exact: true })
    await expect(section.getByRole("article")).toHaveCount(4)
    await expect(section.getByRole("button", { name: "Показать все 6 пунктов" })).toBeVisible()
  }
  const base = page.getByRole("region", { name: "Базовый функционал", exact: true })
  await expect(
    page.getByRole("article", { name: "1. medium требование 1", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("article", { name: "1. high требование 1", exact: true }),
  ).toBeVisible()
  await expect(
    base
      .getByRole("group", { name: "Категория «Категория»", exact: true })
      .getByText("4 пункта", { exact: true }),
  ).toBeVisible()
  await expect(
    base
      .getByRole("group", { name: "Категория «Подкатегория»", exact: true })
      .getByText("3 пункта", { exact: true }),
  ).toBeVisible()
  await expect(base.getByRole("button", { name: /Переместить категорию|Действия:/ })).toHaveCount(0)
  await expect(
    base.getByRole("article", { name: "4. easy требование 4", exact: true }),
  ).toBeVisible()
  await base
    .getByRole("button", { name: "Свернуть или раскрыть категорию «Подкатегория»", exact: true })
    .click()
  await expect(base.getByRole("article")).toHaveCount(2)
  await base
    .getByRole("button", { name: "Свернуть или раскрыть категорию «Подкатегория»", exact: true })
    .click()
  await base.getByRole("button", { name: "Показать все 6 пунктов" }).click()
  await expect(base.getByRole("article")).toHaveCount(6)
  await expect(
    base.getByRole("article", { name: "6. easy требование 6", exact: true }),
  ).toContainText("необязательно")
  await expect(
    page.getByRole("region", { name: "Продвинутый функционал", exact: true }).getByRole("article"),
  ).toHaveCount(4)
  await base.getByRole("button", { name: "Свернуть пункты" }).click()
  await expect(base.getByRole("article")).toHaveCount(4)
})

for (const width of [1440, 390]) {
  test(`gallery and attachments work at ${width}px, including real browser download`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const task = taskFixture()
    task.design_author_name = "Автор макета"
    task.design_author_link = "https://example.com/designer"
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfU8AAAAASUVORK5CYII="
    task.photos = [1, 2].map((id) => ({
      id,
      task_id: task.id,
      draft_id: null,
      position: id,
      is_cover: id === 1,
      original_filename: `photo-${id}.png`,
      content_type: "image/png",
      size_bytes: 68,
      url: png,
      created_at: task.created_at,
      updated_at: task.updated_at,
    }))
    task.resources = [
      {
        id: 1,
        title: "Описание проекта",
        original_filename: "specification.pdf",
        type: "specification",
        content_type: "application/pdf",
      },
      {
        id: 2,
        title: "Материалы проекта",
        original_filename: "assets.zip",
        type: "asset",
        content_type: "application/zip",
      },
    ].map((file) => ({
      ...file,
      type: file.type as "specification" | "asset",
      task_id: task.id,
      draft_id: null,
      size_bytes: 1234,
      url: `/api/media/resources/${file.id}`,
      created_at: task.created_at,
      updated_at: task.updated_at,
    }))
    let downloads = 0
    await page.route("**/api/backend/**", async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith("/resources/1/download-url")) {
        downloads++
        await route.fulfill({
          json: { success: true, data: { url: "/api/media/resources/1" } },
        })
      } else if (path.endsWith("/resources/2/download-url")) {
        await route.fulfill({
          status: 503,
          json: {
            success: false,
            errors: { code: "storage_unavailable", message: "Хранилище временно недоступно" },
          },
        })
      } else if (path === "/api/backend/media/resources/1") {
        await route.fulfill({
          contentType: "application/pdf",
          body: "test attachment",
          headers: {
            "Cache-Control": "private, no-cache",
            ETag: '"attachment"',
            "Content-Disposition": 'attachment; filename="specification.pdf"',
          },
        })
      } else {
        await route.fulfill({ json: { success: true, data: task } })
      }
    })
    await page.goto(`/tasks/${task.id}`)
    const back = page.getByRole("link", { name: "Вернуться назад", exact: true })
    await expect(back).toHaveAttribute("href", "/tasks")
    const headingBounds = await page
      .getByRole("heading", { name: "Обзор задачи", exact: true })
      .boundingBox()
    const backBounds = await back.boundingBox()
    expect(backBounds!.x).toBeGreaterThan(headingBounds!.x + headingBounds!.width)
    expect(
      Math.abs(
        backBounds!.y + backBounds!.height / 2 - headingBounds!.y - headingBounds!.height / 2,
      ),
    ).toBeLessThan(2)
    await expect(page.getByRole("link", { name: "Автор макета" })).toHaveAttribute(
      "href",
      task.design_author_link,
    )
    const gallery = page.getByRole("region", { name: "Фотографии задачи" })
    await expect(gallery.getByRole("button", { name: "Предыдущее фото" })).toBeDisabled()
    await gallery.getByRole("button", { name: "Следующее фото" }).click()
    await expect(gallery.getByRole("button", { name: "Следующее фото" })).toBeDisabled()
    await gallery.getByRole("button", { name: "Предыдущее фото" }).click()
    await expect(gallery.getByRole("button", { name: "Предыдущее фото" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Скачать Описание проекта" })).toHaveCount(0)
    await page.getByRole("button", { name: "Вложения", exact: true }).click()
    const modal = page.getByRole("dialog", { name: "Вложения к задаче" })
    await expect(modal).toBeVisible()
    await expect(modal.getByRole("listitem")).toHaveCount(2)
    await expect(modal.getByText(/specification.pdf/)).toBeVisible()
    await expect(modal).toHaveAttribute(
      "data-slot",
      width < 768 ? "drawer-popup" : "dialog-content",
    )
    const downloadEvent = page.waitForEvent("download")
    await modal.getByRole("button", { name: "Скачать Описание проекта" }).click()
    const download = await downloadEvent
    expect(download.suggestedFilename()).toBe("specification.pdf")
    expect(await readFile((await download.path())!, "utf8")).toBe("test attachment")
    expect(downloads).toBe(1)
    await modal.getByRole("button", { name: "Скачать Материалы проекта" }).click()
    await expect(page.getByText("Хранилище временно недоступно", { exact: true })).toBeVisible()
    await expect(modal).toBeVisible()
    const bounds = await modal.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    if (width < 768) await modal.getByRole("button", { name: "Закрыть", exact: true }).click()
    else await page.keyboard.press("Escape")
    await expect(modal).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Вложения", exact: true })).toBeFocused()
    await page.route("**/api/backend/tasks?*", (route) =>
      route.fulfill({
        json: { success: true, data: { items: [], total: 0, limit: 20, offset: 0 } },
      }),
    )
    await back.click()
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(page.getByRole("heading", { name: "Каталог задач", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Вернуться назад", exact: true })).toHaveCount(0)
  })
}

test("empty media and categories have clear states and absent levels are omitted", async ({
  page,
}) => {
  const task = taskFixture()
  task.presets.medium = { preset: null, complications: [] }
  task.presets.easy.complications = []
  task.presets.high.complications = [
    {
      kind: "group",
      id: 1,
      title: "Пустая категория",
      level: TaskLevel.High,
      task_id: task.id,
      parent_group_id: null,
      position: 0,
      created_at: task.created_at,
      updated_at: task.updated_at,
      items: [],
    },
  ]
  await page.route("**/api/backend/**", (route) =>
    route.fulfill({ json: { success: true, data: task } }),
  )
  await page.goto(`/tasks/${task.id}`)
  await expect(page.getByText("Фотографии пока не добавлены")).toBeVisible()
  await expect(page.getByText("Пункты пока не добавлены.")).toBeVisible()
  await expect(page.getByText("В категории пока нет пунктов.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Продвинутый функционал" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Показать все/ })).toHaveCount(0)
  await page.getByRole("button", { name: "Вложения", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("К задаче пока не прикреплены файлы.")
})

test("shared editor groups preserve an unfinished item form when collapsed", async ({ page }) => {
  const task = taskFixture()
  task.presets.easy.complications = [
    {
      kind: "group",
      id: 15,
      title: "Группа редактора",
      level: TaskLevel.Easy,
      task_id: task.id,
      parent_group_id: null,
      position: 0,
      created_at: task.created_at,
      updated_at: task.updated_at,
      items: task.presets.easy.complications,
    },
  ]
  await page.route("**/api/backend/**", (route) =>
    route.fulfill({ json: { success: true, data: task } }),
  )
  await page.goto(`/admin/tasks/editor?taskId=${task.id}`)
  const group = page.getByRole("group", { name: "Категория «Группа редактора»", exact: true })
  await expect(group.getByText("1 пункт", { exact: true })).toBeVisible()
  await expect(
    group.getByRole("button", { name: 'Переместить категорию "Группа редактора"', exact: true }),
  ).toBeVisible()
  await expect(
    group.getByRole("button", { name: "Действия: Группа редактора", exact: true }),
  ).toBeVisible()
  await group.getByRole("button", { name: "Действия: Пункт easy", exact: true }).click()
  await page.getByRole("menuitem", { name: "Изменить пункт", exact: true }).click()
  const title = group.getByLabel("Название пункта", { exact: true })
  await title.fill("Несохранённое изменение")
  const toggle = group.getByRole("button", {
    name: "Свернуть или раскрыть категорию «Группа редактора»",
    exact: true,
  })
  await toggle.click()
  await expect(title).toBeHidden()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await toggle.click()
  await expect(title).toBeVisible()
  await expect(title).toHaveValue("Несохранённое изменение")
  await group.getByRole("button", { name: "Сохранить", exact: true }).click()
  await expect(
    group.getByRole("article", { name: "1. Несохранённое изменение", exact: true }),
  ).toBeVisible()
  await expect(group.getByText("1 пункт", { exact: true })).toBeVisible()
})
