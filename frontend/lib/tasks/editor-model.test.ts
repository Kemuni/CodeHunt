import { TaskLevel } from "@/lib/tasks/task-level"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  fromComposition,
  fromPresets,
  infoFromTask,
  toComposition,
  toPayload,
  emptyInfo,
  taskInfoSchema,
  infoFromPayload,
  createTaskInfoSchema,
} from "./editor-model"
import type {
  CompositionGroup,
  CompositionLink,
  ComplicationGroupRead,
  ComplicationItem,
  TaskDetail,
} from "../api/task-contract"
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
test("level-specific groups round-trip with empty nested groups and stable IDs", () => {
  const tree: CompositionGroup[] = [
    {
      kind: "group",
      level: TaskLevel.Easy,
      id: 1,
      title: "Базовая",
      items: [leaf(1, TaskLevel.Easy)],
    },
    {
      kind: "group",
      level: TaskLevel.Medium,
      id: 2,
      title: "Продвинутая",
      items: [{ kind: "group", level: TaskLevel.Medium, id: 3, title: "Пустая", items: [] }],
    },
    { kind: "group", level: TaskLevel.High, id: 4, title: "Максимальная", items: [] },
  ]
  const nodes = fromComposition(tree)
  assert.deepEqual(
    nodes.map((node) => node.difficultyLevel),
    [TaskLevel.Easy, TaskLevel.Medium, TaskLevel.High],
  )
  assert.deepEqual(toComposition(nodes), tree)
  assert.ok(nodes.every(isCategory))
})
test("local node ids are never sent as server ids and draft payload keeps unsupported fields for validation", () => {
  const nodes = fromComposition([{ ...leaf(1, TaskLevel.Easy), id: undefined }])
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
    presets: [{ level: TaskLevel.Easy, description: "Базовый" }],
  })
  info.presets.medium.description = ""
  info.presets.high.description = ""
  assert.equal(taskInfoSchema.safeParse(info).success, true)
  assert.deepEqual(toPayload(info, []).presets, [
    { level: TaskLevel.Easy, description: "Базовый", average_days_to_complete: null },
  ])
  info.presets.easy.description = " "
  assert.deepEqual(toPayload(info, []).presets, [])
  assert.equal(createTaskInfoSchema([]).safeParse(info).success, false)
})

test("renaming and nesting a group preserves its identity and level", () => {
  const nodes = fromComposition([
    {
      kind: "group",
      level: TaskLevel.Medium,
      id: 7,
      title: "Группа",
      items: [leaf(2, TaskLevel.Medium)],
    },
  ])
  const renamed = toComposition([{ ...nodes[0], title: "Переименована" }])
  assert.equal(renamed[0].id, 7)
  assert.equal(renamed[0].level, TaskLevel.Medium)
  const relocated = toComposition([
    {
      kind: "category",
      id: "new",
      title: "Новая",
      difficultyLevel: TaskLevel.Medium,
      children: nodes,
    },
  ]) as CompositionGroup[]
  assert.equal(relocated[0].id, undefined)
  assert.equal(relocated[0].level, TaskLevel.Medium)
  assert.equal(relocated[0].items?.[0].id, 7)
})

test("items enable their level, require its description and preserve plain server IDs", () => {
  const nodes = fromComposition([leaf(14, TaskLevel.High)])
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
    { level: TaskLevel.High, description: "", average_days_to_complete: null },
  ])
  const invalid = schema.safeParse(info)
  assert.equal(invalid.success, false)
  if (!invalid.success)
    assert.deepEqual(invalid.error.issues[0].path, ["presets", TaskLevel.High, "description"])
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
    {
      kind: "group",
      level: TaskLevel.Easy,
      id: 1,
      title: "Группа",
      items: [leaf(2, TaskLevel.Easy)],
    },
    leaf(1, TaskLevel.Easy),
  ])
  assert.equal(nodes[0].id, 1)
  assert.equal(nodes[1].id, 1)
  assert.notEqual(nodeKey(nodes[0]), nodeKey(nodes[1]))
  let state = createTaskItemsState(nodes)
  state = taskItemsReducer(state, {
    type: "startEditing",
    difficultyLevel: TaskLevel.Easy,
    itemId: nodeKey(nodes[1]),
  })
  state = taskItemsReducer(state, {
    type: "saveDraft",
    difficultyLevel: TaskLevel.Easy,
    values: { title: "Изменён", description: "Описание", criteria: "Критерий", required: true },
  })
  assert.equal(state.nodesByDifficultyLevel.easy[0].title, "Группа")
  assert.equal(state.nodesByDifficultyLevel.easy[1].title, "Изменён")
  state = taskItemsReducer(state, {
    type: "deleteItem",
    difficultyLevel: TaskLevel.Easy,
    itemId: nodeKey(nodes[1]),
  })
  assert.equal(findNode(state.nodesByDifficultyLevel.easy, nodeKey(nodes[1])), undefined)
  assert.equal(findNode(state.nodesByDifficultyLevel.easy, nodeKey(nodes[0]))?.title, "Группа")
})

test("moving a group between levels updates its descendants and preserves all IDs", async () => {
  const { nodeKey } = await import("./task-tree")
  const { createTaskItemsState, taskItemsReducer } = await import("./task-items-state")
  const nodes = fromComposition([
    {
      kind: "group",
      level: TaskLevel.Easy,
      id: 7,
      title: "Группа",
      items: [leaf(1, TaskLevel.Easy), leaf(2, TaskLevel.Easy)],
    },
  ])
  const state = taskItemsReducer(createTaskItemsState(nodes), {
    type: "moveNode",
    difficultyLevel: TaskLevel.Easy,
    targetDifficultyLevel: TaskLevel.Medium,
    nodeId: nodeKey(nodes[0]),
  })
  assert.equal(state.nodesByDifficultyLevel.easy.length, 0)
  assert.equal(new Set(state.nodesByDifficultyLevel.medium.map(nodeKey)).size, 1)
  const composition = toComposition(state.nodesByDifficultyLevel.medium)
  assert.equal(composition.length, 1)
  assert.equal(composition[0].id, 7)
  assert.equal(composition[0].level, TaskLevel.Medium)
  assert.deepEqual(
    (composition[0] as CompositionGroup).items?.map((item) => [item.id, item.level]),
    [
      [1, TaskLevel.Medium],
      [2, TaskLevel.Medium],
    ],
  )
})

test("nested presets restore fields and all editor branches without inherited duplicates", () => {
  const stamp = "2026-01-01T00:00:00Z"
  const readLeaf = (id: number, level: TaskLevel): ComplicationItem => ({
    ...leaf(id, level),
    order_number: id,
    position: 0,
    id,
    task_id: 1,
    created_at: stamp,
    updated_at: stamp,
  })
  const group = (
    items: ComplicationGroupRead["items"],
    level: TaskLevel = TaskLevel.Easy,
    id = 10,
  ): ComplicationGroupRead => ({
    kind: "group",
    level,
    id,
    task_id: 1,
    parent_group_id: null,
    title: "Общая",
    position: 0,
    created_at: stamp,
    updated_at: stamp,
    items,
  })
  const emptyGroup: ComplicationGroupRead = {
    ...group([]),
    id: 11,
    parent_group_id: 10,
    title: "Пустая",
  }
  const task: TaskDetail = {
    id: 1,
    slug: "task",
    title: "Задача",
    short_description: "Кратко",
    full_description: "Полностью",
    developer_type: "frontend",
    is_hidden: true,
    difficulty_from: 1,
    difficulty_to: 5,
    created_at: stamp,
    updated_at: stamp,
    photos: [],
    resources: [],
    presets: {
      easy: {
        preset: {
          id: 20,
          task_id: 1,
          level: TaskLevel.Easy,
          description: "Базовое описание",
          average_days_to_complete: 3,
          created_at: stamp,
          updated_at: stamp,
        },
        complications: [group([readLeaf(1, TaskLevel.Easy), emptyGroup])],
      },
      medium: { preset: null, complications: [] },
      high: {
        preset: null,
        complications: [group([readLeaf(2, TaskLevel.High)], TaskLevel.High, 12)],
      },
    },
  }
  const info = infoFromTask(task)
  assert.deepEqual(info.presets.easy, { description: "Базовое описание", averageDays: "3" })
  assert.deepEqual(info.presets.medium, { description: "", averageDays: "" })
  const nodes = fromPresets(task.presets)
  assert.deepEqual(
    nodes.map((node) => node.difficultyLevel),
    [TaskLevel.Easy, TaskLevel.High],
  )
  const restored = toComposition(nodes) as CompositionGroup[]
  assert.equal(restored.length, 2)
  assert.equal(restored[0].id, 10)
  assert.deepEqual(
    restored[0].items?.map((node) => node.id),
    [1, 11],
  )
  assert.deepEqual((restored[0].items?.[1] as CompositionGroup).items, [])
  assert.equal(restored[1].level, TaskLevel.High)
  assert.equal(restored[1].items?.[0].id, 2)
})

test("an empty high group survives draft serialization and enables its preset", () => {
  const nodes = fromComposition([
    { kind: "group", level: TaskLevel.High, title: "Пустая", items: [] },
  ])
  const info = structuredClone(emptyInfo)
  const payload = toPayload(info, nodes)
  assert.deepEqual(payload.items, [
    { kind: "group", level: TaskLevel.High, title: "Пустая", items: [] },
  ])
  assert.deepEqual(payload.presets, [
    { level: TaskLevel.High, description: "", average_days_to_complete: null },
  ])
  const restored = fromComposition(payload.items as CompositionGroup[])
  assert.equal(restored[0].difficultyLevel, TaskLevel.High)
  assert.deepEqual(toComposition(restored), payload.items)
})
