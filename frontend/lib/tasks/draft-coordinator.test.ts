import assert from "node:assert/strict"
import { test } from "node:test"
import { DraftCoordinator } from "./draft-coordinator"
import type { DraftPayload } from "../api/tasks"
import { ApiError } from "../api/request"
import type { DraftRead, TaskDetail } from "../api/task-contract"

const makeDraft = (payload: DraftPayload, revision = 1): DraftRead => ({
  id: 1,
  owner_id: 1,
  payload,
  revision,
  created_at: "",
  updated_at: "",
  is_valid: true,
  validation_errors: [],
  photos: [],
  resources: [],
})
const published = { id: 99 } as TaskDetail

test("opening and flushing an untouched new editor does not create a draft", async () => {
  let creates = 0
  const manager = new DraftCoordinator(null, { title: "" }, () => {}, {
    createDraft: async (payload) => {
      creates++
      return makeDraft(payload)
    },
    updateDraft: async (_id, revision, payload) => makeDraft(payload, revision + 1),
    publish: async () => published,
  })
  await manager.flush()
  assert.equal(creates, 0)
  assert.equal(manager.getSnapshot().draft, null)
})

test("parallel autosave and attachment mutations create once and use consecutive revisions", async () => {
  let creates = 0
  const revisions: number[] = []
  const manager = new DraftCoordinator(
    null,
    { title: "" },
    () => {},
    {
      createDraft: async (payload) => {
        creates++
        return makeDraft(payload)
      },
      updateDraft: async (_id, revision, payload) => {
        revisions.push(revision)
        return makeDraft(payload, revision + 1)
      },
      publish: async () => published,
    },
    10000,
  )
  manager.setPayload({ title: "Первое" })
  const first = manager.flush()
  const upload = manager.mutate(async (draft) => {
    revisions.push(draft.revision)
    return { ...draft, revision: draft.revision + 1 }
  })
  await Promise.all([first, upload])
  manager.setPayload({ title: "Последнее" })
  await manager.flush()
  assert.equal(creates, 1)
  assert.deepEqual(revisions, [1, 2])
  assert.equal(manager.getSnapshot().draft?.revision, 3)
  assert.equal(manager.getSnapshot().draft?.payload.title, "Последнее")
  assert.equal(manager.getSnapshot().dirty, false)
})

test("edits during a request are saved before publishing", async () => {
  let release!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const values: DraftPayload[] = []
  let publicationRevision = 0
  const manager = new DraftCoordinator(
    makeDraft({ title: "old" }),
    { title: "old" },
    () => {},
    {
      createDraft: async (payload) => makeDraft(payload),
      updateDraft: async (_id, revision, payload) => {
        values.push(payload)
        if (values.length === 1) await waiting
        return makeDraft(payload, revision + 1)
      },
      publish: async (_id, revision) => {
        publicationRevision = revision
        return published
      },
    },
    10000,
  )
  manager.setPayload({ title: "first" })
  const flush = manager.flush()
  await Promise.resolve()
  manager.setPayload({ title: "latest" })
  const publish = manager.publish()
  release()
  await flush
  await publish
  assert.deepEqual(values, [{ title: "first" }, { title: "latest" }])
  assert.equal(publicationRevision, 3)
})

test("revision conflicts preserve local edits, report immediately and block blind retries", async () => {
  let requests = 0
  const errors: string[] = []
  const manager = new DraftCoordinator(
    makeDraft({ title: "old" }),
    { title: "old" },
    (error) => errors.push(error.message),
    {
      createDraft: async (payload) => makeDraft(payload),
      updateDraft: async () => {
        requests++
        throw new ApiError("Конфликт ревизии", 409, "revision_conflict")
      },
      publish: async () => published,
    },
    10000,
  )
  manager.setPayload({ title: "local" })
  await assert.rejects(manager.flush())
  await assert.rejects(manager.flush())
  assert.equal(requests, 1)
  assert.deepEqual(errors, ["Конфликт ревизии"])
  assert.equal(manager.getSnapshot().dirty, true)
  assert.equal(manager.getSnapshot().conflict, true)
  assert.equal(manager.getSnapshot().draft?.payload.title, "old")
  assert.equal(manager.getSnapshot().pending, 0)
})

test("failed saves can be retried and invalid drafts are not published", async () => {
  let fail = true
  let publishes = 0
  const manager = new DraftCoordinator(
    makeDraft({ title: "old" }),
    { title: "old" },
    () => {},
    {
      createDraft: async (payload) => makeDraft(payload),
      updateDraft: async (_id, revision, payload) => {
        if (fail) throw new Error("Нет сети")
        return {
          ...makeDraft(payload, revision + 1),
          is_valid: false,
          validation_errors: [{ field: "title", code: "missing", message: "Заполните название" }],
        }
      },
      publish: async () => {
        publishes++
        return published
      },
    },
    10000,
  )
  manager.setPayload({ title: "" })
  await assert.rejects(manager.flush())
  fail = false
  await manager.flush()
  await assert.rejects(
    manager.publish(),
    (error) => error instanceof ApiError && error.issues.length === 1,
  )
  assert.equal(publishes, 0)
  assert.equal(manager.getSnapshot().draft?.payload.title, "")
})
