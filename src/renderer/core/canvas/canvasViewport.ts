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

interface Size {
  readonly width: number
  readonly height: number
}

const appliedViewportByCanvas = new WeakMap<HTMLCanvasElement, CanvasViewport>()
const autoSizedStyleByCanvas = new WeakMap<
  HTMLCanvasElement,
  { width?: string; height?: string }
>()
const stylesheetSizeByCanvas = new WeakMap<HTMLCanvasElement, Size>()

/**
 * Sets the context transform to the applied DPR outright, so it neither
 * compounds across applications nor depends on what last reset the context.
 */
function applyContextTransform(canvas: HTMLCanvasElement, dpr: number): void {
  canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

/**
 * Measures the layout box a canvas has without its backing store's intrinsic
 * contribution: zeroing the attributes collapses an `auto`-sized canvas and
 * leaves one whose dimensions come from CSS untouched.
 *
 * Reassigning the attributes resets the 2D context, so the transform of the
 * last applied viewport is restored before returning. A probe must not be
 * observable in what gets drawn next.
 */
function probeCssSize(canvas: HTMLCanvasElement): Size {
  const savedWidth = canvas.width
  const savedHeight = canvas.height
  try {
    canvas.width = 0
    canvas.height = 0
    const { width, height } = canvas.getBoundingClientRect()
    return { width, height }
  } finally {
    canvas.width = savedWidth
    canvas.height = savedHeight
    applyContextTransform(canvas, appliedViewportByCanvas.get(canvas)?.dpr ?? 1)
  }
}

function matchesRequestedSize(
  rect: Size,
  width: number,
  height: number
): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    Math.abs(rect.width - width) < 1 &&
    Math.abs(rect.height - height) < 1
  )
}

/** Whether CSS, rather than the backing-store attributes, gives `rect`. */
function isSizedByCss(canvas: HTMLCanvasElement, rect: Size): boolean {
  // Probing forces a reflow and clears the bitmap, so reuse the verdict while
  // the box is unchanged. A canvas that stops being sized by CSS resizes doing
  // so, which invalidates the entry.
  const cached = stylesheetSizeByCanvas.get(canvas)
  if (cached?.width === rect.width && cached.height === rect.height) return true

  const probed = probeCssSize(canvas)
  if (!(probed.width > 0) || !(probed.height > 0)) {
    stylesheetSizeByCanvas.delete(canvas)
    return false
  }
  stylesheetSizeByCanvas.set(canvas, probed)
  return true
}

/**
 * Whether the canvas already lays out at `width` x `height` for a reason other
 * than its own backing-store attributes, and so must keep its current sizing.
 *
 * A layout box that merely matches is not enough to tell: a stylesheet-sized
 * canvas and an `auto`-sized one whose attributes happen to agree look
 * identical until {@link applyViewport} writes DPR-scaled attributes, at which
 * point only the latter's layout box grows with them.
 */
function hasIndependentLogicalSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): boolean {
  const rect = canvas.getBoundingClientRect()
  if (!matchesRequestedSize(rect, width, height)) return false

  // Inline dimensions already decouple the layout box from the backing store,
  // whether this function pinned them or the caller did.
  const { style } = canvas
  if (style.width && style.height) return true

  return isSizedByCss(canvas, rect)
}

function applyLogicalCanvasStyle(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
  if (!(width > 0) || !(height > 0)) return
  if (hasIndependentLogicalSize(canvas, width, height)) return

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

  const cssSize = probeCssSize(element)
  const width = cssSize.width || previousViewport?.cssWidth || initialRect.width
  const height =
    cssSize.height || previousViewport?.cssHeight || initialRect.height
  return measureViewport(width, height, rawDpr)
}

function applySurfaceViewport(
  canvas: HTMLCanvasElement,
  viewport: CanvasViewport
): void {
  const { physicalWidth, physicalHeight, dpr } = viewport
  if (canvas.width !== physicalWidth) canvas.width = physicalWidth
  if (canvas.height !== physicalHeight) canvas.height = physicalHeight
  applyContextTransform(canvas, dpr)
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
