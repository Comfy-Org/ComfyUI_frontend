interface CanvasViewport {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly dpr: number
  readonly physicalWidth: number
  readonly physicalHeight: number
}

interface CanvasViewportConsumer {
  dpr: number
  ds: { setViewportSize(width: number, height: number): void }
}

const appliedViewportByCanvas = new WeakMap<HTMLCanvasElement, CanvasViewport>()
const autoSizedStyleByCanvas = new WeakMap<
  HTMLCanvasElement,
  { width?: string; height?: string }
>()
/**
 * DPR the 2D context transform of each canvas was last scaled by. Assigning
 * `width` or `height` resets a 2D context to the identity transform, so this
 * is the only reliable record of whether the DPR transform is still applied.
 */
const appliedContextDprByCanvas = new WeakMap<HTMLCanvasElement, number>()

/**
 * Forget the DPR transform recorded for a canvas, because something assigned
 * its backing-store dimensions and so reset its 2D context.
 */
function invalidateCanvasContextTransform(canvas: HTMLCanvasElement): void {
  appliedContextDprByCanvas.delete(canvas)
}

/**
 * Pin the canvas's CSS box to its logical size, so layout follows the logical
 * viewport rather than the DPR-scaled backing store. Applies to both the
 * parent-derived fallback size and an explicit `resize(width, height)`;
 * declines when the caller or a stylesheet already owns the box.
 */
function applyLogicalCanvasStyle(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
  // A degenerate measurement is never worth pinning: a 0x0 parent measured
  // during mount would freeze the canvas at zero inline pixels, and the
  // caller's own sizing would have been correct all along.
  if (!(width > 0) || !(height > 0)) return

  // CSS already laying the canvas out at exactly this size means a class or
  // stylesheet rule owns the box (the app canvas is `absolute inset-0
  // size-full`). Inline pixels would replace a live rule with a snapshot and
  // stop the canvas following its parent.
  const rect = canvas.getBoundingClientRect()
  if (
    Math.abs(rect.width - width) < 1 &&
    Math.abs(rect.height - height) < 1 &&
    rect.width > 0 &&
    rect.height > 0
  )
    return

  const { style } = canvas
  const previousStyle = autoSizedStyleByCanvas.get(canvas) ?? {}
  const nextStyle: { width?: string; height?: string } = {}
  if (!style.width || style.width === previousStyle.width) {
    style.width = `${width}px`
    nextStyle.width = style.width
  }
  if (!style.height || style.height === previousStyle.height) {
    style.height = `${height}px`
    nextStyle.height = style.height
  }
  autoSizedStyleByCanvas.set(canvas, nextStyle)
}

function normalizeDpr(rawDpr: number): number {
  return rawDpr > 0 && Number.isFinite(rawDpr) ? Math.max(rawDpr, 1) : 1
}

function readBrowserDpr(): number {
  return typeof window === 'undefined'
    ? 1
    : normalizeDpr(window.devicePixelRatio)
}

function measureViewport(
  cssWidth: number,
  cssHeight: number,
  rawDpr: number
): CanvasViewport {
  // Keep at least one backing pixel per CSS pixel. DPR values below one are
  // valid browser inputs, but using them directly makes the canvas blurry.
  const dpr = normalizeDpr(rawDpr)
  return Object.freeze({
    cssWidth,
    cssHeight,
    dpr,
    physicalWidth: Math.round(cssWidth * dpr),
    physicalHeight: Math.round(cssHeight * dpr)
  })
}

function measureViewportFromElement(
  element: HTMLCanvasElement,
  rawDpr = window.devicePixelRatio
): CanvasViewport {
  const initialRect = element.getBoundingClientRect()
  if (initialRect.width === 0 || initialRect.height === 0) {
    return measureViewport(initialRect.width, initialRect.height, rawDpr)
  }

  const previousViewport = appliedViewportByCanvas.get(element)
  if (
    previousViewport &&
    initialRect.width === previousViewport.cssWidth &&
    initialRect.height === previousViewport.cssHeight
  ) {
    return measureViewport(
      previousViewport.cssWidth,
      previousViewport.cssHeight,
      rawDpr
    )
  }

  const savedWidth = element.width
  const savedHeight = element.height
  let cssRect: DOMRect
  try {
    element.width = 0
    element.height = 0
    cssRect = element.getBoundingClientRect()
  } finally {
    element.width = savedWidth
    element.height = savedHeight
    // Restoring the backing store leaves the 2D context at the identity
    // transform, so the DPR scale has to be re-applied even when the applied
    // viewport is about to come back byte-identical.
    invalidateCanvasContextTransform(element)
  }
  const width = cssRect.width || previousViewport?.cssWidth || initialRect.width
  const height =
    cssRect.height || previousViewport?.cssHeight || initialRect.height
  return measureViewport(width, height, rawDpr)
}

/**
 * Size one canvas's backing store to `viewport` and leave its 2D context
 * scaled by the applied DPR.
 *
 * Both are one concern because they share one mechanism: assigning `width` or
 * `height` resets the context to the identity transform. So a size change
 * always costs a re-scale, and a DPR-only change has to force a reset before
 * scaling, since `scale()` multiplies the existing transform.
 */
function applySurfaceViewport(
  canvas: HTMLCanvasElement,
  viewport: CanvasViewport
): void {
  const { physicalWidth, physicalHeight, dpr } = viewport
  let contextReset = false
  if (canvas.width !== physicalWidth) {
    canvas.width = physicalWidth
    contextReset = true
  }
  if (canvas.height !== physicalHeight) {
    canvas.height = physicalHeight
    contextReset = true
  }
  if (contextReset) invalidateCanvasContextTransform(canvas)

  if (appliedContextDprByCanvas.get(canvas) === dpr) return

  // The transform is unknown or wrong while the backing store already matches,
  // so reassign one dimension purely to return the context to identity.
  if (!contextReset) canvas.width = physicalWidth
  canvas.getContext('2d')?.scale(dpr, dpr)
  appliedContextDprByCanvas.set(canvas, dpr)
}

function applyViewport(
  viewport: CanvasViewport,
  fg: HTMLCanvasElement,
  bg: HTMLCanvasElement,
  consumer?: CanvasViewportConsumer
): CanvasViewport {
  applySurfaceViewport(fg, viewport)
  if (bg !== fg) applySurfaceViewport(bg, viewport)

  appliedViewportByCanvas.set(fg, viewport)
  appliedViewportByCanvas.set(bg, viewport)
  if (consumer) {
    consumer.dpr = viewport.dpr
    consumer.ds.setViewportSize(viewport.cssWidth, viewport.cssHeight)
  }
  return viewport
}

export {
  readBrowserDpr,
  measureViewport,
  measureViewportFromElement,
  applyLogicalCanvasStyle,
  applyViewport
}
