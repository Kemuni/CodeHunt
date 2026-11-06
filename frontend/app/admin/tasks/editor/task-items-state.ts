import {z} from "zod";

export const taskDifficultyLevels = [
  { value: "base", label: "Базовый" },
  { value: "medium", label: "Продвинутый" },
  { value: "maximum", label: "Максимум" },
] as const;

export type TaskDifficultyLevel = typeof taskDifficultyLevels[number]["value"];

export const taskItemFieldsSchema = z.object({
  title: z.string().trim().min(1, "Введите название пункта"),
  description: z.string().trim().min(1, "Введите описание пункта"),
  criteria: z.string().trim().min(1, "Введите критерии проверки"),
  required: z.boolean(),
});

export type TaskItemFields = z.infer<typeof taskItemFieldsSchema>;

export interface TaskItem extends TaskItemFields {
  id: string;
  difficultyLevel: TaskDifficultyLevel;
}

export interface TaskItemDraft {
  item: TaskItem;
  isNew: boolean;
}

export interface TaskItemsState {
  activeDifficultyLevel: TaskDifficultyLevel;
  itemsByDifficultyLevel: Record<TaskDifficultyLevel, TaskItem[]>;
  draftsByDifficultyLevel: Record<TaskDifficultyLevel, TaskItemDraft | null>;
}

// Each operation declares exactly which fields it needs.
export interface TaskItemsActionPayloads {
  selectDifficultyLevel: { difficultyLevel: TaskDifficultyLevel };
  startCreating: { difficultyLevel: TaskDifficultyLevel; itemId: string };
  startEditing: { difficultyLevel: TaskDifficultyLevel; itemId: string };
  cancelDraft: { difficultyLevel: TaskDifficultyLevel };
  saveDraft: { difficultyLevel: TaskDifficultyLevel; values: TaskItemFields };
  deleteItem: { difficultyLevel: TaskDifficultyLevel; itemId: string };
  moveItem: { difficultyLevel: TaskDifficultyLevel; targetDifficultyLevel: TaskDifficultyLevel; itemId: string };
  reorderItems: { difficultyLevel: TaskDifficultyLevel; items: TaskItem[] };
}

export type TaskItemsAction = {
  [Action in keyof TaskItemsActionPayloads]: { type: Action } & TaskItemsActionPayloads[Action];
}[keyof TaskItemsActionPayloads];

export function createTaskItemsState(items: TaskItem[]): TaskItemsState {
  return {
    activeDifficultyLevel: "base",
    itemsByDifficultyLevel: {
      base: items.filter((item) => item.difficultyLevel === "base"),
      medium: items.filter((item) => item.difficultyLevel === "medium"),
      maximum: items.filter((item) => item.difficultyLevel === "maximum"),
    },
    draftsByDifficultyLevel: { base: null, medium: null, maximum: null },
  };
}

export function taskItemsReducer(state: TaskItemsState, action: TaskItemsAction): TaskItemsState {
  const {difficultyLevel} = action;
  const draft = state.draftsByDifficultyLevel[difficultyLevel];
  const items = state.itemsByDifficultyLevel[difficultyLevel];
  const setDraft = (nextDraft: TaskItemDraft | null): TaskItemsState => ({
    ...state,
    draftsByDifficultyLevel: {...state.draftsByDifficultyLevel, [difficultyLevel]: nextDraft},
  });

  switch (action.type) {
    case "selectDifficultyLevel":
      return {...state, activeDifficultyLevel: difficultyLevel};
    case "startCreating":
      if (draft) return state;
      return setDraft({
        isNew: true,
        item: {id: action.itemId, difficultyLevel, title: "", description: "", criteria: "", required: true},
      });
    case "startEditing": {
      const item = items.find((item) => item.id === action.itemId);
      if (draft || !item) return state;
      return setDraft({item: {...item}, isNew: false});
    }
    case "cancelDraft":
      return setDraft(null);
    case "saveDraft": {
      if (!draft) return state;
      const result = taskItemFieldsSchema.safeParse(action.values);
      if (!result.success) return state;
      const item = {...draft.item, ...result.data};
      return {
        ...setDraft(null),
        itemsByDifficultyLevel: {
          ...state.itemsByDifficultyLevel,
          [difficultyLevel]: draft.isNew
            ? [...items, item]
            : items.map((current) => current.id === item.id ? item : current),
        },
      };
    }
    case "deleteItem":
      return {
        ...setDraft(draft?.item.id === action.itemId ? null : draft),
        itemsByDifficultyLevel: {
          ...state.itemsByDifficultyLevel,
          [difficultyLevel]: items.filter((item) => item.id !== action.itemId),
        },
      };
    case "moveItem": {
      if (draft || difficultyLevel === action.targetDifficultyLevel) return state;
      const item = items.find((item) => item.id === action.itemId);
      if (!item) return state;
      return {...state, itemsByDifficultyLevel: {
        ...state.itemsByDifficultyLevel,
        [difficultyLevel]: items.filter((item) => item.id !== action.itemId),
        [action.targetDifficultyLevel]: [
          ...state.itemsByDifficultyLevel[action.targetDifficultyLevel],
          {...item, difficultyLevel: action.targetDifficultyLevel},
        ],
      }};
    }
    case "reorderItems":
      if (draft) return state;
      return {...state, itemsByDifficultyLevel: {...state.itemsByDifficultyLevel, [difficultyLevel]: action.items}};
  }
}

export function formatItemCount(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? "пунктов"
    : last === 1 ? "пункт" : last >= 2 && last <= 4 ? "пункта" : "пунктов";
  return `${count} ${word}`;
}
