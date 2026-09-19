import type { Locator, Page } from '@playwright/test'

import { intersection } from '@e2e/fixtures/utils/boundsUtils'

/**
 * Rendered-geometry policy for layout assertions.
 *
 * Node positions are chosen outside the browser, from a model of how LiteGraph draws a
 * node. These read what it actually drew, so a drift between the two is visible to a
 * test.
 */

/**
 * Overlapping node pairs, as `"<idA> and <idB> overlap by WxHpx"`.
 *
 * Sub-pixel rounding in the compositor reports a hairline intersection between boxes
 * that abut exactly, so a pair counts only past one pixel in both axes.
 */
export async function overlappingNodePairs(nodes: Locator): Promise<string[]> {
  const count = await nodes.count()
  const ids = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      nodes.nth(i).getAttribute('data-node-id')
    )
  )

  const found: string[] = []
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const overlap = await intersection(nodes.nth(i), nodes.nth(j))
      if (overlap && overlap.width > 1 && overlap.height > 1) {
        found.push(
          `${ids[i]} and ${ids[j]} overlap by ${Math.round(overlap.width)}x${Math.round(overlap.height)}px`
        )
      }
    }
  }
  return found.sort()
}

export async function nodesWithoutGeometry(nodes: Locator): Promise<string[]> {
  const count = await nodes.count()
  const missing: string[] = []
  for (let i = 0; i < count; i++) {
    const element = nodes.nth(i)
    const [box, id] = await Promise.all([
      element.boundingBox(),
      element.getAttribute('data-node-id')
    ])
    if (!box) missing.push(id ?? `#${i}`)
  }
  return missing.sort()
}

/**
 * Ids of nodes not wholly inside the viewport.
 *
 * Full containment, not mere intersection: a node half off the right edge is exactly
 * the "built outside the user's view" complaint, and an intersection test calls it
 * fine. Nodes with no box are reported too — `boundingBox()` returns null for an
 * element that is not visible, which is its own failure and must not read as "inside".
 */
export async function nodesOutsideViewport(
  page: Page,
  nodes: Locator
): Promise<string[]> {
  const viewport = page.viewportSize()
  if (!viewport)
    throw new Error('no viewport size; this assertion needs a sized page')

  const count = await nodes.count()
  const outside: string[] = []
  for (let i = 0; i < count; i++) {
    const element = nodes.nth(i)
    const [box, id] = await Promise.all([
      element.boundingBox(),
      element.getAttribute('data-node-id')
    ])
    if (
      !box ||
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.width > viewport.width ||
      box.y + box.height > viewport.height
    ) {
      outside.push(id ?? `#${i}`)
    }
  }
  return outside.sort()
}
