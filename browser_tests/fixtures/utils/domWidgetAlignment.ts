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

/**
 * Intentionally independent from useCanvasPositionConversion -- importing it
 * would make the test tautological (same formula, always agrees with
 * production).
 */

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
  const widgetHandle = await widgetLocator.elementHandle()
  if (!widgetHandle) {
    throw new Error('Expected locator to have a visible bounding box')
  }
  // Read the widget's rect and the canvas transform inside a single
  // page.evaluate() call so both values are captured from the same JS
  // microtask/frame. Two separate CDP round trips -- even fired concurrently
  // via Promise.all -- can straddle an animation frame boundary and end up
  // describing two different moments in time, which would make the
  // predicted rect below latently flaky.
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
    .toBeLessThanOrEqual(tolerancePx)
}

interface RelativeOffset {
  x: number
  y: number
}

/**
 * In Vue Nodes mode a widget is a plain CSS child of its node's own DOM
 * element (not a canvas-position overlay like Classic/LiteGraph's
 * `.dom-widget`), so the browser keeps it visually attached to the node for
 * free whenever the node's transform changes -- checking the widget against
 * the canvas transform (as `expectDomWidgetAlignedAfterTransformChange` does
 * for the overlay case) would always pass by CSS cascade and never actually
 * exercise anything. What *can* regress is the node/widget's position
 * relative to one another, so that's what this measures.
 */
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

/**
 * Snapshot of a Vue Nodes widget's position relative to its parent node
 * element, for use with `expectRelativeOffsetUnchanged`.
 */
export async function snapshotRelativeOffset(
  nodeLocator: Locator,
  widgetLocator: Locator
): Promise<RelativeOffset> {
  return relativeOffset(nodeLocator, widgetLocator)
}

/**
 * Asserts a Vue Nodes widget's position relative to its parent node element
 * hasn't drifted from `before` (a snapshot taken via `snapshotRelativeOffset`
 * prior to whatever changed the node's layout, e.g. a viewport resize).
 *
 * Uses `expect.poll` so ordinary async re-render latency isn't mistaken for
 * misalignment -- only a deviation that persists past the poll timeout fails.
 */
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
