import { test, expect } from "@playwright/test"
import type { TaskDetail, CompositionUpdate, Level } from "../lib/api/task-contract"

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
  for (const [index, level] of (["easy", "medium", "high"] as const).entries()) {
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

test("public task switches own-level requirements without configuration requests", async ({
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
  await expect(page.getByText("Пункт easy", { exact: true })).toBeVisible()
  await expect(page.getByText("Пункт medium", { exact: true })).toHaveCount(0)
  await page.getByRole("tab", { name: "Продвинутый", exact: true }).click()
  await expect(page.getByText("Пункт medium", { exact: true })).toBeVisible()
  await expect(page.getByText("Описание medium", { exact: true })).toBeVisible()
  await expect(page.getByText("Пункт easy", { exact: true })).toHaveCount(0)
  await page.getByRole("tab", { name: "Максимальный", exact: true }).click()
  await expect(page.getByText("Пункт high", { exact: true })).toBeVisible()
  await expect(page.getByText("Пункт medium", { exact: true })).toHaveCount(0)
  expect(requests).toEqual([`/api/backend/tasks/${task.id}`])
})

test("editor loads keyed presets and saves existing IDs without creating duplicates", async ({
  page,
}) => {
  const task = taskFixture()
  let savedComposition: CompositionUpdate | undefined
  const updatedLevels: Level[] = []
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
      const preset = task.presets[values.level as Level].preset!
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
  await page.locator('[id="presets.medium.description"]').fill("Новое описание medium")
  await page.getByRole("button", { name: "Сохранить задачу", exact: true }).click()
  await expect(
    page.getByText("Основная информация и пункты задачи сохранены", { exact: true }),
  ).toBeVisible()
  expect(savedComposition?.items.map((item) => item.id)).toEqual([1, 2, 3])
  expect(updatedLevels).toEqual(["easy", "medium", "high"])
  expect(unexpected).toEqual([])
  await page.reload()
  await page.getByRole("tab", { name: "Продвинутый (1 пункт)", exact: true }).click()
  await expect(page.locator('[id="presets.medium.description"]')).toHaveValue(
    "Новое описание medium",
  )
})
