import { test, expect } from "./auth-fixture"
import type { TaskRead } from "../lib/api/task-contract"

const task: TaskRead = {
  id: 1,
  title: "Каталог фильмов",
  slug: "movies",
  short_description: "Тест фильтрации",
  full_description: "Тест фильтрации",
  developer_type: "frontend",
  difficulty_from: 1,
  difficulty_to: 8,
  is_paid: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

for (const path of ["/tasks", "/admin/tasks"]) {
  test(`catalog controls debounce search, reset pagination and combine filters: ${path}`, async ({
    page,
    context,
  }) => {
    if (path === "/tasks") await context.clearCookies()
    const requests: URLSearchParams[] = []
    await page.route(
      `**/api/backend/${path === "/tasks" ? "tasks" : "editor/tasks"}?**`,
      async (route) => {
        const params = new URL(route.request().url()).searchParams
        requests.push(params)
        await route.fulfill({
          json: {
            success: true,
            data: {
              items: [task],
              total: params.has("q") ? 1 : 21,
              limit: 20,
              offset: Number(params.get("offset")),
            },
          },
        })
      },
    )
    await page.goto(path)
    await expect(page.getByText("Всего: 21", { exact: true })).toBeVisible()
    await expect(page.getByText("По подписке", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Далее", exact: true }).click()
    await expect.poll(() => requests.at(-1)?.get("offset")).toBe("20")
    await expect(page.getByText("2 / 2", { exact: true })).toBeVisible()
    const before = requests.length
    await page.clock.install()
    await page.clock.pauseAt(new Date())
    const search = page.getByRole("searchbox", { name: "Поиск задач" })
    await search.fill("К")
    await page.clock.runFor(100)
    await search.fill("Ката")
    await page.clock.runFor(100)
    await search.fill("Каталог")
    await page.clock.runFor(299)
    expect(requests).toHaveLength(before)
    await page.clock.runFor(1)
    await expect.poll(() => requests.length).toBe(before + 1)
    expect(requests.at(-1)?.get("q")).toBe("Каталог")
    expect(requests.at(-1)?.get("offset")).toBe("0")
    await page.clock.resume()
    await page.getByRole("button", { name: "Фильтры", exact: true }).click()
    const menu = page.getByRole("menu", { name: "Фильтры задач" })
    await menu.getByRole("menuitemcheckbox", { name: "Фронтенд", exact: true }).click()
    await expect(menu).toBeVisible()
    await expect(page.getByRole("button", { name: "Фильтры: активно 1" })).toBeVisible()
    await menu.getByRole("menuitemcheckbox", { name: "Фуллстек", exact: true }).click()
    await menu.getByRole("menuitemradio", { name: "По подписке", exact: true }).click()
    const slider = menu.getByRole("slider", { name: "Минимальная сложность" })
    await slider.focus()
    await slider.press("ArrowRight")
    await expect(slider).toHaveValue("1")
    await expect(page.getByRole("button", { name: "Фильтры: активно 3" })).toBeVisible()
    await expect.poll(() => requests.at(-1)?.get("difficulty_min")).toBe("1")
    expect(requests.at(-1)?.getAll("developer_type")).toEqual(["frontend", "fullstack"])
    expect(requests.at(-1)?.get("access")).toBe("subscription")
    await menu.getByRole("menuitem", { name: "Очистить фильтры" }).click()
    await expect(page.getByRole("button", { name: "Фильтры", exact: true })).toBeVisible()
    await expect(menu.getByRole("slider", { name: "Минимальная сложность" })).toHaveValue("0")
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: /^Сортировать по:/ }).click()
    await page.getByRole("menuitemradio", { name: "Сначала сложные", exact: true }).click()
    await expect.poll(() => requests.at(-1)?.get("sort")).toBe("difficulty_desc")
    expect(requests.at(-1)?.get("q")).toBe("Каталог")
    expect(requests.at(-1)?.has("developer_type")).toBe(false)
    expect(requests.at(-1)?.has("difficulty_min")).toBe(false)
    expect(requests.at(-1)?.has("access")).toBe(false)
    await expect(search).toHaveValue("Каталог")
  })
}

test("catalog filters fit a mobile screen and support an empty result", async ({
  page,
  context,
}) => {
  await context.clearCookies()
  await page.setViewportSize({ width: 360, height: 740 })
  await page.route("**/api/backend/tasks?**", (route) =>
    route.fulfill({
      json: { success: true, data: { items: [], total: 0, offset: 0, limit: 20 } },
    }),
  )
  await page.goto("/tasks")
  await page.getByRole("searchbox", { name: "Поиск задач" }).fill("Нет совпадений")
  await expect(page.getByText("По вашему запросу задач не найдено")).toBeVisible()
  await expect(page.getByRole("searchbox", { name: "Поиск задач" })).toBeVisible()
  await page.getByRole("button", { name: "Фильтры", exact: true }).click()
  const menu = page.getByRole("menu", { name: "Фильтры задач" })
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(360)
  await menu.getByRole("menuitemradio", { name: "Бесплатно", exact: true }).click()
  await expect(page.getByRole("button", { name: "Фильтры: активно 1" })).toBeVisible()
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
