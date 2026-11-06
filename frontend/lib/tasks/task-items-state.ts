import { z } from "zod"
import {
  type TaskNode,
  MAX_CATEGORY_DEPTH,
  isCategory,
  nodeKey,
  findNode,
  nodePath,
  childrenOf,
  updateChildren,
  removeNodes,
  categoryHeight,
  changeDifficulty,
  groupNodes,
  canRelocate,
} from "./task-tree"

export const taskDifficultyLevels = [
  { value: "base", label: "Базовый" },
  { value: "medium", label: "Продвинутый" },
  { value: "maximum", label: "Максимальный" },
] as const

export type TaskDifficultyLevel = (typeof taskDifficultyLevels)[number]["value"]

export const taskItemFieldsSchema = z.object({
  title: z.string().trim().min(1, "Введите название пункта"),
  description: z.string().trim().min(1, "Введите описание пункта"),
  criteria: z.string().trim().min(1, "Введите критерии проверки"),
  required: z.boolean(),
})

export type TaskItemFields = z.infer<typeof taskItemFieldsSchema>

export interface TaskItem extends TaskItemFields {
  complicationId?: number | null
  /** Серверный номер либо временный UUID до первого сохранения. */
  id: string | number
  difficultyLevel: TaskDifficultyLevel
}

/** Снимок пункта при открытии редактора; текущий ввод хранится отдельно в react-hook-form. */
export interface TaskItemDraft {
  item: TaskItem
  isNew: boolean
  parentCategoryId: string | null
}

export interface TaskItemsState {
  activeDifficultyLevel: TaskDifficultyLevel
  nodesByDifficultyLevel: Record<TaskDifficultyLevel, TaskNode[]>
  selectedByDifficultyLevel: Record<TaskDifficultyLevel, string[]>
  draftsByDifficultyLevel: Record<TaskDifficultyLevel, TaskItemDraft | null>
}

// Интерфейс описанных необходимых полей данных для каждой операции
export interface TaskItemsActionPayloads {
  selectDifficultyLevel: { difficultyLevel: TaskDifficultyLevel }
  startCreating: {
    difficultyLevel: TaskDifficultyLevel
    itemId: string
    parentCategoryId?: string | null
  }
  startEditing: {
    difficultyLevel: TaskDifficultyLevel
    itemId: string
  }
  cancelDraft: { difficultyLevel: TaskDifficultyLevel }
  saveDraft: {
    difficultyLevel: TaskDifficultyLevel
    values: TaskItemFields
  }
  deleteItem: {
    difficultyLevel: TaskDifficultyLevel
    itemId: string
  }
  moveNode: {
    difficultyLevel: TaskDifficultyLevel
    targetDifficultyLevel: TaskDifficultyLevel
    nodeId: string
  }
  reorderItems: {
    difficultyLevel: TaskDifficultyLevel
    items: TaskNode[]
    parentCategoryId?: string | null
  }
  toggleSelection: {
    difficultyLevel: TaskDifficultyLevel
    nodeId: string
    selected: boolean
  }
  clearSelection: { difficultyLevel: TaskDifficultyLevel }
  groupSelection: {
    difficultyLevel: TaskDifficultyLevel
    categoryId: string
    title: string
  }
  renameCategory: {
    difficultyLevel: TaskDifficultyLevel
    categoryId: string
    title: string
  }
  ungroup: {
    difficultyLevel: TaskDifficultyLevel
    categoryId: string
  }
  movePosition: {
    difficultyLevel: TaskDifficultyLevel
    nodeId: string
    direction: "up" | "down"
  }
  relocateNode: {
    difficultyLevel: TaskDifficultyLevel
    nodeId: string
    parentCategoryId: string | null
  }
  importNodes: {
    difficultyLevel: TaskDifficultyLevel
    nodes: TaskNode[]
  }
}

export type TaskItemsAction = {
  [Action in keyof TaskItemsActionPayloads]: { type: Action } & TaskItemsActionPayloads[Action]
}[keyof TaskItemsActionPayloads]

export function createTaskItemsState(items: TaskNode[]): TaskItemsState {
  return {
    activeDifficultyLevel: "base",
    nodesByDifficultyLevel: {
      base: items.filter((item) => item.difficultyLevel === "base"),
      medium: items.filter((item) => item.difficultyLevel === "medium"),
      maximum: items.filter((item) => item.difficultyLevel === "maximum"),
    },
    draftsByDifficultyLevel: { base: null, medium: null, maximum: null },
    selectedByDifficultyLevel: { base: [], medium: [], maximum: [] },
  }
}

/** Применяет операции к спискам и сеансам редактирования. При сохранении принимает готовые значения; ошибки полей показывает Form. */
export function taskItemsReducer(state: TaskItemsState, action: TaskItemsAction): TaskItemsState {
  const { difficultyLevel } = action
  const draft = state.draftsByDifficultyLevel[difficultyLevel]
  const items = state.nodesByDifficultyLevel[difficultyLevel]
  const setDraft = (nextDraft: TaskItemDraft | null): TaskItemsState => ({
    ...state,
    draftsByDifficultyLevel: { ...state.draftsByDifficultyLevel, [difficultyLevel]: nextDraft },
  })

  const replaceNodes = (nodes: TaskNode[]): TaskItemsState => ({
    ...state,
    nodesByDifficultyLevel: { ...state.nodesByDifficultyLevel, [difficultyLevel]: nodes },
    selectedByDifficultyLevel: {
      ...state.selectedByDifficultyLevel,
      [difficultyLevel]: state.selectedByDifficultyLevel[difficultyLevel].filter((id) =>
        findNode(nodes, id),
      ),
    },
  })

  switch (action.type) {
    case "selectDifficultyLevel":
      return { ...state, activeDifficultyLevel: difficultyLevel }
    case "startCreating": {
      const parentCategoryId = action.parentCategoryId ?? null
      if (draft || !childrenOf(items, parentCategoryId)) return state
      return setDraft({
        isNew: true,
        parentCategoryId,
        item: {
          id: action.itemId,
          difficultyLevel,
          title: "",
          description: "",
          criteria: "",
          required: true,
        },
      })
    }
    case "startEditing": {
      const item = findNode(items, action.itemId)
      if (draft || !item || isCategory(item)) return state
      return setDraft({
        item: { ...item },
        isNew: false,
        parentCategoryId: nodePath(items, nodeKey(item))?.at(-2) ?? null,
      })
    }
    case "cancelDraft":
      return setDraft(null)
    case "saveDraft": {
      if (!draft) return state
      const result = taskItemFieldsSchema.safeParse(action.values)
      if (!result.success) return state
      const item = { ...draft.item, ...result.data }
      return {
        ...setDraft(null),
        nodesByDifficultyLevel: {
          ...state.nodesByDifficultyLevel,
          [difficultyLevel]: updateChildren(items, draft.parentCategoryId, (children) =>
            draft.isNew
              ? [...children, item]
              : children.map((current) => (nodeKey(current) === nodeKey(item) ? item : current)),
          ),
        },
      }
    }
    case "deleteItem": {
      const node = findNode(items, action.itemId)
      if (!node || isCategory(node)) return state
      return {
        ...replaceNodes(removeNodes(items, new Set([action.itemId]))),
        draftsByDifficultyLevel: {
          ...state.draftsByDifficultyLevel,
          [difficultyLevel]: draft && nodeKey(draft.item) === action.itemId ? null : draft,
        },
      }
    }
    case "moveNode": {
      if (draft || difficultyLevel === action.targetDifficultyLevel) return state
      const node = findNode(items, action.nodeId)
      if (!node) return state
      const next = replaceNodes(removeNodes(items, new Set([nodeKey(node)])))
      return {
        ...next,
        nodesByDifficultyLevel: {
          ...next.nodesByDifficultyLevel,
          [action.targetDifficultyLevel]: [
            ...state.nodesByDifficultyLevel[action.targetDifficultyLevel],
            ...changeDifficulty(
              [node],
              action.targetDifficultyLevel,
              state.nodesByDifficultyLevel[action.targetDifficultyLevel],
            ),
          ],
        },
      }
    }
    case "reorderItems": {
      if (draft) return state
      const parentId = action.parentCategoryId ?? null
      const children = childrenOf(items, parentId)
      const ids = action.items.map((node) => nodeKey(node))
      if (
        !children ||
        ids.length !== children.length ||
        new Set(ids).size !== children.length ||
        ids.some((id) => !children.some((node) => nodeKey(node) === id))
      )
        return state
      return replaceNodes(
        updateChildren(items, parentId, (children) =>
          ids.map((id) => children.find((node) => nodeKey(node) === id)!),
        ),
      )
    }
    case "toggleSelection": {
      if (draft || !findNode(items, action.nodeId)) return state
      const selected = new Set(state.selectedByDifficultyLevel[difficultyLevel])
      if (action.selected) selected.add(action.nodeId)
      else selected.delete(action.nodeId)
      return {
        ...state,
        selectedByDifficultyLevel: {
          ...state.selectedByDifficultyLevel,
          [difficultyLevel]: [...selected],
        },
      }
    }
    case "clearSelection":
      return {
        ...state,
        selectedByDifficultyLevel: { ...state.selectedByDifficultyLevel, [difficultyLevel]: [] },
      }
    case "groupSelection": {
      if (draft) return state
      const nodes = groupNodes(
        items,
        state.selectedByDifficultyLevel[difficultyLevel],
        action.categoryId,
        action.title,
        difficultyLevel,
      )
      if (!nodes) return state
      return {
        ...replaceNodes(nodes),
        selectedByDifficultyLevel: { ...state.selectedByDifficultyLevel, [difficultyLevel]: [] },
      }
    }
    case "renameCategory": {
      const node = findNode(items, action.categoryId)
      if (draft || !node || !isCategory(node) || !action.title.trim()) return state
      const parentId = nodePath(items, nodeKey(node))?.at(-2) ?? null
      return replaceNodes(
        updateChildren(items, parentId, (children) =>
          children.map((child) =>
            nodeKey(child) === nodeKey(node) ? { ...node, title: action.title.trim() } : child,
          ),
        ),
      )
    }
    case "ungroup": {
      const node = findNode(items, action.categoryId)
      if (draft || !node || !isCategory(node)) return state
      const parentId = nodePath(items, nodeKey(node))?.at(-2) ?? null
      return replaceNodes(
        updateChildren(items, parentId, (children) =>
          children.flatMap((child) => (nodeKey(child) === nodeKey(node) ? node.children : [child])),
        ),
      )
    }
    case "movePosition": {
      if (draft) return state
      const path = nodePath(items, action.nodeId)
      if (!path) return state
      const parentId = path.at(-2) ?? null
      return replaceNodes(
        updateChildren(items, parentId, (children) => {
          const next = [...children]
          const index = next.findIndex((node) => nodeKey(node) === action.nodeId)
          const target = index + (action.direction === "up" ? -1 : 1)
          if (target < 0 || target >= next.length) return children
          const movedNode = next[index]
          next[index] = next[target]
          next[target] = movedNode
          return next
        }),
      )
    }
    case "relocateNode": {
      if (draft || !canRelocate(items, action.nodeId, action.parentCategoryId)) return state
      const node = findNode(items, action.nodeId)!
      return replaceNodes(
        updateChildren(
          removeNodes(items, new Set([nodeKey(node)])),
          action.parentCategoryId,
          (children) => [...children, node],
        ),
      )
    }
    case "importNodes": {
      if (draft || action.nodes.some((node) => categoryHeight(node) > MAX_CATEGORY_DEPTH))
        return state
      const ids = new Set<string>()
      const valid = (nodes: TaskNode[]): boolean =>
        nodes.every((node) => {
          if (ids.has(nodeKey(node)) || findNode(items, nodeKey(node))) return false
          ids.add(nodeKey(node))
          return isCategory(node)
            ? !!node.title.trim() && valid(node.children)
            : taskItemFieldsSchema.safeParse(node).success
        })
      if (!valid(action.nodes)) return state
      return replaceNodes([...items, ...changeDifficulty(action.nodes, difficultyLevel)])
    }
  }
}

export function formatItemCount(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  const word =
    lastTwo >= 11 && lastTwo <= 14
      ? "пунктов"
      : last === 1
        ? "пункт"
        : last >= 2 && last <= 4
          ? "пункта"
          : "пунктов"
  return `${count} ${word}`
}
