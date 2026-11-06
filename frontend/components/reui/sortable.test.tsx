import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "react-dom/server"
import { Sortable, SortableItem } from "./sortable"

function Lists() {
  const items = [{ id: "first" }, { id: "second" }]
  return (
    <>
      {["base", "medium", "maximum"].map((level) => (
        <Sortable
          key={level}
          value={items}
          getItemValue={(item) => item.id}
          onValueChange={() => {}}
        >
          {items.map((item) => (
            <SortableItem key={item.id} value={item.id}>
              {item.id}
            </SortableItem>
          ))}
        </Sortable>
      ))}
    </>
  )
}

test("sortable accessibility IDs are stable across server renders and unique per list", () => {
  const getIds = (html: string) =>
    [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1])
  const firstRender = getIds(renderToString(<Lists />))
  renderToString(<Lists />)
  const nextRender = getIds(renderToString(<Lists />))

  assert.equal(firstRender.length, 6)
  assert.equal(new Set(firstRender).size, 3)
  assert.deepEqual(nextRender, firstRender)
})
