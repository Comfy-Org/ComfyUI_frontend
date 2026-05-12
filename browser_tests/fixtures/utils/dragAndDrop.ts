import type { Locator } from '@playwright/test'

/**
 * Drag an element from one index to another within a list of locators.
 * Uses mousedown/mousemove/mouseup to trigger the DraggableList library.
 *
 * DraggableList toggles position when the dragged item's center crosses
 * past an idle item's center. To reliably land at the target position,
 * we overshoot slightly past the target's far edge.
 */
export async function dragByIndex(
  items: Locator,
  fromIndex: number,
  toIndex: number
) {
  const fromBox = await items.nth(fromIndex).boundingBox()
  const toBox = await items.nth(toIndex).boundingBox()
  if (!fromBox || !toBox) throw new Error('Item not visible for drag')

  const draggingDown = toIndex > fromIndex
  const targetY = draggingDown
    ? toBox.y + toBox.height * 0.9
    : toBox.y + toBox.height * 0.1

  const page = items.page()
  await page.mouse.move(
    fromBox.x + fromBox.width / 2,
    fromBox.y + fromBox.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(toBox.x + toBox.width / 2, targetY, { steps: 10 })
  await page.mouse.up()
}
