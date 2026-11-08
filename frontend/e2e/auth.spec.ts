import { test, expect } from "@playwright/test"
import { sessionCookie } from "./auth-fixture"

test.skip(!process.env.E2E_AUTH_SECRET, "Нужен изолированный backend авторизации")

test("anonymous visitor is redirected to login and cannot forge admin headers", async ({
  page,
}) => {
  await page.goto("/admin/tasks")
  await expect(page).toHaveURL(/\/login\?callbackUrl=/)
  await expect(page.getByRole("button", { name: "Войти через GitHub" })).toBeVisible()
  const response = await page.request.get("/api/backend/editor/tasks/all", {
    headers: { "X-User-ID": "1", Authorization: "Bearer e2e-admin" },
  })
  expect(response.status()).toBe(401)
})

test("member can sign in but cannot access admin pages or API", async ({ page, context }) => {
  await context.addCookies([await sessionCookie("member")])
  await page.goto("/admin/tasks")
  await expect(page.getByRole("heading", { name: "Доступ ограничен" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Админка", exact: true })).toHaveCount(0)
  expect((await page.request.get("/api/backend/editor/tasks/all")).status()).toBe(403)
  const session = await (await page.request.get("/api/auth/session")).json()
  expect(session.user.isAdmin).toBe(false)
  expect(session.backendToken).toBeUndefined()
  expect(JSON.stringify(session)).not.toContain("e2e-member")
})

test("expired session cannot open the editor", async ({ page, context }) => {
  await context.addCookies([await sessionCookie("expired")])
  await page.goto("/admin/tasks/editor")
  await expect(page).toHaveURL(/\/login/)
  expect((await page.request.get("/api/backend/editor/tasks/all")).status()).toBe(401)
})

test("admin session reaches backend and blocks cross-origin writes", async ({ page, context }) => {
  await context.addCookies([await sessionCookie()])
  await page.goto("/admin/tasks")
  await expect(page.getByRole("button", { name: "Создать задачу" })).toBeVisible()
  expect((await page.request.get("/api/backend/editor/tasks/all")).status()).toBe(200)
  expect(
    (
      await page.request.post("/api/backend/editor/tasks", {
        headers: { Origin: "https://evil.test" },
        data: {},
      })
    ).status(),
  ).toBe(403)
})

test("GitHub sign-in starts OAuth with state and PKCE", async ({ page }) => {
  await page.route("https://github.com/login/oauth/authorize**", async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get("client_id")).toBe("e2e-client")
    expect(url.searchParams.get("scope")).toContain("user:email")
    expect(url.searchParams.get("state")).toBeTruthy()
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toBeTruthy()
    await route.fulfill({ body: "GitHub OAuth" })
  })
  await page.goto("/login")
  await page.getByRole("button", { name: "Войти через GitHub" }).click()
  await expect(page).toHaveURL(/^https:\/\/github.com\/login\/oauth\/authorize/)
})

test("sign-out revokes the backend session even if the old cookie is replayed", async ({
  page,
  context,
}) => {
  const cookie = await sessionCookie("member")
  await context.addCookies([cookie])
  await page.goto("/login")
  await page.getByRole("button", { name: "Выйти", exact: true }).click()
  await expect(page).toHaveURL("/")
  expect((await page.request.get("/api/backend/editor/tasks/all")).status()).toBe(401)
  await context.addCookies([cookie])
  expect((await page.request.get("/api/backend/editor/tasks/all")).status()).toBe(401)
})
