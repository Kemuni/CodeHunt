import type { Level } from "@/lib/api/task-contract"

/** Общие подписи уровней для редактора и публичной карточки, без зависимости от схемы формы. */
export const levelLabels: Record<Level, string> = {
  easy: "Базовый",
  medium: "Продвинутый",
  high: "Максимальный",
}
