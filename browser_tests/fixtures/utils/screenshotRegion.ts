import type {
  Locator,
  Page,
  PageAssertionsToHaveScreenshotOptions
} from '@playwright/test'
import { expect } from '@playwright/test'
import { isEqual } from 'es-toolkit'

import type { Position, Size } from '@e2e/fixtures/types'
import { SELECTION_BOUNDS_PADDING } from '@/base/common/selectionBounds'
import type { Rect } from '@/lib/litegraph/src/interfaces'

type PageRect = Position & Size

interface ClientBounded {
  getClientBounding(): Promise<PageRect>
}

type RegionTarget = Locator | ClientBounded | PageRect | Position

async function clientRectOf(target: RegionTarget): Promise<PageRect> {
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
): Promise<PageRect> {
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

export type ScreenshotOptions = Omit<
  PageAssertionsToHaveScreenshotOptions,
  'clip' | 'fullPage'
>

interface RegionOptions {
  padding?: number
}

export interface ScreenshotRegion {
  expectScreenshot(name: string, options?: ScreenshotOptions): Promise<void>
}

/**
 * Measures the area enclosing every target plus `padding` once the targets
 * stop moving, for comparing one area across several screenshots.
 */
export async function screenshotRegion(
  page: Page,
  targets: RegionTarget[],
  { padding = 24 }: RegionOptions = {}
): Promise<ScreenshotRegion> {
  if (targets.length === 0) throw new Error('No targets to frame')
  let clip = await enclosingRect(targets, padding)
  await expect
    .poll(
      async () => {
        const sample = await enclosingRect(targets, padding)
        const settled = isEqual(clip, sample)
        clip = sample
        return settled
      },
      { intervals: [50], message: 'Screenshot region targets never settled' }
    )
    .toBe(true)
  return {
    expectScreenshot: (name, options) =>
      expect(page).toHaveScreenshot(name, { ...options, clip })
  }
}

/** Screenshot assertion of the whole viewport, for tests whose subject is the full app layout. */
export async function expectPageScreenshot(
  page: Page,
  name: string,
  options?: ScreenshotOptions
): Promise<void> {
  await expect(page).toHaveScreenshot(name, options)
}

/** Screenshot assertion limited to one element's box. */
export async function expectElementScreenshot(
  element: Locator,
  name: string,
  options?: ScreenshotOptions
): Promise<void> {
  await expect(element).toHaveScreenshot(name, options)
}

/** Screenshot assertion limited to the area enclosing every target. */
export async function expectRegionScreenshot(
  page: Page,
  targets: RegionTarget[],
  name: string,
  { padding, ...options }: RegionOptions & ScreenshotOptions = {}
): Promise<void> {
  const region = await screenshotRegion(page, targets, { padding })
  await region.expectScreenshot(name, options)
}

/** Region target enclosing the shown graph's groups, all positionable items, subgraph IO nodes, or multi-selection outline, measured live on each read. */
export function graphItems(
  page: Page,
  kind: 'groups' | 'all' | 'subgraphIO' | 'selection'
): ClientBounded {
  return {
    getClientBounding: () =>
      page.evaluate(
        ([kind, selectionPadding]) => {
          const app = window.app!
          const graph = app.canvas.graph!
          const items = (() => {
            if (kind === 'groups') return graph.groups
            if (kind === 'all') return [...graph.positionableItems()]
            if (kind === 'selection') return [...app.canvas.selectedItems]
            if (!('inputNode' in graph)) throw new Error('Not in a subgraph')
            return [graph.inputNode, graph.outputNode]
          })()
          if (items.length === 0) throw new Error(`No ${kind} to frame`)

          const rects = items.map((item) => {
            if (
              kind === 'selection' ||
              !('measure' in item) ||
              item.flags.collapsed
            )
              return item.boundingRect
            const bounds: Rect = [0, 0, 0, 0]
            item.measure(bounds)
            return bounds
          })
          const padding = kind === 'selection' ? selectionPadding : 0

          const [left, top] = app.canvasPosToClientPos([
            Math.min(...rects.map(([x]) => x)) - padding,
            Math.min(...rects.map(([, y]) => y)) - padding
          ])
          const [right, bottom] = app.canvasPosToClientPos([
            Math.max(...rects.map(([x, , width]) => x + width)) + padding,
            Math.max(...rects.map(([, y, , height]) => y + height)) + padding
          ])

          return { x: left, y: top, width: right - left, height: bottom - top }
        },
        [kind, SELECTION_BOUNDS_PADDING] as const
      )
  }
}
