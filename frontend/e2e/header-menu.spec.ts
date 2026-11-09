import { test, expect } from "./auth-fixture"

test.skip(!process.env.E2E_AUTH_SECRET, "Нужен изолированный backend авторизации")

for (const width of [320, 390, 768]) {
  test(`burger menu opens and closes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/login")
    const header = page.getByRole("banner")
    await expect(header.getByRole("navigation", { name: "Основная навигация" })).toBeHidden()
    await expect(header.getByText("GitHub Test User", { exact: true })).toBeVisible()
    const trigger = page.getByRole("button", { name: "Открыть меню", includeHidden: true })
    await trigger.click()
    const menu = page.getByRole("dialog", { name: "Меню" })
    await expect(menu).toBeVisible()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(menu.getByRole("link", { name: "Админка" })).toBeVisible()
    await expect(menu.getByRole("button", { name: "Выйти" })).toBeVisible()
    // Панель появляется анимацией с правого края: проверяем её конечное положение.
    await expect
      .poll(async () => {
        const bounds = await menu.boundingBox()
        return bounds ? bounds.x + bounds.width : Infinity
      })
      .toBeLessThanOrEqual(width)
    expect((await menu.boundingBox())!.x).toBeGreaterThanOrEqual(0)
    if (width === 390) await page.screenshot({ path: "/tmp/codehunt-burger-mobile.png" })
    await page.keyboard.press("Escape")
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await menu.getByRole("button", { name: "Закрыть меню" }).click()
    await expect(menu).toHaveCount(0)
    await trigger.click()
    await page.mouse.click(4, 200)
    await expect(menu).toHaveCount(0)
  })
}

test("navigation closes the menu and desktop resize restores the normal header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto("/login")
  await page.getByRole("button", { name: "Открыть меню" }).click()
  await page.getByRole("dialog", { name: "Меню" }).getByRole("link", { name: "Админка" }).click()
  await expect(page).toHaveURL(/\/admin\/tasks$/)
  await expect(page.getByRole("dialog", { name: "Меню" })).toHaveCount(0)
  await page.getByRole("button", { name: "Открыть меню" }).click()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.getByRole("dialog", { name: "Меню" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Открыть меню" })).toBeHidden()
  await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible()
  await expect(page.getByRole("banner").getByRole("button", { name: "Выйти" })).toBeVisible()
})

test("guest can start GitHub login from the mobile menu", async ({ page, context }) => {
  await context.clearCookies()
  await page.setViewportSize({ width: 390, height: 800 })
  await page.route("https://github.com/login/oauth/authorize**", (route) =>
    route.fulfill({ body: "GitHub OAuth" }),
  )
  await page.goto("/login")
  await page.getByRole("button", { name: "Открыть меню" }).click()
  const menu = page.getByRole("dialog", { name: "Меню" })
  await expect(menu.getByRole("link", { name: "Админка" })).toHaveCount(0)
  await expect(menu.getByRole("button", { name: "Регистрация" })).toBeVisible()
  await menu.getByRole("button", { name: "Войти", exact: true }).click()
  await expect(page).toHaveURL(/^https:\/\/github.com\/login\/oauth\/authorize/)
})
