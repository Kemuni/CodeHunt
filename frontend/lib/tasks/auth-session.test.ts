import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "../../auth"

const jwt = config.callbacks!.jwt!
const session = config.callbacks!.session!

test("OAuth callback exchanges GitHub token for a server session, without trusting profile roles", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.ok(url.endsWith("/api/auth/github"))
    assert.deepEqual(JSON.parse(String(init.body)), { access_token: "github-token" })
    return Response.json({ data: { token: "backend-token", expires_at: "2099-01-01T00:00:00Z" } })
  })
  const token = await jwt({
    token: {},
    user: { id: "untrusted" },
    account: {
      provider: "github",
      type: "oauth",
      providerAccountId: "42",
      access_token: "github-token",
    },
  })
  assert.equal(token.backendToken, "backend-token")
  assert.ok(!JSON.stringify(token).includes("github-token"))
})

test("browser session uses backend role and never exposes its bearer token", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer backend-token")
    return Response.json({ data: { id: 42, email: "verified@example.test", is_admin: false } })
  })
  const result = await session({
    session: { user: { id: "1", isAdmin: true }, expires: "2099-01-01T00:00:00Z" },
    token: { backendToken: "backend-token", backendExpiresAt: "2099-01-01T00:00:00Z" },
    user: { id: "1", email: "", emailVerified: null },
    newSession: null,
    trigger: "update",
  })
  assert.ok(result.user && "isAdmin" in result.user)
  assert.equal(result.user.isAdmin, false)
  assert.equal(result.user?.email, "verified@example.test")
  assert.ok(!JSON.stringify(result).includes("backend-token"))
})

test("failed backend verification prevents issuing a session", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 403 }))
  await assert.rejects(async () =>
    jwt({
      token: {},
      user: { id: "1" },
      account: {
        provider: "github",
        type: "oauth",
        providerAccountId: "42",
        access_token: "github-token",
      },
    }),
  )
})
