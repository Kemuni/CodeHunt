import { TaskLevel } from "@/lib/tasks/task-level"
import type { DeveloperType } from "@/lib/api/task-contract"

/** Общие подписи уровней для редактора и публичной карточки, без зависимости от схемы формы. */
export const levelLabels: Record<TaskLevel, string> = {
  [TaskLevel.Easy]: "Базовый",
  [TaskLevel.Medium]: "Продвинутый",
  [TaskLevel.High]: "Максимальный",
}

export const developerTypeLabels: Record<DeveloperType, string> = {
  frontend: "Фронтенд",
  fullstack: "Фуллстек",
}
