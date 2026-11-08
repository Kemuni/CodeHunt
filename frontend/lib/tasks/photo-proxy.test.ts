import assert from "node:assert/strict"
import { test } from "node:test"
import { GET, HEAD } from "../../app/api/backend/[...path]/route"
import { taskMediaUrl, taskPhotoUrl } from "../api/task-media"
import { tasksApi } from "../api/tasks"
import type { PhotoRead } from "../api/task-contract"

test("stable photo URLs and conditional proxy requests preserve public and editor access", async (context) => {
  const photo = { id: 42, url: "/api/media/photos/42" } as PhotoRead
  assert.equal(taskPhotoUrl(photo), "/api/backend/media/photos/42")
  assert.equal(taskPhotoUrl(photo, true), "/api/backend/editor/media/photos/42")
  const seen: { path: string; user: string | null; etag: string | null }[] = []
  context.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    const headers = new Headers(init.headers)
    seen.push({
      path: url.pathname,
      user: headers.get("x-user-id"),
      etag: headers.get("if-none-match"),
    })
    return new Response(null, {
      status: 304,
      headers: { etag: '"image"', "cache-control": "private, no-cache" },
    })
  })
  for (const admin of [false, true]) {
    const path = [...(admin ? ["editor"] : []), "media", "photos", "42"]
    const response = await GET(
      new Request(`http://localhost${taskPhotoUrl(photo, admin)}`, {
        headers: { "If-None-Match": '"image"', "X-User-ID": "999" },
      }),
      { params: Promise.resolve({ path }) },
    )
    assert.equal(response.status, 304)
    assert.equal(response.headers.get("etag"), '"image"')
    assert.equal(response.headers.get("cache-control"), "private, no-cache")
    assert.equal(await response.text(), "")
  }
  assert.deepEqual(
    seen.map((item) => item.user),
    [null, process.env.EDITOR_USER_ID ?? "1"],
  )
  assert.ok(seen.every((item) => item.etag === '"image"'))
  const response = await HEAD(
    new Request("http://localhost/api/backend/media/photos/42", { method: "HEAD" }),
    { params: Promise.resolve({ path: ["media", "photos", "42"] }) },
  )
  assert.equal(response.status, 304)
})

test("resource downloads preserve bytes, filename, cache headers and editor routing", async (context) => {
  const disposition = "attachment; filename*=UTF-8''%D0%A4%D0%B0%D0%B9%D0%BB.zip"
  const seen: { path: string; user: string | null }[] = []
  context.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    seen.push({ path: url.pathname, user: new Headers(init.headers).get("x-user-id") })
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
  for (const admin of [false, true]) {
    const path = [...(admin ? ["editor"] : []), "media", "resources", "42"]
    const url = taskMediaUrl("/api/media/resources/42", admin)
    assert.equal(url, `/api/backend/${path.join("/")}`)
    const response = await GET(new Request(`http://localhost${url}`), {
      params: Promise.resolve({ path }),
    })
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([0, 128, 255]))
    assert.equal(response.headers.get("content-disposition"), disposition)
    assert.equal(response.headers.get("content-type"), "application/zip")
    assert.equal(response.headers.get("content-length"), "3")
    assert.equal(response.headers.get("cache-control"), "private, no-cache")
    assert.equal(response.headers.get("etag"), '"resource"')
  }
  assert.deepEqual(
    seen.map((item) => item.user),
    [null, process.env.EDITOR_USER_ID ?? "1"],
  )
})

test("download-url maps public tasks and editor drafts to the media proxy", async (context) => {
  const requested: string[] = []
  context.mock.method(globalThis, "fetch", async (url: string) => {
    requested.push(url)
    return Response.json({ success: true, data: { url: "/api/media/resources/42" } })
  })
  assert.equal(
    (await tasksApi.resourceUrl("task", 1, 42, false)).url,
    "/api/backend/media/resources/42",
  )
  assert.equal(
    (await tasksApi.resourceUrl("draft", 2, 42)).url,
    "/api/backend/editor/media/resources/42",
  )
  assert.equal(
    (await tasksApi.resourceUrl("task", 3, 42)).url,
    "/api/backend/editor/media/resources/42",
  )
  assert.ok(requested[0].endsWith("/tasks/1/resources/42/download-url"))
  assert.ok(requested[1].endsWith("/editor/task-drafts/2/resources/42/download-url"))
  assert.ok(requested[2].endsWith("/editor/tasks/3/resources/42/download-url"))
})
