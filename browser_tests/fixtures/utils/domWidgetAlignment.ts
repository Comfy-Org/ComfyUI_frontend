import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Fresh (non-reactive) read of the canvas element's on-screen position plus
 * litegraph's current pan/zoom. Unlike the Vue-side position conversion used
 * to style `.dom-widget` overlays, this always reflects the DOM as it is
 * right now.
 */
interface CanvasTransform {
  rectLeft: number
  rectTop: number
  offsetX: number
  offsetY: number
  scale: number
}

interface ClientRect {
  x: number
  y: number
  width: number
  height: number
}

async function captureCanvasTransform(page: Page): Promise<CanvasTransform> {
  return page.evaluate(() => {
    const canvasEl = window.app!.canvas.canvas
    const rect = canvasEl.getBoundingClientRect()
    const { offset, scale } = window.app!.canvas.ds
    return {
      rectLeft: rect.left,
      rectTop: rect.top,
      offsetX: offset[0],
      offsetY: offset[1],
      scale
    }
  })
}

async function boundingClientRectOrThrow(
  locator: Locator
): Promise<ClientRect> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected locator to have a visible bounding box')
  return box
}

/** Converts a client-space (viewport) rect into litegraph canvas-space units. */
function toCanvasSpace(
  rect: ClientRect,
  transform: CanvasTransform
): ClientRect {
  return {
    x: (rect.x - transform.rectLeft) / transform.scale - transform.offsetX,
    y: (rect.y - transform.rectTop) / transform.scale - transform.offsetY,
    width: rect.width / transform.scale,
    height: rect.height / transform.scale
  }
}

/** Converts a litegraph canvas-space rect back into client-space (viewport) units. */
function toClientSpace(
  rect: ClientRect,
  transform: CanvasTransform
): ClientRect {
  return {
    x: (rect.x + transform.offsetX) * transform.scale + transform.rectLeft,
    y: (rect.y + transform.offsetY) * transform.scale + transform.rectTop,
    width: rect.width * transform.scale,
    height: rect.height * transform.scale
  }
}

/**
 * Largest per-axis discrepancy between two client-space rects, in CSS pixels.
 * Used to assert a DOM widget overlay is still visually aligned with the
 * node it belongs to after the canvas transform changes.
 */
function maxRectDeviation(a: ClientRect, b: ClientRect): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height)
  )
}

/**
 * Predicts where a DOM widget overlay should render given its rect under a
 * previous canvas transform and the current one. The widget's node hasn't
 * moved in canvas space, so re-projecting through the live transform gives
 * ground truth for where the overlay belongs right now.
 */
function predictClientRect(
  previousClientRect: ClientRect,
  previousTransform: CanvasTransform,
  currentTransform: CanvasTransform
): ClientRect {
  return toClientSpace(
    toCanvasSpace(previousClientRect, previousTransform),
    currentTransform
  )
}

interface DomWidgetSnapshot {
  clientRect: ClientRect
  transform: CanvasTransform
}

export async function snapshotDomWidget(
  page: Page,
  widgetLocator: Locator
): Promise<DomWidgetSnapshot> {
  const [clientRect, transform] = await Promise.all([
    boundingClientRectOrThrow(widgetLocator),
    captureCanvasTransform(page)
  ])
  return { clientRect, transform }
}

const DEFAULT_ALIGNMENT_TOLERANCE_PX = 2

/**
 * Asserts a DOM widget overlay is still rendered exactly where its node's
 * (unmoved) canvas position projects to under the current canvas transform.
 * `before` should come from `snapshotDomWidget()` taken prior to whatever
 * changed the canvas transform (a resize, pan, or zoom).
 *
 * Uses `expect.poll` so ordinary async re-render latency isn't mistaken for
 * misalignment — only a deviation that persists past the poll timeout fails.
 */
export async function expectDomWidgetAlignedAfterTransformChange(
  page: Page,
  widgetLocator: Locator,
  before: DomWidgetSnapshot,
  tolerancePx: number = DEFAULT_ALIGNMENT_TOLERANCE_PX
): Promise<void> {
  await expect
    .poll(
      async () => {
        const after = await snapshotDomWidget(page, widgetLocator)
        const expectedRect = predictClientRect(
          before.clientRect,
          before.transform,
          after.transform
        )
        return maxRectDeviation(after.clientRect, expectedRect)
      },
      {
        message:
          'DOM widget overlay drifted from the client rect its node position projects to'
      }
    )
    .toBeLessThan(tolerancePx)
}
