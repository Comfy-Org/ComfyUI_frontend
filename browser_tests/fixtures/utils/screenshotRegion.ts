import type { Locator } from '@playwright/test'

import type { Position, Size } from '@e2e/fixtures/types'

type Rect = Position & Size

interface ClientBounded {
  getClientBounding(): Promise<Rect>
}

type RegionTarget = Locator | ClientBounded | Rect | Position

async function clientRectOf(target: RegionTarget): Promise<Rect> {
  if ('getClientBounding' in target) return target.getClientBounding()
  if ('boundingBox' in target) {
    const box = await target.boundingBox()
    if (!box) throw new Error(`Cannot frame a hidden locator: ${target}`)
    return box
  }
  if ('width' in target) return target
  return { ...target, width: 0, height: 0 }
}

/**
 * Page-space `clip` enclosing every target plus `padding` on each side, so a
 * `toHaveScreenshot` captures only the area under test.
 */
export async function screenshotRegion(
  targets: RegionTarget[],
  padding = 24
): Promise<Rect> {
  if (targets.length === 0) throw new Error('No targets to frame')
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
