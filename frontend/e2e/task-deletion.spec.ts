import { TaskLevel } from "@/lib/tasks/task-level"
import type { Page } from "@playwright/test"
import { test, expect } from "./auth-fixture"
import type { DraftSummary, TaskRead } from "../lib/api/task-contract"

const stamp = "2026-01-01T00:00:00Z"
const taskFixture = (id = 1, status: TaskRead["status"] = "published"): TaskRead => ({
  id,
  status,
  title: `Задача ${id}`,
  slug: `task-${id}`,
  short_description: "Описание",
  full_description: "Полное описание",
  developer_type: "frontend",
  difficulty_from: 1,
  difficulty_to: 5,
  created_at: stamp,
  updated_at: stamp,
})
const draftFixture = (): DraftSummary => ({
  id: 7,
  revision: 3,
  title: "Мой черновик",
  short_description: "",
  cover_photo: null,
  created_at: stamp,
  updated_at: stamp,
})

async function mockCatalog(page: Page, tasks = [taskFixture()]) {
  const state = {
    tasks,
    drafts: [draftFixture()],
    writes: [] as string[],
    conflictDraft: false,
    rejectTask: false,
  }
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace("/api/backend/", "")
    const method = request.method()
    if (method !== "GET") state.writes.push(`${method} ${path}${url.search}`)
    const reply = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (method === "GET" && ["tasks", "editor/tasks", "editor/task-drafts"].includes(path)) {
      const items = path === "editor/task-drafts" ? state.drafts : state.tasks
      const offset = Number(url.searchParams.get("offset") ?? 0)
      return reply({
        items: items.slice(offset, offset + 20),
        total: items.length,
        limit: 20,
        offset,
      })
    }
    if (path.startsWith("editor/task-drafts/") && method === "DELETE") {
      expect(url.searchParams.get("revision")).toBe(String(state.drafts[0].revision))
      if (state.conflictDraft) {
        state.conflictDraft = false
        state.drafts[0].revision++
        state.drafts[0].title = "Обновлённый черновик"
        return route.fulfill({
          status: 409,
          json: {
            success: false,
            errors: {
              code: "draft_revision_conflict",
              message: "Черновик изменён в другой вкладке",
            },
          },
        })
      }
      state.drafts = []
      return reply(null)
    }
    const id = Number(path.split("/").at(-1))
    if (path.startsWith("editor/tasks/") && method === "PATCH") {
      expect(request.postDataJSON()).toEqual({ status: "archived" })
      const task = state.tasks.find((item) => item.id === id)!
      task.status = "archived"
      return reply(task)
    }
    if (path.startsWith("editor/tasks/") && method === "DELETE") {
      if (state.rejectTask)
        return route.fulfill({
          status: 409,
          json: {
            success: false,
            errors: {
              code: "reference_conflict",
              message: "Объект используется другими записями",
            },
          },
        })
      state.tasks = state.tasks.filter((item) => item.id !== id)
      return reply(null)
    }
    throw new Error(`Unexpected request: ${method} ${path}`)
  })
  return state
}

async function confirmDeletion(page: Page) {
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить", exact: true }).click()
}

test("public catalog hides deletion; cancelling preserves the task; confirming archives and deletes", async ({
  page,
}) => {
  const state = await mockCatalog(page)
  await page.goto("/tasks")
  await expect(page.getByText("Задача 1", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /Удалить/ })).toHaveCount(0)
  await page.goto("/admin/tasks")
  const remove = page.getByRole("button", { name: "Удалить задачу «Задача 1»", exact: true })
  await remove.click()
  await expect(page.getByRole("alertdialog")).toContainText("снята с публикации и удалена")
  await expect(page.getByRole("button", { name: "Отмена", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Отмена", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  expect(state.writes).toEqual([])
  await remove.click()
  await confirmDeletion(page)
  await expect(page.getByText("Задач пока нет", { exact: true })).toBeVisible()
  await expect(page.getByText("Всего: 0", { exact: true })).toBeVisible()
  expect(state.writes).toEqual(["PATCH editor/tasks/1", "DELETE editor/tasks/1"])
})

test("deleting the last task on a page returns to the preceding page without archiving again", async ({
  page,
}) => {
  const state = await mockCatalog(
    page,
    Array.from({ length: 21 }, (_, i) => taskFixture(i + 1, "archived")),
  )
  await page.goto("/admin/tasks")
  await page.getByRole("button", { name: "Далее", exact: true }).click()
  await page.getByRole("button", { name: "Удалить задачу «Задача 21»", exact: true }).click()
  await confirmDeletion(page)
  await expect(page.getByText("Задача 1", { exact: true })).toBeVisible()
  await expect(page.getByText("Задача 21", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Всего: 20", { exact: true })).toBeVisible()
  expect(state.writes).toEqual(["DELETE editor/tasks/21"])
})

test("draft revision conflicts refresh the list and require a new confirmation", async ({
  page,
}) => {
  const state = await mockCatalog(page)
  state.conflictDraft = true
  await page.goto("/admin/tasks")
  await page.getByRole("tab", { name: "Мои черновики", exact: true }).click()
  await page.getByRole("button", { name: "Удалить черновик «Мой черновик»", exact: true }).click()
  await confirmDeletion(page)
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(page.getByText("Обновлённый черновик", { exact: true })).toBeVisible()
  await expect(page.getByText(/Черновик изменился в другом окне/)).toBeVisible()
  expect(state.writes).toEqual(["DELETE editor/task-drafts/7?revision=3"])
  await page
    .getByRole("button", { name: "Удалить черновик «Обновлённый черновик»", exact: true })
    .click()
  await confirmDeletion(page)
  await expect(page.getByText("У вас пока нет черновиков", { exact: true })).toBeVisible()
  expect(state.writes).toEqual([
    "DELETE editor/task-drafts/7?revision=3",
    "DELETE editor/task-drafts/7?revision=4",
  ])
})

test("failed deletion preserves the task and explains its archive status", async ({ page }) => {
  const state = await mockCatalog(page)
  state.rejectTask = true
  await page.goto("/admin/tasks")
  await page.getByRole("button", { name: "Удалить задачу «Задача 1»", exact: true }).click()
  await confirmDeletion(page)
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText(
    "перенесена в архив, но не удалена",
  )
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText(
    "используется в решениях",
  )
  await page.getByRole("button", { name: "Отмена", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(page.getByText("Задача 1", { exact: true })).toBeVisible()
  expect(state.writes).toEqual(["PATCH editor/tasks/1", "DELETE editor/tasks/1"])
  await page.getByRole("button", { name: "Удалить задачу «Задача 1»", exact: true }).click()
  await confirmDeletion(page)
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText(
    "Удаление недоступно",
  )
  expect(state.writes).toEqual([
    "PATCH editor/tasks/1",
    "DELETE editor/tasks/1",
    "DELETE editor/tasks/1",
  ])
})

test("pending deletion disables repeat submission and dismissal", async ({ page }) => {
  const state = await mockCatalog(page, [taskFixture(1, "archived")])
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route("**/api/backend/editor/tasks/1", async (route) => {
    await pending
    await route.fallback()
  })
  try {
    await page.goto("/admin/tasks")
    await page.getByRole("button", { name: "Удалить задачу «Задача 1»", exact: true }).click()
    await confirmDeletion(page)
    await expect(page.getByRole("button", { name: "Удаляем…", exact: true })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Отмена", exact: true })).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog")).toBeVisible()
    finish()
    await expect(page.getByText("Задач пока нет", { exact: true })).toBeVisible()
    expect(state.writes).toEqual(["DELETE editor/tasks/1"])
  } finally {
    finish()
  }
})

test(
  "live catalog deletes its own draft and published task",
  { tag: "@live" },
  async ({ page, request }) => {
    test.skip(process.env.E2E_LIVE_API !== "1", "Нужен локальный backend и E2E_LIVE_API=1")
    const unique = Date.now()
    const taskTitle = `Удаление задачи ${unique}`
    const draftTitle = `Удаление черновика ${unique}`
    let taskId: number | undefined
    let draftId: number | undefined
    let publicationDraftId: number | undefined
    try {
      const draftResponse = await request.post("/api/backend/editor/task-drafts", {
        data: { payload: { title: draftTitle } },
      })
      expect(draftResponse.ok()).toBeTruthy()
      draftId = (await draftResponse.json()).data.id
      const publicationDraftResponse = await request.post("/api/backend/editor/task-drafts", {
        data: {
          payload: {
            title: taskTitle,
            slug: `delete-test-${unique}`,
            short_description: "Тест удаления",
            full_description: "Задача для проверки удаления",
            developer_type: "frontend",
            difficulty_from: 1,
            difficulty_to: 3,
            items: [
              {
                kind: "complication",
                title: "Пункт",
                description: "Описание",
                acceptance_criteria: "Работает",
                level: TaskLevel.Easy,
              },
            ],
            presets: [{ level: TaskLevel.Easy, description: "Базовый уровень" }],
          },
        },
      })
      expect(publicationDraftResponse.ok()).toBeTruthy()
      const publicationDraft = (await publicationDraftResponse.json()).data
      publicationDraftId = publicationDraft.id
      const taskResponse = await request.post(
        `/api/backend/editor/task-drafts/${publicationDraftId}/publish`,
        { data: { revision: publicationDraft.revision } },
      )
      expect(taskResponse.ok()).toBeTruthy()
      taskId = (await taskResponse.json()).data.id
      publicationDraftId = undefined
      await page.goto("/admin/tasks")
      await page.getByRole("tab", { name: "Мои черновики", exact: true }).click()
      await page
        .getByRole("button", { name: `Удалить черновик «${draftTitle}»`, exact: true })
        .click()
      await confirmDeletion(page)
      await expect(page.getByText("Черновик удалён", { exact: true })).toBeVisible()
      expect((await request.get(`/api/backend/editor/task-drafts/${draftId}`)).status()).toBe(404)
      draftId = undefined
      await page.getByRole("tab", { name: "Все задачи", exact: true }).click()
      await expect(page.getByText(/Всего:/)).toBeVisible()
      const next = page.getByRole("button", { name: "Далее", exact: true })
      while ((await next.isVisible()) && (await next.isEnabled())) {
        await next.click()
        await expect(page.getByText(/Всего:/)).toBeVisible()
      }
      await page.getByRole("button", { name: `Удалить задачу «${taskTitle}»`, exact: true }).click()
      await confirmDeletion(page)
      await expect(page.getByText("Задача удалена", { exact: true })).toBeVisible()
      expect((await request.get(`/api/backend/editor/tasks/${taskId}`)).status()).toBe(404)
      taskId = undefined
    } finally {
      for (const id of [draftId, publicationDraftId].filter((id) => id !== undefined)) {
        const response = await request.get(`/api/backend/editor/task-drafts/${id}`)
        if (response.ok()) {
          const draft = (await response.json()).data
          await request.delete(`/api/backend/editor/task-drafts/${id}?revision=${draft.revision}`)
        }
      }
      if (taskId) {
        await request.patch(`/api/backend/editor/tasks/${taskId}`, { data: { status: "archived" } })
        await request.delete(`/api/backend/editor/tasks/${taskId}`)
      }
    }
  },
)
