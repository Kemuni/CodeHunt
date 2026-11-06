"use client"

import {useMemo, useReducer} from "react";
import {createTaskItemsState, taskItemsReducer, type TaskItem, type TaskItemsActionPayloads} from "./task-items-state";

/** Локальное состояние редактора и типизированные операции над пунктами. Ввод и ошибки хранятся в Form; сетевых запросов здесь нет. */
export function useTaskItems(initialItems: TaskItem[]) {
  const [state, dispatch] = useReducer(taskItemsReducer, initialItems, createTaskItemsState);

  // Компоненты вызывают именованные операции
  const actions = useMemo(() => ({
    selectDifficultyLevel: (payload: TaskItemsActionPayloads["selectDifficultyLevel"]) =>
      dispatch({type: "selectDifficultyLevel", ...payload}),
    startCreating: (payload: Omit<TaskItemsActionPayloads["startCreating"], "itemId">) =>
      dispatch({type: "startCreating", ...payload, itemId: crypto.randomUUID()}),
    startEditing: (payload: TaskItemsActionPayloads["startEditing"]) =>
      dispatch({type: "startEditing", ...payload}),
    cancelDraft: (payload: TaskItemsActionPayloads["cancelDraft"]) =>
      dispatch({type: "cancelDraft", ...payload}),
    saveDraft: (payload: TaskItemsActionPayloads["saveDraft"]) =>
      dispatch({type: "saveDraft", ...payload}),
    deleteItem: (payload: TaskItemsActionPayloads["deleteItem"]) =>
      dispatch({type: "deleteItem", ...payload}),
    moveItem: (payload: TaskItemsActionPayloads["moveItem"]) =>
      dispatch({type: "moveItem", ...payload}),
    reorderItems: (payload: TaskItemsActionPayloads["reorderItems"]) =>
      dispatch({type: "reorderItems", ...payload}),
  }), []);

  return {state, actions};
}

export type TaskItemsActions = ReturnType<typeof useTaskItems>["actions"];
