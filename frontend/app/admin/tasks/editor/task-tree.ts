import type { TaskDifficultyLevel, TaskItem } from "./task-items-state"

export const MAX_CATEGORY_DEPTH = 3

export interface TaskCategory {
  kind: "category"
  id: string
  title: string
  difficultyLevel: TaskDifficultyLevel
  children: TaskNode[]
}

export type TaskNode = TaskItem | TaskCategory

export function isCategory(node: TaskNode): node is TaskCategory {
  return "children" in node
}

export function countTaskItems(nodes: TaskNode[]): number {
  return nodes.reduce(
    (count, node) => count + (isCategory(node) ? countTaskItems(node.children) : 1),
    0,
  )
}

/** Сквозные номера пунктов в порядке обхода дерева; категории сами номера не занимают. */
export function taskItemNumbers(nodes: TaskNode[]): Map<string, number> {
  const numbers = new Map<string, number>()
  const visit = (children: TaskNode[]) =>
    children.forEach((node) => {
      if (isCategory(node)) visit(node.children)
      else numbers.set(node.id, numbers.size + 1)
    })
  visit(nodes)
  return numbers
}

export function findNode(nodes: TaskNode[], id: string): TaskNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    if (isCategory(node)) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
}

export function nodePath(
  nodes: TaskNode[],
  id: string,
  parents: string[] = [],
): string[] | undefined {
  for (const node of nodes) {
    if (node.id === id) return [...parents, id]
    if (isCategory(node)) {
      const path = nodePath(node.children, id, [...parents, node.id])
      if (path) return path
    }
  }
}

export function updateChildren(
  nodes: TaskNode[],
  parentId: string | null,
  update: (children: TaskNode[]) => TaskNode[],
): TaskNode[] {
  if (parentId === null) return update(nodes)
  return nodes.map((node) =>
    isCategory(node)
      ? {
          ...node,
          children:
            node.id === parentId
              ? update(node.children)
              : updateChildren(node.children, parentId, update),
        }
      : node,
  )
}

export function childrenOf(nodes: TaskNode[], parentId: string | null): TaskNode[] | undefined {
  if (parentId === null) return nodes
  const parent = findNode(nodes, parentId)
  return parent && isCategory(parent) ? parent.children : undefined
}

export function removeNodes(nodes: TaskNode[], ids: Set<string>): TaskNode[] {
  return nodes
    .filter((node) => !ids.has(node.id))
    .map((node) =>
      isCategory(node) ? { ...node, children: removeNodes(node.children, ids) } : node,
    )
}

export function categoryHeight(node: TaskNode): number {
  return isCategory(node) ? 1 + Math.max(0, ...node.children.map(categoryHeight)) : 0
}

export function changeDifficulty(
  nodes: TaskNode[],
  difficultyLevel: TaskDifficultyLevel,
): TaskNode[] {
  return nodes.map((node) =>
    isCategory(node)
      ? { ...node, difficultyLevel, children: changeDifficulty(node.children, difficultyLevel) }
      : { ...node, difficultyLevel },
  )
}

export function selectedRoots(nodes: TaskNode[], ids: string[]): TaskNode[] {
  const selected = new Set(ids)
  return nodes.flatMap((node) =>
    selected.has(node.id) ? [node] : isCategory(node) ? selectedRoots(node.children, ids) : [],
  )
}

/** Объединяет выделение у общего родителя; потомки выбранной категории не дублируются. */
export function groupNodes(
  nodes: TaskNode[],
  ids: string[],
  categoryId: string,
  title: string,
  difficultyLevel: TaskDifficultyLevel,
): TaskNode[] | null {
  const selected = selectedRoots(nodes, ids)
  if (!selected.length || !title.trim() || findNode(nodes, categoryId)) return null
  const paths = selected.map((node) => nodePath(nodes, node.id)!)
  const commonParents = paths[0].slice(0, -1)
  while (!paths.every((path) => commonParents.every((id, index) => path[index] === id)))
    commonParents.pop()
  if (commonParents.length + 1 + Math.max(...selected.map(categoryHeight)) > MAX_CATEGORY_DEPTH)
    return null
  const parentId = commonParents.at(-1) ?? null
  const siblings = childrenOf(nodes, parentId)!
  const firstBranchId = paths[0][commonParents.length]
  const selectedIds = new Set(selected.map((node) => node.id))
  const index = siblings
    .slice(
      0,
      siblings.findIndex((node) => node.id === firstBranchId),
    )
    .filter((node) => !selectedIds.has(node.id)).length
  const stripped = removeNodes(nodes, selectedIds)
  return updateChildren(stripped, parentId, (children) => {
    const next = [...children]
    next.splice(index, 0, {
      kind: "category",
      id: categoryId,
      title: title.trim(),
      difficultyLevel,
      children: selected,
    })
    return next
  })
}

export function canRelocate(nodes: TaskNode[], nodeId: string, parentId: string | null): boolean {
  const node = findNode(nodes, nodeId)
  const path = nodePath(nodes, nodeId)
  const parentPath = parentId === null ? [] : nodePath(nodes, parentId)
  if (!node || !path || !parentPath || !childrenOf(nodes, parentId)) return false
  if (parentPath.includes(nodeId)) return false
  if ((path.at(-2) ?? null) === parentId) return false
  return parentPath.length + categoryHeight(node) <= MAX_CATEGORY_DEPTH
}

export function categoryDestinations(
  nodes: TaskNode[],
  prefix = "",
): {
  id: string
  label: string
}[] {
  return nodes.flatMap((node) => {
    if (!isCategory(node)) return []
    const label = prefix ? `${prefix} / ${node.title}` : node.title
    return [{ id: node.id, label }, ...categoryDestinations(node.children, label)]
  })
}
