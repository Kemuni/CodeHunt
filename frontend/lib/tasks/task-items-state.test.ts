import { TaskLevel } from "@/lib/tasks/task-level"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createTaskItemsState,
  formatItemCount,
  taskItemsReducer as reduce,
  type TaskItem,
} from "./task-items-state"

const items: TaskItem[] = [
  {
    id: "1",
    difficultyLevel: TaskLevel.Easy,
    title: "Первый",
    description: "Описание",
    criteria: "Критерий",
    required: true,
  },
  {
    id: "2",
    difficultyLevel: TaskLevel.Easy,
    title: "Второй",
    description: "Описание второго",
    criteria: "Критерий второго",
    required: false,
  },
]

test("canceling an edit preserves all saved fields and order", () => {
  const initial = createTaskItemsState(items)
  let state = reduce(initial, {
    type: "startEditing",
    difficultyLevel: TaskLevel.Easy,
    itemId: "1",
  })
  assert.deepEqual(state.nodesByDifficultyLevel, initial.nodesByDifficultyLevel)
  state = reduce(state, { type: "cancelDraft", difficultyLevel: TaskLevel.Easy })
  assert.deepEqual(state, initial)
})

test("saving edits updates every field without replacing the id or position", () => {
  let state = reduce(createTaskItemsState(items), {
    type: "startEditing",
    difficultyLevel: TaskLevel.Easy,
    itemId: "1",
  })
  state = reduce(state, {
    type: "saveDraft",
    difficultyLevel: TaskLevel.Easy,
    values: {
      title: " Новое название ",
      description: " Новое описание ",
      criteria: " Новый критерий ",
      required: false,
    },
  })
  assert.deepEqual(state.nodesByDifficultyLevel.easy[0], {
    id: "1",
    difficultyLevel: TaskLevel.Easy,
    title: "Новое название",
    description: "Новое описание",
    criteria: "Новый критерий",
    required: false,
  })
  assert.equal(state.nodesByDifficultyLevel.easy[1], items[1])
  assert.equal(state.draftsByDifficultyLevel.easy, null)
  assert.equal(items[0].title, "Первый")
})

test("new drafts are not counted until saved and cannot have blank titles", () => {
  let state = reduce(createTaskItemsState(items), {
    type: "startCreating",
    difficultyLevel: TaskLevel.Medium,
    itemId: "new",
  })
  assert.equal(state.nodesByDifficultyLevel.medium.length, 0)
  assert.equal(state.draftsByDifficultyLevel.medium?.item.required, true)
  const emptyValues = { title: "", description: "", criteria: "", required: true }
  assert.equal(
    reduce(state, { type: "saveDraft", difficultyLevel: TaskLevel.Medium, values: emptyValues }),
    state,
  )
  state = reduce(state, {
    type: "saveDraft",
    difficultyLevel: TaskLevel.Medium,
    values: {
      title: "Новый пункт",
      description: "Описание",
      criteria: "Критерии",
      required: true,
    },
  })
  assert.equal(state.nodesByDifficultyLevel.medium.length, 1)
  assert.equal(state.nodesByDifficultyLevel.medium[0].id, "new")
  state = reduce(state, {
    type: "startCreating",
    difficultyLevel: TaskLevel.Medium,
    itemId: "canceled",
  })
  state = reduce(state, { type: "cancelDraft", difficultyLevel: TaskLevel.Medium })
  assert.equal(state.nodesByDifficultyLevel.medium.length, 1)
})

test("drafts survive tab switches and cannot be replaced by another edit", () => {
  let state = reduce(createTaskItemsState(items), {
    type: "startEditing",
    difficultyLevel: TaskLevel.Easy,
    itemId: "1",
  })
  const draft = state.draftsByDifficultyLevel.easy
  state = reduce(state, { type: "selectDifficultyLevel", difficultyLevel: TaskLevel.High })
  state = reduce(state, { type: "startCreating", difficultyLevel: TaskLevel.High, itemId: "new" })
  state = reduce(state, { type: "selectDifficultyLevel", difficultyLevel: TaskLevel.Easy })
  assert.equal(state.draftsByDifficultyLevel.easy, draft)
  assert.equal(
    reduce(state, { type: "startEditing", difficultyLevel: TaskLevel.Easy, itemId: "2" }),
    state,
  )
  assert.ok(state.draftsByDifficultyLevel.high)
})

test("moving preserves optional status, content and destination order without duplicates", () => {
  let state = createTaskItemsState(items)
  state = reduce(state, {
    type: "moveNode",
    difficultyLevel: TaskLevel.Easy,
    targetDifficultyLevel: TaskLevel.High,
    nodeId: "1",
  })
  state = reduce(state, {
    type: "moveNode",
    difficultyLevel: TaskLevel.Easy,
    targetDifficultyLevel: TaskLevel.High,
    nodeId: "2",
  })
  assert.equal(state.nodesByDifficultyLevel.easy.length, 0)
  assert.deepEqual(
    state.nodesByDifficultyLevel.high,
    items.map((item) => ({ ...item, difficultyLevel: TaskLevel.High })),
  )
  assert.equal(
    reduce(state, {
      type: "moveNode",
      difficultyLevel: TaskLevel.Easy,
      targetDifficultyLevel: TaskLevel.High,
      nodeId: "2",
    }),
    state,
  )
  assert.equal(
    reduce(state, {
      type: "moveNode",
      difficultyLevel: TaskLevel.High,
      targetDifficultyLevel: TaskLevel.High,
      nodeId: "2",
    }),
    state,
  )
})

test("sorting affects only its difficulty level and is blocked during an edit", () => {
  let state = createTaskItemsState(items)
  state = reduce(state, {
    type: "reorderItems",
    difficultyLevel: TaskLevel.Easy,
    items: [...items].reverse(),
  })
  assert.deepEqual(
    state.nodesByDifficultyLevel.easy.map((item) => item.id),
    ["2", "1"],
  )
  assert.deepEqual(state.nodesByDifficultyLevel.medium, [])
  state = reduce(state, { type: "startEditing", difficultyLevel: TaskLevel.Easy, itemId: "1" })
  assert.equal(
    reduce(state, { type: "reorderItems", difficultyLevel: TaskLevel.Easy, items }),
    state,
  )
  assert.equal(
    reduce(state, {
      type: "moveNode",
      difficultyLevel: TaskLevel.Easy,
      targetDifficultyLevel: TaskLevel.Medium,
      nodeId: "1",
    }),
    state,
  )
})

test("Russian item counts use correct plural forms", () => {
  for (const [count, label] of [
    [0, "0 пунктов"],
    [1, "1 пункт"],
    [2, "2 пункта"],
    [5, "5 пунктов"],
    [11, "11 пунктов"],
    [14, "14 пунктов"],
    [21, "21 пункт"],
    [22, "22 пункта"],
    [111, "111 пунктов"],
  ] as const)
    assert.equal(formatItemCount(count), label)
})

test("initial items are placed in their own difficulty levels", () => {
  const state = createTaskItemsState([
    items[0],
    { ...items[1], difficultyLevel: TaskLevel.Medium },
    { ...items[0], id: "3", difficultyLevel: TaskLevel.High },
  ])
  assert.deepEqual(
    state.nodesByDifficultyLevel.easy.map((item) => item.id),
    ["1"],
  )
  assert.deepEqual(
    state.nodesByDifficultyLevel.medium.map((item) => item.id),
    ["2"],
  )
  assert.deepEqual(
    state.nodesByDifficultyLevel.high.map((item) => item.id),
    ["3"],
  )
})

test("all three fields reject empty and whitespace-only values on create and edit", () => {
  for (const operation of ["startCreating", "startEditing"] as const) {
    for (const field of ["title", "description", "criteria"] as const) {
      for (const emptyValue of ["", " \n\t "]) {
        let state = reduce(createTaskItemsState(items), {
          type: operation,
          difficultyLevel: TaskLevel.Easy,
          itemId: "1",
        })
        const savedItems = state.nodesByDifficultyLevel.easy
        state = reduce(state, {
          type: "saveDraft",
          difficultyLevel: TaskLevel.Easy,
          values: {
            title: "Название",
            description: "Описание",
            criteria: "Критерии",
            required: false,
            [field]: emptyValue,
          },
        })
        assert.equal(state.nodesByDifficultyLevel.easy, savedItems)
        assert.ok(state.draftsByDifficultyLevel.easy)
      }
    }
  }
})

test("canceling a rejected save preserves the original item", () => {
  const initial = createTaskItemsState(items)
  let state = reduce(initial, {
    type: "startEditing",
    difficultyLevel: TaskLevel.Easy,
    itemId: "1",
  })
  state = reduce(state, {
    type: "saveDraft",
    difficultyLevel: TaskLevel.Easy,
    values: { ...items[0], description: "" },
  })
  state = reduce(state, { type: "cancelDraft", difficultyLevel: TaskLevel.Easy })
  assert.deepEqual(state, initial)
})

test("deletion removes only the selected item and leaves other difficulties intact", () => {
  let state = createTaskItemsState(items)
  state = reduce(state, {
    type: "moveNode",
    difficultyLevel: TaskLevel.Easy,
    targetDifficultyLevel: TaskLevel.High,
    nodeId: "2",
  })
  const high = state.nodesByDifficultyLevel.high
  state = reduce(state, { type: "deleteItem", difficultyLevel: TaskLevel.Easy, itemId: "1" })
  assert.equal(state.nodesByDifficultyLevel.easy.length, 0)
  assert.equal(state.nodesByDifficultyLevel.high, high)
  assert.equal(formatItemCount(state.nodesByDifficultyLevel.easy.length), "0 пунктов")
  const previous = state
  state = reduce(state, { type: "deleteItem", difficultyLevel: TaskLevel.High, itemId: "missing" })
  assert.deepEqual(state, previous)
})

test("deleting an edited item clears its draft so saving cannot restore it", () => {
  let state = reduce(createTaskItemsState(items), {
    type: "startEditing",
    difficultyLevel: TaskLevel.Easy,
    itemId: "1",
  })
  state = reduce(state, { type: "deleteItem", difficultyLevel: TaskLevel.Easy, itemId: "1" })
  assert.equal(state.draftsByDifficultyLevel.easy, null)
  assert.equal(
    reduce(state, { type: "saveDraft", difficultyLevel: TaskLevel.Easy, values: items[0] }),
    state,
  )
  assert.deepEqual(
    state.nodesByDifficultyLevel.easy.map((item) => item.id),
    ["2"],
  )
})
