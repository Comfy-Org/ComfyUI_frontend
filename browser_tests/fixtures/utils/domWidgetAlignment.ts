import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

// Direct DOM read of the canvas's position + pan/zoom, unlike the reactive
// Vue-side conversion used to style `.dom-widget` overlays.
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

// Reimplements the projection math instead of importing
// useCanvasPositionConversion, so it can't tautologically agree with prod.
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

function maxRectDeviation(a: ClientRect, b: ClientRect): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height)
  )
}

// The node hasn't moved in canvas space, so re-projecting its previous rect
// through the current transform gives ground truth for where it belongs now.
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
  const widgetHandle = await widgetLocator.elementHandle()
  if (!widgetHandle) {
    throw new Error('Expected locator to have a visible bounding box')
  }
  // Single evaluate() call so both reads land in the same frame -- two
  // separate CDP round trips can straddle a frame boundary and go stale.
  return page.evaluate((widgetEl) => {
    const rect = widgetEl.getBoundingClientRect()
    const canvasEl = window.app!.canvas.canvas
    const canvasRect = canvasEl.getBoundingClientRect()
    const { offset, scale } = window.app!.canvas.ds
    return {
      clientRect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      transform: {
        rectLeft: canvasRect.left,
        rectTop: canvasRect.top,
        offsetX: offset[0],
        offsetY: offset[1],
        scale
      }
    }
  }, widgetHandle)
}

const DEFAULT_ALIGNMENT_TOLERANCE_PX = 2

// expect.poll so ordinary async re-render latency isn't mistaken for
// misalignment -- only a deviation that persists past the timeout fails.
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
    .toBeLessThanOrEqual(tolerancePx)
}

interface RelativeOffset {
  x: number
  y: number
}

// Vue Nodes widgets are plain DOM children of their node (not a
// canvas-position overlay), so CSS keeps them attached on resize for free.
async function relativeOffset(
  nodeLocator: Locator,
  widgetLocator: Locator
): Promise<RelativeOffset> {
  const nodeHandle = await nodeLocator.elementHandle()
  if (!nodeHandle) {
    throw new Error('Expected node locator to have a visible bounding box')
  }
  // Read both rects in a single evaluate() call -- see the comment in
  // `snapshotDomWidget` for why two separate reads risk frame tearing.
  return widgetLocator.evaluate((widgetEl, nodeEl) => {
    const widgetRect = widgetEl.getBoundingClientRect()
    const nodeRect = nodeEl.getBoundingClientRect()
    return { x: widgetRect.x - nodeRect.x, y: widgetRect.y - nodeRect.y }
  }, nodeHandle)
}

export async function snapshotRelativeOffset(
  nodeLocator: Locator,
  widgetLocator: Locator
): Promise<RelativeOffset> {
  return relativeOffset(nodeLocator, widgetLocator)
}

// expect.poll so ordinary async re-render latency isn't mistaken for
// misalignment -- only a deviation that persists past the timeout fails.
export async function expectRelativeOffsetUnchanged(
  nodeLocator: Locator,
  widgetLocator: Locator,
  before: RelativeOffset,
  tolerancePx: number = DEFAULT_ALIGNMENT_TOLERANCE_PX
): Promise<void> {
  await expect
    .poll(
      async () => {
        const after = await relativeOffset(nodeLocator, widgetLocator)
        return Math.max(
          Math.abs(after.x - before.x),
          Math.abs(after.y - before.y)
        )
      },
      {
        message:
          "Vue Nodes widget's position relative to its parent node drifted after resize"
      }
    )
    .toBeLessThanOrEqual(tolerancePx)
}
