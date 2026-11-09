import { test, expect } from "./auth-fixture"

test.skip(!process.env.E2E_AUTH_SECRET, "Нужен изолированный backend авторизации")

test.describe("server-rendered session", () => {
  test.use({ javaScriptEnabled: false })

  test("header shows the signed-in account before JavaScript runs", async ({ page }) => {
    await page.goto("/login")
    const header = page.getByRole("banner")
    await expect(header.getByText("GitHub Test User", { exact: true })).toBeVisible()
    await expect(header.getByRole("button", { name: "Выйти", exact: true })).toBeVisible()
    await expect(header.getByText("Загрузка...")).toHaveCount(0)
    expect(await page.content()).not.toContain("e2e-admin")
  })

  test("guest header is rendered without a session loading state", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/login")
    const header = page.getByRole("banner")
    await expect(header.getByRole("button", { name: "Войти", exact: true })).toBeVisible()
    await expect(header.getByText("Загрузка...")).toHaveCount(0)
  })
})

for (const width of [320, 390, 768, 1440]) {
  test(`header avatar and footer fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/login")
    const header = page.getByRole("banner")
    await expect(header.getByRole("img", { name: "Аватар GitHub Test User" })).toBeVisible()
    await expect(header.getByText("GitHub Test User", { exact: true })).toBeVisible()
    const footer = page.getByRole("contentinfo")
    await footer.scrollIntoViewIfNeeded()
    await expect(footer.getByRole("link", { name: "support@kodmentor.ru" })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    for (const link of await footer.getByRole("link").all()) {
      const box = await link.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    }
    if (width === 390)
      await page.screenshot({ path: "/tmp/codehunt-site-shell-mobile.png", fullPage: true })
  })
}

test("unavailable avatar falls back to initials", async ({ page }) => {
  await page.route("**/figma/our-logo.svg", (route) => route.abort())
  await page.goto("/login")
  const avatar = page.getByRole("banner").locator('[data-slot="user-avatar"]')
  await expect(avatar.getByText("GT", { exact: true })).toBeVisible()
})
