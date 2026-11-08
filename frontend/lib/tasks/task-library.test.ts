import assert from "node:assert/strict"
import { test } from "node:test"
import type { CategoryLibrary } from "../api/task-contract"
import { libraryParentOptions, libraryTemplates } from "./task-library"
import { POST, GET } from "../../app/api/backend/[...path]/route"

// В ответе API потомок другого направления находится в отдельном дереве.
test("parent choices exclude descendants across developer directions", () => {
  const categories: CategoryLibrary[] = [
    { id: 3, parent_id: 2, title: "Внук", developer_type: "frontend" },
    { id: 2, parent_id: 1, title: "Потомок", developer_type: "fullstack" },
    { id: 1, parent_id: null, title: "Корень", developer_type: "frontend" },
    { id: 4, parent_id: null, title: "Другой корень", developer_type: "frontend" },
  ]
  assert.deepEqual(
    libraryParentOptions(categories, 1).map((item) => item.id),
    [4],
  )
  assert.equal(libraryParentOptions(categories).length, 4)
  assert.deepEqual(libraryTemplates(categories), [])
})

test("proxy adds server-side administrator header to library writes only", async (context) => {
  const requests: { path: string; method: string | undefined; user: string | null }[] = []
  context.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    requests.push({
      path: url.pathname,
      method: init.method,
      user: new Headers(init.headers).get("x-user-id"),
    })
    return Response.json({ success: true, data: null })
  })
  for (const path of ["task-complications", "task-complication-categories"]) {
    const response = await POST(
      new Request(`http://localhost/api/backend/${path}`, {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json", "x-user-id": "999" },
      }),
      { params: Promise.resolve({ path: [path] }) },
    )
    assert.equal(response.status, 200)
  }
  await GET(new Request("http://localhost/api/backend/task-complications/library"), {
    params: Promise.resolve({ path: ["task-complications", "library"] }),
  })
  assert.deepEqual(
    requests.map((request) => request.user),
    [process.env.EDITOR_USER_ID ?? "1", process.env.EDITOR_USER_ID ?? "1", null],
  )
})
