import type { Locator, Page } from '@playwright/test'

/**
 * Rendered-geometry policy for layout assertions.
 *
 * Node positions are chosen outside the browser, from a model of how LiteGraph draws a
 * node. These read what it actually drew, so a drift between the two is visible to a
 * test.
 */

interface NodeBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  /**
   * False in the cases where `boundingBox()` would have returned null, plus
   * `visibility: hidden`, which reserves a box while drawing nothing.
   */
  drawn: boolean
}

/**
 * Every node's id and rendered box, in one round trip.
 *
 * These helpers run inside `expect.poll`, so their cost is paid on every retry until
 * the layout settles. Measuring a pair at a time costs two `boundingBox()` round trips
 * per pair, which is quadratic in the node count; a ten node graph spends a hundred
 * round trips per poll iteration. That is slow enough to time out the poll, and a poll
 * that times out reports the same assertion failure as a genuine overlap, so the cost
 * is not merely slowness - it lets a slow harness impersonate the defect the assertion
 * is meant to catch.
 */
async function readNodeBoxes(nodes: Locator): Promise<NodeBox[]> {
  return nodes.evaluateAll((elements) =>
    elements.map((element, index) => {
      const rect = element.getBoundingClientRect()
      return {
        id: element.getAttribute('data-node-id') ?? `#${index}`,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        drawn:
          element.getClientRects().length > 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          getComputedStyle(element).visibility !== 'hidden'
      }
    })
  )
}

/**
 * Overlapping node pairs, as `"<idA> and <idB> overlap by WxHpx"`.
 *
 * Sub-pixel rounding in the compositor reports a hairline intersection between boxes
 * that abut exactly, so a pair counts only past one pixel in both axes.
 */
export async function overlappingNodePairs(nodes: Locator): Promise<string[]> {
  const boxes = await readNodeBoxes(nodes)

  const found: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (!a.drawn || !b.drawn) continue

      const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const height =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (width > 1 && height > 1) {
        found.push(
          `${a.id} and ${b.id} overlap by ${Math.round(width)}x${Math.round(height)}px`
        )
      }
    }
  }
  return found.sort()
}

export async function nodesWithoutGeometry(nodes: Locator): Promise<string[]> {
  const boxes = await readNodeBoxes(nodes)
  return boxes
    .filter((box) => !box.drawn)
    .map((box) => box.id)
    .sort()
}

/**
 * Ids of nodes not wholly inside the viewport.
 *
 * Full containment, not mere intersection: a node half off the right edge is exactly
 * the "built outside the user's view" complaint, and an intersection test calls it
 * fine. Nodes with no box are reported too - an element with no layout box is its own
 * failure and must not read as "inside".
 */
export async function nodesOutsideViewport(
  page: Page,
  nodes: Locator
): Promise<string[]> {
  const viewport = page.viewportSize()
  if (!viewport)
    throw new Error('no viewport size; this assertion needs a sized page')

  const boxes = await readNodeBoxes(nodes)
  return boxes
    .filter(
      (box) =>
        !box.drawn ||
        box.x < 0 ||
        box.y < 0 ||
        box.x + box.width > viewport.width ||
        box.y + box.height > viewport.height
    )
    .map((box) => box.id)
    .sort()
}
