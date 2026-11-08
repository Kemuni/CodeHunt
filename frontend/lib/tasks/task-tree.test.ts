import { TaskLevel } from "@/lib/tasks/task-level"
import assert from "node:assert/strict"
import { test } from "node:test"
import { createTaskItemsState, taskItemsReducer as reduce, type TaskItem } from "./task-items-state"
import {
  canRelocate,
  categoryHeight,
  childrenOf,
  countTaskItems,
  taskItemNumbers,
  findNode,
  groupNodes,
  isCategory,
  nodePath,
  selectedRoots,
  type TaskCategory,
  type TaskNode,
} from "./task-tree"
import { importLibrarySelection, libraryItemIds, taskItemLibrary } from "./task-item-library-data"

const item = (id: string): TaskItem => ({
  id,
  title: id,
  description: "Описание",
  criteria: "Критерий",
  required: true,
  difficultyLevel: TaskLevel.Easy,
})
const category = (id: string, children: TaskNode[]): TaskCategory => ({
  id,
  title: id,
  kind: "category",
  difficultyLevel: TaskLevel.Easy,
  children,
})
const ids = (nodes: TaskNode[]) => nodes.map((node) => node.id)

test("grouping and ungrouping preserve contents, sibling order and clear stale selection", () => {
  const nodes = [item("a"), item("b"), item("c")]
  let state = createTaskItemsState(nodes)
  for (const nodeId of ["a", "b"])
    state = reduce(state, {
      type: "toggleSelection",
      difficultyLevel: TaskLevel.Easy,
      nodeId,
      selected: true,
    })
  state = reduce(state, {
    type: "groupSelection",
    difficultyLevel: TaskLevel.Easy,
    categoryId: "group",
    title: " Группа ",
  })
  assert.deepEqual(ids(state.nodesByDifficultyLevel.easy), ["group", "c"])
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.easy, "group")!), ["a", "b"])
  assert.equal(findNode(state.nodesByDifficultyLevel.easy, "group")?.title, "Группа")
  assert.equal(countTaskItems(state.nodesByDifficultyLevel.easy), 3)
  assert.deepEqual(state.selectedByDifficultyLevel.easy, [])
  state = reduce(state, { type: "ungroup", difficultyLevel: TaskLevel.Easy, categoryId: "group" })
  assert.deepEqual(state.nodesByDifficultyLevel.easy, nodes)
})

test("grouping across branches uses their common parent and never duplicates descendants", () => {
  const nodes = [
    category("outer", [category("left", [item("a"), item("b")]), category("right", [item("c")])]),
  ]
  const grouped = groupNodes(nodes, ["a", "c"], "new", "Новая", TaskLevel.Easy)!
  assert.deepEqual(nodePath(grouped, "a"), ["outer", "new", "a"])
  assert.deepEqual(nodePath(grouped, "c"), ["outer", "new", "c"])
  assert.deepEqual(nodePath(grouped, "b"), ["outer", "left", "b"])
  assert.equal(countTaskItems(grouped), 3)
  assert.deepEqual(ids(selectedRoots(nodes, ["left", "a"])), ["left"])
  assert.equal(countTaskItems(groupNodes(nodes, ["left", "a"], "new", "Новая", TaskLevel.Easy)!), 3)
  assert.deepEqual(nodePath(nodes, "a"), ["outer", "left", "a"])
})

test("grouping permits three category levels and rejects a fourth", () => {
  const nodes = [category("one", [category("two", [item("a")])])]
  const grouped = groupNodes(nodes, ["a"], "three", "Третья", TaskLevel.Easy)!
  assert.equal(categoryHeight(grouped[0]), 3)
  assert.equal(groupNodes(grouped, ["a"], "four", "Четвёртая", TaskLevel.Easy), null)
  assert.equal(groupNodes(grouped, ["one"], "four", "Четвёртая", TaskLevel.Easy), null)
  assert.equal(groupNodes(nodes, [], "new", "Новая", TaskLevel.Easy), null)
})

test("relocation rejects cycles and excessive depth but allows items within level three", () => {
  const nodes = [
    category("one", [category("two", [category("three", [item("a")])])]),
    category("other", [item("b")]),
    item("c"),
  ]
  assert.equal(canRelocate(nodes, "one", "three"), false)
  assert.equal(canRelocate(nodes, "one", "one"), false)
  assert.equal(canRelocate(nodes, "other", "three"), false)
  assert.equal(canRelocate(nodes, "c", "three"), true)
  let state = createTaskItemsState(nodes)
  assert.equal(
    reduce(state, {
      type: "relocateNode",
      difficultyLevel: TaskLevel.Easy,
      nodeId: "one",
      parentCategoryId: "three",
    }),
    state,
  )
  state = reduce(state, {
    type: "relocateNode",
    difficultyLevel: TaskLevel.Easy,
    nodeId: "c",
    parentCategoryId: "three",
  })
  assert.deepEqual(nodePath(state.nodesByDifficultyLevel.easy, "c"), ["one", "two", "three", "c"])
  state = reduce(state, {
    type: "relocateNode",
    difficultyLevel: TaskLevel.Easy,
    nodeId: "two",
    parentCategoryId: null,
  })
  assert.deepEqual(nodePath(state.nodesByDifficultyLevel.easy, "a"), ["two", "three", "a"])
  assert.equal(countTaskItems(state.nodesByDifficultyLevel.easy), 3)
})

test("moving a category between difficulties updates all descendants and clears source selection", () => {
  let state = createTaskItemsState([
    category("outer", [category("inner", [item("a")]), item("b")]),
    item("c"),
  ])
  state = reduce(state, {
    type: "toggleSelection",
    difficultyLevel: TaskLevel.Easy,
    nodeId: "a",
    selected: true,
  })
  state = reduce(state, {
    type: "moveNode",
    difficultyLevel: TaskLevel.Easy,
    targetDifficultyLevel: TaskLevel.High,
    nodeId: "outer",
  })
  assert.deepEqual(ids(state.nodesByDifficultyLevel.easy), ["c"])
  for (const id of ["outer", "inner", "a", "b"])
    assert.equal(findNode(state.nodesByDifficultyLevel.high, id)?.difficultyLevel, TaskLevel.High)
  assert.deepEqual(state.selectedByDifficultyLevel.easy, [])
})

test("position and drag ordering affect only siblings and reject invalid replacement lists", () => {
  let state = createTaskItemsState([
    category("outer", [item("a"), category("inner", [item("b")]), item("c")]),
    item("d"),
  ])
  state = reduce(state, {
    type: "movePosition",
    difficultyLevel: TaskLevel.Easy,
    nodeId: "inner",
    direction: "up",
  })
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.easy, "outer")!), [
    "inner",
    "a",
    "c",
  ])
  state = reduce(state, {
    type: "movePosition",
    difficultyLevel: TaskLevel.Easy,
    nodeId: "inner",
    direction: "down",
  })
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.easy, "outer")!), [
    "a",
    "inner",
    "c",
  ])
  state = reduce(state, {
    type: "reorderItems",
    difficultyLevel: TaskLevel.Easy,
    parentCategoryId: "outer",
    items: [...childrenOf(state.nodesByDifficultyLevel.easy, "outer")!].reverse(),
  })
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.easy, "outer")!), [
    "c",
    "inner",
    "a",
  ])
  assert.deepEqual(ids(state.nodesByDifficultyLevel.easy), ["outer", "d"])
  assert.equal(
    reduce(state, {
      type: "reorderItems",
      difficultyLevel: TaskLevel.Easy,
      parentCategoryId: "outer",
      items: [item("a")],
    }),
    state,
  )
})

test("nested edit, create and delete keep the parent and do not restore deleted items", () => {
  let state = createTaskItemsState([category("outer", [item("a")])])
  state = reduce(state, { type: "startEditing", difficultyLevel: TaskLevel.Easy, itemId: "a" })
  state = reduce(state, {
    type: "saveDraft",
    difficultyLevel: TaskLevel.Easy,
    values: { ...item("a"), title: "Изменён" },
  })
  assert.equal(findNode(state.nodesByDifficultyLevel.easy, "a")?.title, "Изменён")
  state = reduce(state, {
    type: "startCreating",
    difficultyLevel: TaskLevel.Easy,
    itemId: "b",
    parentCategoryId: "outer",
  })
  state = reduce(state, { type: "saveDraft", difficultyLevel: TaskLevel.Easy, values: item("b") })
  assert.deepEqual(nodePath(state.nodesByDifficultyLevel.easy, "b"), ["outer", "b"])
  state = reduce(state, { type: "deleteItem", difficultyLevel: TaskLevel.Easy, itemId: "a" })
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.easy, "outer")!), ["b"])
})

test("library import flattens selected leaves in tree order and creates independent ids on every import", () => {
  let id = 0
  const source = taskItemLibrary[0].nodes
  const selected = new Set(["fe-responsive", "fe-keyboard"])
  const first = importLibrarySelection(source, selected, TaskLevel.Medium, () => `copy-${++id}`)
  const second = importLibrarySelection(source, selected, TaskLevel.Medium, () => `copy-${++id}`)
  assert.equal(countTaskItems(first), 2)
  assert.equal(first.length, 2)
  assert.ok(first.every((node) => !isCategory(node)))
  assert.deepEqual(
    first.map((node) => node.title),
    ["Адаптивная вёрстка", "Управление с клавиатуры"],
  )
  assert.ok(first.every((node) => node.difficultyLevel === TaskLevel.Medium))
  assert.equal(libraryItemIds(source).length, 5)
  const allIds = (nodes: TaskNode[]): Array<string | number> =>
    nodes.flatMap((node) => [node.id, ...(isCategory(node) ? allIds(node.children) : [])])
  assert.equal(new Set([...allIds(first), ...allIds(second)]).size, 4)
  assert.deepEqual(importLibrarySelection(source, new Set(), TaskLevel.Easy), [])
  let state = createTaskItemsState([])
  state = reduce(state, { type: "importNodes", difficultyLevel: TaskLevel.Medium, nodes: first })
  state = reduce(state, { type: "importNodes", difficultyLevel: TaskLevel.Medium, nodes: second })
  assert.equal(countTaskItems(state.nodesByDifficultyLevel.medium), 4)
})

test("imports reject excessive nesting, duplicate ids and invalid fields", () => {
  const state = createTaskItemsState([item("existing")])
  for (const nodes of [
    [category("one", [category("two", [category("three", [category("four", [item("a")])])])])],
    [item("a"), item("a")],
    [item("existing")],
    [{ ...item("a"), description: " " }],
  ])
    assert.equal(
      reduce(state, { type: "importNodes", difficultyLevel: TaskLevel.Easy, nodes }),
      state,
    )
})

test("item numbers run through nested categories without numbering categories themselves", () => {
  const nodes = [
    item("a"),
    category("outer", [item("b"), category("inner", [item("c"), item("d")])]),
    category("empty", []),
    item("e"),
  ]
  assert.deepEqual(
    [...taskItemNumbers(nodes)],
    [
      ["a", 1],
      ["b", 2],
      ["c", 3],
      ["d", 4],
      ["e", 5],
    ],
  )
  let state = createTaskItemsState(nodes)
  state = reduce(state, {
    type: "movePosition",
    difficultyLevel: TaskLevel.Easy,
    nodeId: "outer",
    direction: "up",
  })
  assert.deepEqual(
    [...taskItemNumbers(state.nodesByDifficultyLevel.easy)],
    [
      ["b", 1],
      ["c", 2],
      ["d", 3],
      ["a", 4],
      ["e", 5],
    ],
  )
  state = reduce(state, { type: "ungroup", difficultyLevel: TaskLevel.Easy, categoryId: "outer" })
  assert.deepEqual(
    [...taskItemNumbers(state.nodesByDifficultyLevel.easy)],
    [
      ["b", 1],
      ["c", 2],
      ["d", 3],
      ["a", 4],
      ["e", 5],
    ],
  )
})
