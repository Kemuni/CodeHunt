import assert from "node:assert/strict"
import { test } from "node:test"
import { proxyBackend } from "../backend-proxy"
import { sessionCookie } from "../../tests/proxy-session"

test("anonymous clients cannot impersonate users with headers", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    const headers = new Headers(init.headers)
    assert.equal(headers.get("authorization"), null)
    assert.equal(headers.get("x-user-id"), null)
    assert.equal(headers.get("cookie"), null)
    return Response.json({ success: false }, { status: 401 })
  })
  const response = await proxyBackend(
    new Request("http://localhost/api/backend/editor/tasks", {
      headers: { Authorization: "Bearer forged", "X-User-ID": "1", Cookie: "x=1" },
    }),
    ["editor", "tasks"],
  )
  assert.equal(response.status, 401)
})

test("mutations require same-origin and auth exchange cannot be proxied", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}))
  for (const origin of [undefined, "https://evil.test", "null"]) {
    const response = await proxyBackend(
      new Request("http://localhost/api/backend/editor/tasks", {
        method: "POST",
        headers: origin ? { Origin: origin } : {},
      }),
      ["editor", "tasks"],
    )
    assert.equal(response.status, 403)
  }
  for (const path of [["auth", "github"], ["..", "auth"], ["editor/tasks"]]) {
    assert.equal(
      (await proxyBackend(new Request("http://localhost/api/backend/auth/github"), path)).status,
      404,
    )
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test("expired or corrupted cookies never authenticate the proxied request", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get("authorization"), null)
    return new Response(null, { status: 401 })
  })
  for (const cookie of [
    await sessionCookie(Date.now() - 1000),
    "next-auth.session-token=invalid",
  ]) {
    const response = await proxyBackend(
      new Request("http://localhost/api/backend/editor/tasks", {
        headers: { Cookie: cookie },
      }),
      ["editor", "tasks"],
    )
    assert.equal(response.status, 401)
  }
})

test("backend outage returns an uncached API error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("connection refused")
  })
  const response = await proxyBackend(new Request("http://localhost/api/backend/tasks"), ["tasks"])
  assert.equal(response.status, 502)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal((await response.json()).errors.code, "backend_unavailable")
})
