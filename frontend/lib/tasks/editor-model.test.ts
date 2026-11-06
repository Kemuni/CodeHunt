import assert from "node:assert/strict"
import { test } from "node:test"
import {
  fromComposition,
  toComposition,
  toPayload,
  emptyInfo,
  taskInfoSchema,
  infoFromPayload,
  createTaskInfoSchema,
} from "./editor-model"
import type { CompositionGroup, CompositionLink } from "../api/task-contract"
import { isCategory } from "./task-tree"

const leaf = (id: number, level: CompositionLink["level"]): CompositionLink => ({
  kind: "complication",
  id,
  title: `Пункт ${id}`,
  description: "Описание",
  acceptance_criteria: "Критерий",
  level,
  is_required: true,
  complication_id: null,
})
test("mixed-level backend categories round-trip without duplicate IDs or lost children", () => {
  const tree: CompositionGroup[] = [
    {
      kind: "group",
      id: 1,
      title: "Общая категория",
      items: [
        leaf(1, "easy"),
        { kind: "group", id: 2, title: "Вложенная", items: [leaf(2, "medium"), leaf(3, "high")] },
      ],
    },
  ]
  const nodes = fromComposition(tree)
  assert.equal(nodes.length, 3)
  assert.deepEqual(toComposition(nodes), tree)
  assert.ok(nodes.every(isCategory))
})
test("local node ids are never sent as server ids and draft payload keeps unsupported fields for validation", () => {
  const nodes = fromComposition([{ ...leaf(1, "easy"), id: undefined }])
  const result = toComposition(nodes)
  assert.equal(result[0].id, undefined)
  const payload = toPayload(emptyInfo, nodes, { parent_task_id: 42 })
  assert.equal(payload.parent_task_id, 42)
  assert.equal(payload.developer_type, null)
  assert.equal(taskInfoSchema.safeParse(emptyInfo).success, false)
  assert.ok(!("isFree" in payload))
})

test("empty levels are excluded and descriptions alone enable a level", () => {
  const info = infoFromPayload({
    title: "Задача",
    slug: "test",
    short_description: "Кратко",
    full_description: "Полностью",
    developer_type: "frontend",
    presets: [{ level: "easy", description: "Базовый" }],
  })
  info.presets.medium.description = ""
  info.presets.high.description = ""
  assert.equal(taskInfoSchema.safeParse(info).success, true)
  assert.deepEqual(toPayload(info, []).presets, [
    { level: "easy", description: "Базовый", average_days_to_complete: null },
  ])
  info.presets.easy.description = " "
  assert.deepEqual(toPayload(info, []).presets, [])
  assert.equal(createTaskInfoSchema([]).safeParse(info).success, false)
})

test("renamed or relocated projections split a shared category without duplicate server IDs", () => {
  const nodes = fromComposition([
    { kind: "group", id: 7, title: "Общая", items: [leaf(1, "easy"), leaf(2, "medium")] },
  ])
  const renamed = toComposition([nodes[0], { ...nodes[1], title: "Переименована" }])
  assert.equal(renamed.length, 2)
  assert.equal(renamed[0].id, 7)
  assert.equal(renamed[1].id, undefined)
  const relocated = toComposition([
    nodes[0],
    {
      kind: "category",
      id: "new",
      title: "Новая",
      difficultyLevel: "medium",
      children: [nodes[1]],
    },
  ])
  const parent = relocated[1] as CompositionGroup
  assert.equal(parent.items?.[0].id, undefined)
  assert.equal((parent.items?.[0] as CompositionGroup).items?.[0].id, 2)
})

test("items enable their level, require its description and preserve plain server IDs", () => {
  const nodes = fromComposition([leaf(14, "high")])
  assert.equal(nodes[0].id, 14)
  assert.equal("apiId" in nodes[0], false)
  assert.equal(toComposition(nodes)[0].id, 14)
  const info = infoFromPayload({
    title: "Задача",
    slug: "task",
    short_description: "Кратко",
    full_description: "Полностью",
    developer_type: "frontend",
    presets: [],
  })
  const schema = createTaskInfoSchema(nodes)
  assert.deepEqual(toPayload(info, nodes).presets, [
    { level: "high", description: "", average_days_to_complete: null },
  ])
  const invalid = schema.safeParse(info)
  assert.equal(invalid.success, false)
  if (!invalid.success)
    assert.deepEqual(invalid.error.issues[0].path, ["presets", "high", "description"])
  info.presets.high.description = "Результат"
  info.presets.high.averageDays = "5"
  assert.equal(schema.safeParse(info).success, true)
  info.presets.high.averageDays = "1.5"
  assert.equal(schema.safeParse(info).success, false)
  info.presets.high.description = ""
  assert.deepEqual(toPayload(info, []).presets, [])
})

test("equal numeric IDs of an item and category never collide in tree operations", async () => {
  const { nodeKey, findNode } = await import("./task-tree")
  const { createTaskItemsState, taskItemsReducer } = await import("./task-items-state")
  const nodes = fromComposition([
    { kind: "group", id: 1, title: "Группа", items: [leaf(2, "easy")] },
    leaf(1, "easy"),
  ])
  assert.equal(nodes[0].id, 1)
  assert.equal(nodes[1].id, 1)
  assert.notEqual(nodeKey(nodes[0]), nodeKey(nodes[1]))
  let state = createTaskItemsState(nodes)
  state = taskItemsReducer(state, {
    type: "startEditing",
    difficultyLevel: "base",
    itemId: nodeKey(nodes[1]),
  })
  state = taskItemsReducer(state, {
    type: "saveDraft",
    difficultyLevel: "base",
    values: { title: "Изменён", description: "Описание", criteria: "Критерий", required: true },
  })
  assert.equal(state.nodesByDifficultyLevel.base[0].title, "Группа")
  assert.equal(state.nodesByDifficultyLevel.base[1].title, "Изменён")
  state = taskItemsReducer(state, {
    type: "deleteItem",
    difficultyLevel: "base",
    itemId: nodeKey(nodes[1]),
  })
  assert.equal(findNode(state.nodesByDifficultyLevel.base, nodeKey(nodes[1])), undefined)
  assert.equal(findNode(state.nodesByDifficultyLevel.base, nodeKey(nodes[0]))?.title, "Группа")
})

test("moving a shared group projection into another level creates a distinct group", async () => {
  const { nodeKey } = await import("./task-tree")
  const { createTaskItemsState, taskItemsReducer } = await import("./task-items-state")
  const nodes = fromComposition([
    { kind: "group", id: 7, title: "Общая", items: [leaf(1, "easy"), leaf(2, "medium")] },
  ])
  const state = taskItemsReducer(createTaskItemsState(nodes), {
    type: "moveNode",
    difficultyLevel: "base",
    targetDifficultyLevel: "medium",
    nodeId: nodeKey(nodes[0]),
  })
  assert.equal(state.nodesByDifficultyLevel.base.length, 0)
  assert.equal(new Set(state.nodesByDifficultyLevel.medium.map(nodeKey)).size, 2)
  const composition = toComposition(state.nodesByDifficultyLevel.medium)
  assert.equal(composition.length, 2)
  assert.equal(composition[0].id, 7)
  assert.equal(composition[1].id, undefined)
})
