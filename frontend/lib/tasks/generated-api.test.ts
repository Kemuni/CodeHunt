import assert from "node:assert/strict"
import { test } from "node:test"
import { client } from "../api/generated/client.gen"
import { draftMediaApi, taskMediaApi } from "../api/task-media"
import { tasksApi } from "../api/tasks"
import { ApiError } from "../api/request"

test("generated SDK keeps catalog filters, revision queries and multipart fields on the proxy", async (context) => {
  const previousBaseUrl = client.getConfig().baseUrl
  client.setConfig({ baseUrl: "http://localhost/api/backend" })
  context.after(() => client.setConfig({ baseUrl: previousBaseUrl }))
  const requests: Request[] = []
  context.mock.method(globalThis, "fetch", async (request: Request) => {
    requests.push(request)
    return Response.json({ success: true, data: request.method === "DELETE" ? null : {} })
  })

  await tasksApi.list(true, 20, {
    q: "  поиск  ",
    difficulty: [2, 8],
    developerTypes: ["frontend", "fullstack"],
    access: "subscription",
    sort: "difficulty_desc",
  })
  const catalog = new URL(requests[0].url)
  assert.equal(catalog.pathname, "/api/backend/editor/tasks")
  assert.equal(catalog.searchParams.get("q"), "поиск")
  assert.deepEqual(catalog.searchParams.getAll("developer_type"), ["frontend", "fullstack"])
  assert.equal(catalog.searchParams.get("offset"), "20")
  assert.equal(catalog.searchParams.get("difficulty_min"), "2")
  assert.equal(catalog.searchParams.get("difficulty_max"), "8")
  assert.equal(catalog.searchParams.get("access"), "subscription")
  assert.equal(catalog.searchParams.get("sort"), "difficulty_desc")
  assert.equal(requests[0].cache, "no-store")

  await tasksApi.deleteDraft(7, 3)
  assert.equal(requests[1].method, "DELETE")
  assert.equal(new URL(requests[1].url).pathname, "/api/backend/editor/task-drafts/7")
  assert.equal(new URL(requests[1].url).searchParams.get("revision"), "3")

  const first = new File(["first"], "first.png", { type: "image/png" })
  const second = new File(["second"], "second.png", { type: "image/png" })
  await draftMediaApi.uploadPhotos(7, 4, [first, second])
  assert.equal(new URL(requests[2].url).pathname, "/api/backend/editor/task-drafts/7/photos")
  assert.equal(requests[2].headers.get("content-type")?.startsWith("multipart/form-data;"), true)
  const photos = await requests[2].formData()
  assert.equal(photos.get("revision"), "4")
  assert.deepEqual(
    photos.getAll("files").map((file) => (file as File).name),
    ["first.png", "second.png"],
  )

  await taskMediaApi.uploadResource(9, new File(["x"], "spec.txt", { type: "text/plain" }))
  assert.equal(new URL(requests[3].url).pathname, "/api/backend/editor/tasks/9/resources")
  const resource = await requests[3].formData()
  assert.equal(resource.get("title"), "spec.txt")
  assert.equal(resource.get("type"), "other")
  assert.equal((resource.get("file") as File).name, "spec.txt")
})

test("generated SDK errors retain HTTP status and backend code", async (context) => {
  const previousBaseUrl = client.getConfig().baseUrl
  client.setConfig({ baseUrl: "http://localhost/api/backend" })
  context.after(() => client.setConfig({ baseUrl: previousBaseUrl }))
  context.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { success: false, errors: { code: "draft_revision_conflict", message: "Конфликт ревизии" } },
      { status: 409 },
    ),
  )
  await assert.rejects(
    tasksApi.deleteDraft(7, 3),
    (error: unknown) =>
      error instanceof ApiError && error.status === 409 && error.code === "draft_revision_conflict",
  )
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({
      success: false,
      errors: { code: "invalid_state", message: "Неверное состояние" },
    }),
  )
  await assert.rejects(
    tasksApi.deleteDraft(7, 3),
    (error: unknown) =>
      error instanceof ApiError && error.status === 200 && error.code === "invalid_state",
  )
})
