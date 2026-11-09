import assert from "node:assert/strict"
import { test } from "node:test"
import { proxyBackend } from "../backend-proxy"
import { sessionCookie } from "../../tests/proxy-session"
import { taskMediaUrl, taskPhotoUrl } from "../api/task-media"
import type { PhotoRead } from "../api/task-contract"

test("stable photo URLs and conditional proxy requests preserve public and editor access", async (context) => {
  const photo = { id: 42, url: "/api/media/photos/42" } as PhotoRead
  assert.equal(taskPhotoUrl(photo), "/api/backend/media/photos/42")
  const seen: { path: string; user: string | null; etag: string | null }[] = []
  context.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    const headers = new Headers(init.headers)
    seen.push({
      path: url.pathname,
      user: headers.get("authorization"),
      etag: headers.get("if-none-match"),
    })
    return new Response(null, {
      status: 304,
      headers: { etag: '"image"', "cache-control": "private, no-cache" },
    })
  })
  for (const signedIn of [false, true]) {
    const path = ["media", "photos", "42"]
    const response = await proxyBackend(
      new Request(`http://localhost${taskPhotoUrl(photo)}`, {
        headers: {
          "If-None-Match": '"image"',
          "X-User-ID": "999",
          Cookie: signedIn ? await sessionCookie() : "",
        },
      }),
      path,
    )
    assert.equal(response.status, 304)
    assert.equal(response.headers.get("etag"), '"image"')
    assert.equal(response.headers.get("cache-control"), "private, no-cache")
    assert.equal(await response.text(), "")
  }
  assert.deepEqual(
    seen.map((item) => item.user),
    [null, "Bearer session-token"],
  )
  assert.ok(seen.every((item) => item.etag === '"image"'))
  const response = await proxyBackend(
    new Request("http://localhost/api/backend/media/photos/42", { method: "HEAD" }),
    ["media", "photos", "42"],
  )
  assert.equal(response.status, 304)
})

test("resource downloads preserve bytes, filename, cache headers and editor routing", async (context) => {
  const disposition = "attachment; filename*=UTF-8''%D0%A4%D0%B0%D0%B9%D0%BB.zip"
  const seen: { path: string; user: string | null }[] = []
  context.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    seen.push({ path: url.pathname, user: new Headers(init.headers).get("authorization") })
    return new Response(new Uint8Array([0, 128, 255]), {
      headers: {
        "content-type": "application/zip",
        "content-length": "3",
        "content-disposition": disposition,
        "cache-control": "private, no-cache",
        etag: '"resource"',
      },
    })
  })
  for (const signedIn of [false, true]) {
    const path = ["media", "resources", "42"]
    const url = taskMediaUrl("/api/media/resources/42")
    assert.equal(url, `/api/backend/${path.join("/")}`)
    const response = await proxyBackend(
      new Request(`http://localhost${url}`, {
        headers: { Cookie: signedIn ? await sessionCookie() : "" },
      }),
      path,
    )
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([0, 128, 255]))
    assert.equal(response.headers.get("content-disposition"), disposition)
    assert.equal(response.headers.get("content-type"), "application/zip")
    assert.equal(response.headers.get("content-length"), "3")
    assert.equal(response.headers.get("cache-control"), "private, no-cache")
    assert.equal(response.headers.get("etag"), '"resource"')
  }
  assert.deepEqual(
    seen.map((item) => item.user),
    [null, "Bearer session-token"],
  )
})

test("media URLs are taken directly from the response without an extra request", () => {
  assert.equal(taskMediaUrl("/api/media/resources/42"), "/api/backend/media/resources/42")
})
