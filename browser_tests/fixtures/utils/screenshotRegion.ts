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
  let current = await enclosingRect(targets, padding)
  let previous: Rect | undefined
  await expect
    .poll(
      async () => {
        const sample = await enclosingRect(targets, padding)
        const settled = isEqual(previous, sample)
        previous = current = sample
        return settled
      },
      { intervals: [50], message: 'Screenshot region targets never settled' }
    )
    .toBe(true)
  return current
}

/** Region target enclosing the shown graph's groups, all positionable items, or subgraph IO nodes, measured live on each read. */
export function graphItems(
  page: Page,
  kind: 'groups' | 'all' | 'subgraphIO'
): ClientBounded {
  return {
    getClientBounding: () =>
      page.evaluate((kind) => {
        const app = window.app!
        const graph = app.canvas.graph!
        const items = (() => {
          if (kind === 'groups') return graph.groups
          if (kind === 'all') return [...graph.positionableItems()]
          if (!('inputNode' in graph)) throw new Error('Not in a subgraph')
          return [graph.inputNode, graph.outputNode]
        })()
        if (items.length === 0) throw new Error(`No ${kind} to frame`)
        const rects = items.map((item) => {
          if (!('measure' in item) || item.flags.collapsed)
            return item.boundingRect
          const bounds: [number, number, number, number] = [0, 0, 0, 0]
          item.measure(bounds)
          return bounds
        })
        const [left, top] = app.canvasPosToClientPos([
          Math.min(...rects.map(([x]) => x)),
          Math.min(...rects.map(([, y]) => y))
        ])
        const [right, bottom] = app.canvasPosToClientPos([
          Math.max(...rects.map(([x, , width]) => x + width)),
          Math.max(...rects.map(([, y, , height]) => y + height))
        ])
        return { x: left, y: top, width: right - left, height: bottom - top }
      }, kind)
  }
}
