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
  difficultyLevel: "base",
})
const category = (id: string, children: TaskNode[]): TaskCategory => ({
  id,
  title: id,
  kind: "category",
  difficultyLevel: "base",
  children,
})
const ids = (nodes: TaskNode[]) => nodes.map((node) => node.id)

test("grouping and ungrouping preserve contents, sibling order and clear stale selection", () => {
  const nodes = [item("a"), item("b"), item("c")]
  let state = createTaskItemsState(nodes)
  for (const nodeId of ["a", "b"])
    state = reduce(state, {
      type: "toggleSelection",
      difficultyLevel: "base",
      nodeId,
      selected: true,
    })
  state = reduce(state, {
    type: "groupSelection",
    difficultyLevel: "base",
    categoryId: "group",
    title: " Группа ",
  })
  assert.deepEqual(ids(state.nodesByDifficultyLevel.base), ["group", "c"])
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.base, "group")!), ["a", "b"])
  assert.equal(findNode(state.nodesByDifficultyLevel.base, "group")?.title, "Группа")
  assert.equal(countTaskItems(state.nodesByDifficultyLevel.base), 3)
  assert.deepEqual(state.selectedByDifficultyLevel.base, [])
  state = reduce(state, { type: "ungroup", difficultyLevel: "base", categoryId: "group" })
  assert.deepEqual(state.nodesByDifficultyLevel.base, nodes)
})

test("grouping across branches uses their common parent and never duplicates descendants", () => {
  const nodes = [
    category("outer", [category("left", [item("a"), item("b")]), category("right", [item("c")])]),
  ]
  const grouped = groupNodes(nodes, ["a", "c"], "new", "Новая", "base")!
  assert.deepEqual(nodePath(grouped, "a"), ["outer", "new", "a"])
  assert.deepEqual(nodePath(grouped, "c"), ["outer", "new", "c"])
  assert.deepEqual(nodePath(grouped, "b"), ["outer", "left", "b"])
  assert.equal(countTaskItems(grouped), 3)
  assert.deepEqual(ids(selectedRoots(nodes, ["left", "a"])), ["left"])
  assert.equal(countTaskItems(groupNodes(nodes, ["left", "a"], "new", "Новая", "base")!), 3)
  assert.deepEqual(nodePath(nodes, "a"), ["outer", "left", "a"])
})

test("grouping permits three category levels and rejects a fourth", () => {
  const nodes = [category("one", [category("two", [item("a")])])]
  const grouped = groupNodes(nodes, ["a"], "three", "Третья", "base")!
  assert.equal(categoryHeight(grouped[0]), 3)
  assert.equal(groupNodes(grouped, ["a"], "four", "Четвёртая", "base"), null)
  assert.equal(groupNodes(grouped, ["one"], "four", "Четвёртая", "base"), null)
  assert.equal(groupNodes(nodes, [], "new", "Новая", "base"), null)
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
      difficultyLevel: "base",
      nodeId: "one",
      parentCategoryId: "three",
    }),
    state,
  )
  state = reduce(state, {
    type: "relocateNode",
    difficultyLevel: "base",
    nodeId: "c",
    parentCategoryId: "three",
  })
  assert.deepEqual(nodePath(state.nodesByDifficultyLevel.base, "c"), ["one", "two", "three", "c"])
  state = reduce(state, {
    type: "relocateNode",
    difficultyLevel: "base",
    nodeId: "two",
    parentCategoryId: null,
  })
  assert.deepEqual(nodePath(state.nodesByDifficultyLevel.base, "a"), ["two", "three", "a"])
  assert.equal(countTaskItems(state.nodesByDifficultyLevel.base), 3)
})

test("moving a category between difficulties updates all descendants and clears source selection", () => {
  let state = createTaskItemsState([
    category("outer", [category("inner", [item("a")]), item("b")]),
    item("c"),
  ])
  state = reduce(state, {
    type: "toggleSelection",
    difficultyLevel: "base",
    nodeId: "a",
    selected: true,
  })
  state = reduce(state, {
    type: "moveNode",
    difficultyLevel: "base",
    targetDifficultyLevel: "maximum",
    nodeId: "outer",
  })
  assert.deepEqual(ids(state.nodesByDifficultyLevel.base), ["c"])
  for (const id of ["outer", "inner", "a", "b"])
    assert.equal(findNode(state.nodesByDifficultyLevel.maximum, id)?.difficultyLevel, "maximum")
  assert.deepEqual(state.selectedByDifficultyLevel.base, [])
})

test("position and drag ordering affect only siblings and reject invalid replacement lists", () => {
  let state = createTaskItemsState([
    category("outer", [item("a"), category("inner", [item("b")]), item("c")]),
    item("d"),
  ])
  state = reduce(state, {
    type: "movePosition",
    difficultyLevel: "base",
    nodeId: "inner",
    direction: "up",
  })
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.base, "outer")!), [
    "inner",
    "a",
    "c",
  ])
  state = reduce(state, {
    type: "movePosition",
    difficultyLevel: "base",
    nodeId: "inner",
    direction: "down",
  })
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.base, "outer")!), [
    "a",
    "inner",
    "c",
  ])
  state = reduce(state, {
    type: "reorderItems",
    difficultyLevel: "base",
    parentCategoryId: "outer",
    items: [...childrenOf(state.nodesByDifficultyLevel.base, "outer")!].reverse(),
  })
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.base, "outer")!), [
    "c",
    "inner",
    "a",
  ])
  assert.deepEqual(ids(state.nodesByDifficultyLevel.base), ["outer", "d"])
  assert.equal(
    reduce(state, {
      type: "reorderItems",
      difficultyLevel: "base",
      parentCategoryId: "outer",
      items: [item("a")],
    }),
    state,
  )
})

test("nested edit, create and delete keep the parent and do not restore deleted items", () => {
  let state = createTaskItemsState([category("outer", [item("a")])])
  state = reduce(state, { type: "startEditing", difficultyLevel: "base", itemId: "a" })
  state = reduce(state, {
    type: "saveDraft",
    difficultyLevel: "base",
    values: { ...item("a"), title: "Изменён" },
  })
  assert.equal(findNode(state.nodesByDifficultyLevel.base, "a")?.title, "Изменён")
  state = reduce(state, {
    type: "startCreating",
    difficultyLevel: "base",
    itemId: "b",
    parentCategoryId: "outer",
  })
  state = reduce(state, { type: "saveDraft", difficultyLevel: "base", values: item("b") })
  assert.deepEqual(nodePath(state.nodesByDifficultyLevel.base, "b"), ["outer", "b"])
  state = reduce(state, { type: "deleteItem", difficultyLevel: "base", itemId: "a" })
  assert.deepEqual(ids(childrenOf(state.nodesByDifficultyLevel.base, "outer")!), ["b"])
})

test("library import flattens selected leaves in tree order and creates independent ids on every import", () => {
  let id = 0
  const source = taskItemLibrary[0].nodes
  const selected = new Set(["fe-responsive", "fe-keyboard"])
  const first = importLibrarySelection(source, selected, "medium", () => `copy-${++id}`)
  const second = importLibrarySelection(source, selected, "medium", () => `copy-${++id}`)
  assert.equal(countTaskItems(first), 2)
  assert.equal(first.length, 2)
  assert.ok(first.every((node) => !isCategory(node)))
  assert.deepEqual(
    first.map((node) => node.title),
    ["Адаптивная вёрстка", "Управление с клавиатуры"],
  )
  assert.ok(first.every((node) => node.difficultyLevel === "medium"))
  assert.equal(libraryItemIds(source).length, 5)
  const allIds = (nodes: TaskNode[]): Array<string | number> =>
    nodes.flatMap((node) => [node.id, ...(isCategory(node) ? allIds(node.children) : [])])
  assert.equal(new Set([...allIds(first), ...allIds(second)]).size, 4)
  assert.deepEqual(importLibrarySelection(source, new Set(), "base"), [])
  let state = createTaskItemsState([])
  state = reduce(state, { type: "importNodes", difficultyLevel: "medium", nodes: first })
  state = reduce(state, { type: "importNodes", difficultyLevel: "medium", nodes: second })
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
    assert.equal(reduce(state, { type: "importNodes", difficultyLevel: "base", nodes }), state)
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
    difficultyLevel: "base",
    nodeId: "outer",
    direction: "up",
  })
  assert.deepEqual(
    [...taskItemNumbers(state.nodesByDifficultyLevel.base)],
    [
      ["b", 1],
      ["c", 2],
      ["d", 3],
      ["a", 4],
      ["e", 5],
    ],
  )
  state = reduce(state, { type: "ungroup", difficultyLevel: "base", categoryId: "outer" })
  assert.deepEqual(
    [...taskItemNumbers(state.nodesByDifficultyLevel.base)],
    [
      ["b", 1],
      ["c", 2],
      ["d", 3],
      ["a", 4],
      ["e", 5],
    ],
  )
})
