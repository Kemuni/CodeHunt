import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient } from "@tanstack/react-query"
import { invalidateTaskQueries, publicTaskKey } from "./query-keys"

test("task changes invalidate public details by slug, including previous addresses", async () => {
  const client = new QueryClient()
  for (const slug of ["old-address", "new-address"])
    client.setQueryData(publicTaskKey(slug), { id: 1 })
  client.setQueryData(["task-catalog", false], [])
  client.setQueryData(["task-library"], [])
  await invalidateTaskQueries(client)
  assert.equal(client.getQueryState(publicTaskKey("old-address"))?.isInvalidated, true)
  assert.equal(client.getQueryState(publicTaskKey("new-address"))?.isInvalidated, true)
  assert.equal(client.getQueryState(["task-catalog", false])?.isInvalidated, true)
  assert.equal(client.getQueryState(["task-library"])?.isInvalidated, false)
  client.clear()
})
