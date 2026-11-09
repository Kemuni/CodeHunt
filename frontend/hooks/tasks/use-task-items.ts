"use client"

import type { TaskNode } from "@/lib/tasks/task-tree"
import { useMemo, useReducer } from "react"
import {
  createTaskItemsState,
  taskItemsReducer,
  type TaskItemsActionPayloads,
} from "@/lib/tasks/task-items-state"

/** Локальное состояние редактора и типизированные операции над пунктами. Ввод и ошибки хранятся в Form; сетевых запросов здесь нет. */
export function useTaskItems(initialItems: TaskNode[]) {
  const [state, dispatch] = useReducer(taskItemsReducer, initialItems, createTaskItemsState)

  // Компоненты вызывают именованные операции
  const actions = useMemo(
    () => ({
      selectDifficultyLevel: (payload: TaskItemsActionPayloads["selectDifficultyLevel"]) =>
        dispatch({ type: "selectDifficultyLevel", ...payload }),
      startCreating: (payload: Omit<TaskItemsActionPayloads["startCreating"], "itemId">) =>
        dispatch({ type: "startCreating", ...payload, itemId: crypto.randomUUID() }),
      startEditing: (payload: TaskItemsActionPayloads["startEditing"]) =>
        dispatch({ type: "startEditing", ...payload }),
      cancelDraft: (payload: TaskItemsActionPayloads["cancelDraft"]) =>
        dispatch({ type: "cancelDraft", ...payload }),
      saveDraft: (payload: TaskItemsActionPayloads["saveDraft"]) =>
        dispatch({ type: "saveDraft", ...payload }),
      deleteItem: (payload: TaskItemsActionPayloads["deleteItem"]) =>
        dispatch({ type: "deleteItem", ...payload }),
      moveNode: (payload: TaskItemsActionPayloads["moveNode"]) =>
        dispatch({ type: "moveNode", ...payload }),
      toggleSelection: (payload: TaskItemsActionPayloads["toggleSelection"]) =>
        dispatch({ type: "toggleSelection", ...payload }),
      clearSelection: (payload: TaskItemsActionPayloads["clearSelection"]) =>
        dispatch({ type: "clearSelection", ...payload }),
      groupSelection: (payload: Omit<TaskItemsActionPayloads["groupSelection"], "categoryId">) =>
        dispatch({ type: "groupSelection", ...payload, categoryId: crypto.randomUUID() }),
      renameCategory: (payload: TaskItemsActionPayloads["renameCategory"]) =>
        dispatch({ type: "renameCategory", ...payload }),
      ungroup: (payload: TaskItemsActionPayloads["ungroup"]) =>
        dispatch({ type: "ungroup", ...payload }),
      movePosition: (payload: TaskItemsActionPayloads["movePosition"]) =>
        dispatch({ type: "movePosition", ...payload }),
      relocateNode: (payload: TaskItemsActionPayloads["relocateNode"]) =>
        dispatch({ type: "relocateNode", ...payload }),
      importNodes: (payload: TaskItemsActionPayloads["importNodes"]) =>
        dispatch({ type: "importNodes", ...payload }),
      reorderItems: (payload: TaskItemsActionPayloads["reorderItems"]) =>
        dispatch({ type: "reorderItems", ...payload }),
    }),
    [],
  )

  return { state, actions }
}

export type TaskItemsActions = ReturnType<typeof useTaskItems>["actions"]
