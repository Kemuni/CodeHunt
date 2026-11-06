import assert from "node:assert/strict"
import { test } from "node:test"
import type { MouseEvent } from "react"
import { shiftSelectionProps } from "./shift-selection"

function click({ shift = true, nested = false, interactive = false } = {}) {
  const currentTarget = {}
  let prevented = false
  let stopped = false
  const event = {
    shiftKey: shift,
    currentTarget,
    target: {
      closest: (selector: string) =>
        selector === "[data-shift-selectable]"
          ? nested
            ? {}
            : currentTarget
          : interactive
            ? {}
            : null,
    },
    preventDefault: () => {
      prevented = true
    },
    stopPropagation: () => {
      stopped = true
    },
  } as unknown as MouseEvent<HTMLElement>
  return { event, prevented: () => prevented, stopped: () => stopped }
}

test("Shift click toggles selection and prevents text selection without changing normal clicks", () => {
  let selected = false
  const props = shiftSelectionProps(() => {
    selected = !selected
  })
  const normal = click({ shift: false })
  props.onMouseDown(normal.event)
  props.onClick(normal.event)
  assert.equal(selected, false)
  assert.equal(normal.prevented(), false)
  const shifted = click()
  props.onMouseDown(shifted.event)
  assert.equal(shifted.prevented(), true)
  props.onClick(shifted.event)
  assert.equal(selected, true)
  assert.equal(shifted.stopped(), true)
  props.onClick(click().event)
  assert.equal(selected, false)
})

test("nested items and interactive controls do not toggle parent selection", () => {
  let calls = 0
  const props = shiftSelectionProps(() => calls++)
  for (const options of [{ nested: true }, { interactive: true }]) {
    const { event, prevented } = click(options)
    props.onMouseDown(event)
    props.onClick(event)
    assert.equal(prevented(), false)
  }
  assert.equal(calls, 0)
})

test("editing or inherited selection disables Shift click", () => {
  let calls = 0
  const props = shiftSelectionProps(() => calls++, true)
  const { event, prevented } = click()
  props.onMouseDown(event)
  props.onClick(event)
  assert.equal(calls, 0)
  assert.equal(prevented(), false)
})
