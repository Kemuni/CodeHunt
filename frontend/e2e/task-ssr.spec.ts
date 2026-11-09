import { test, expect, sessionCookie } from "./auth-fixture"
import { registerPublicTask } from "./public-task-fixture"
import type { TaskDetail } from "../lib/api/task-contract"

const task: TaskDetail = {
  id: 800,
  slug: "server-rendered-task",
  title: "Серверное техническое задание",
  short_description: "Описание для поисковой выдачи",
  full_description: "Текст задания доступен без JavaScript",
  developer_type: "frontend",
  difficulty_from: 1,
  difficulty_to: 3,
  is_hidden: false,
  is_paid: false,
  created_at: "2026-11-09T00:00:00Z",
  updated_at: "2026-11-09T00:00:00Z",
  photos: [],
  resources: [],
  presets: {
    easy: { preset: null, complications: [] },
    medium: { preset: null, complications: [] },
    high: { preset: null, complications: [] },
  },
}

test.use({ javaScriptEnabled: false })

test("task HTML and metadata are rendered without JavaScript; missing task has HTTP 404", async ({
  page,
  context,
}) => {
  await context.clearCookies()
  await registerPublicTask(task)
  const response = await page.goto(`/tasks/${task.slug}`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { name: task.title, exact: true })).toBeVisible()
  await expect(page.getByText(task.full_description, { exact: true })).toBeVisible()
  await expect(page).toHaveTitle(`${task.title} — Track Dev`)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    task.short_description,
  )
  const missing = await page.goto("/tasks/not-existing-ssr-task")
  expect(missing?.status()).toBe(404)
})

test("paid task SSR never leaks content to guests or members and permits admins", async ({
  page,
  context,
}) => {
  const paid = {
    ...task,
    slug: "paid-server-task",
    title: "Закрытое платное задание",
    is_paid: true,
  }
  await registerPublicTask(paid)
  for (const role of ["guest", "member", "admin"] as const) {
    await context.clearCookies()
    if (role !== "guest") await context.addCookies([await sessionCookie(role)])
    const response = await page.goto(`/tasks/${paid.slug}`)
    expect(response?.status()).toBe(role === "admin" ? 200 : 404)
    if (role !== "admin") expect(await response!.text()).not.toContain(paid.title)
    else {
      await expect(page.getByRole("heading", { name: paid.title, exact: true })).toBeVisible()
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
    }
  }
})
