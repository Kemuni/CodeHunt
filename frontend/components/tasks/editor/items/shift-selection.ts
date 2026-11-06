import type { MouseEvent } from "react"

/** Выделяет только ближайший пункт/категорию по Shift + клику, не затрагивая предков, поля формы и кнопки действий. */
export function shiftSelectionProps(toggle: () => void, disabled = false) {
  const matches = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as Element
    return (
      event.shiftKey &&
      !disabled &&
      target.closest("[data-shift-selectable]") === event.currentTarget &&
      !target.closest("button, a, input, textarea, select, label, [contenteditable=true]")
    )
  }
  return {
    "data-shift-selectable": true,
    onMouseDown: (event: MouseEvent<HTMLElement>) => {
      if (matches(event)) event.preventDefault()
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (!matches(event)) return
      event.preventDefault()
      event.stopPropagation()
      toggle()
    },
  }
}
