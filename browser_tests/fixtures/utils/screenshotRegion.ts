import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { isEqual } from 'es-toolkit'

import type { Position, Size } from '@e2e/fixtures/types'

type Rect = Position & Size

interface ClientBounded {
  getClientBounding(): Promise<Rect>
}

type RegionTarget = Locator | ClientBounded | Rect | Position

async function clientRectOf(target: RegionTarget): Promise<Rect> {
  if ('getClientBounding' in target) return target.getClientBounding()
  if ('boundingBox' in target) {
    await target.evaluate((element) =>
      Promise.allSettled(
        element
          .getAnimations()
          .filter(
            ({ effect }) => effect?.getComputedTiming().endTime !== Infinity
          )
          .map(({ finished }) => finished)
      )
    )
    const box = await target.boundingBox()
    if (!box) throw new Error(`Cannot frame a hidden locator: ${target}`)
    return box
  }
  if ('width' in target) return target
  return { ...target, width: 0, height: 0 }
}

async function enclosingRect(
  targets: RegionTarget[],
  padding: number
): Promise<Rect> {
  const rects = await Promise.all(targets.map(clientRectOf))
  const left = Math.floor(Math.min(...rects.map((r) => r.x)) - padding)
  const top = Math.floor(Math.min(...rects.map((r) => r.y)) - padding)
  const right = Math.ceil(
    Math.max(...rects.map((r) => r.x + r.width)) + padding
  )
  const bottom = Math.ceil(
    Math.max(...rects.map((r) => r.y + r.height)) + padding
  )
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Page-space `clip` enclosing every target plus `padding` on each side, so a
 * `toHaveScreenshot` captures only the area under test. Waits until the
 * targets stop moving or resizing.
 */
export async function screenshotRegion(
  targets: RegionTarget[],
  padding = 24
): Promise<Rect> {
  if (targets.length === 0) throw new Error('No targets to frame')
  let previous: Rect | undefined
  let current = await enclosingRect(targets, padding)
  await expect
    .poll(
      async () => {
        previous = current
        current = await enclosingRect(targets, padding)
        return isEqual(previous, current)
      },
      { message: 'Screenshot region targets never settled' }
    )
    .toBe(true)
  return current
}

/** Page-space bounds of the shown graph's groups, all positionable items, or subgraph IO nodes. */
export async function getGraphItemClientRects(
  page: Page,
  kind: 'groups' | 'all' | 'subgraphIO'
): Promise<Rect[]> {
  return page.evaluate((kind) => {
    const app = window.app!
    const graph = app.canvas.graph!
    const items = (() => {
      if (kind === 'groups') return graph.groups
      if (kind === 'all') return [...graph.positionableItems()]
      if (!('inputNode' in graph)) throw new Error('Not in a subgraph')
      return [graph.inputNode, graph.outputNode]
    })()
    return items.map(({ boundingRect: [x, y, width, height] }) => {
      const [left, top] = app.canvasPosToClientPos([x, y])
      const [right, bottom] = app.canvasPosToClientPos([x + width, y + height])
      return { x: left, y: top, width: right - left, height: bottom - top }
    })
  }, kind)
}
