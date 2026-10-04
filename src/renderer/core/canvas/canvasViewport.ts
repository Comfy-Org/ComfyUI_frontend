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

/**
 * Measures the layout box a canvas has without its backing store's intrinsic
 * contribution: zeroing the attributes collapses an `auto`-sized canvas and
 * leaves one whose dimensions come from CSS untouched.
 *
 * Reassigning the attributes resets the 2D context and clears the bitmap. The
 * transform of the last applied viewport is restored before returning; the
 * caller is responsible for redrawing.
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
    const dpr = appliedViewportByCanvas.get(canvas)?.dpr ?? 1
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
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

interface SizeOwnership {
  /** Whether something other than the backing-store attributes owns the size. */
  readonly independent: boolean
  /** Whether answering the question discarded the canvas bitmap. */
  readonly probed: boolean
}

/**
 * Whether the canvas already lays out at `width` x `height` for a reason other
 * than its own backing-store attributes, and so must keep its current sizing.
 *
 * A layout box that merely matches the request is not enough to tell: a
 * stylesheet-sized canvas and an `auto`-sized one whose attributes happen to
 * agree look identical until {@link applyViewport} writes DPR-scaled
 * attributes, at which point only the latter's layout box grows with them.
 */
function readSizeOwnership(
  canvas: HTMLCanvasElement,
  rect: Size,
  width: number,
  height: number
): SizeOwnership {
  if (!matchesRequestedSize(rect, width, height))
    return { independent: false, probed: false }

  // Inline dimensions already decouple the layout box from the backing store,
  // whether this module pinned them or the caller did.
  const { style } = canvas
  if (style.width && style.height) return { independent: true, probed: false }

  // A layout box that differs from the backing-store attributes cannot be
  // coming from them, so something else already owns the size. This settles a
  // stylesheet-sized canvas above DPR 1 without the destructive probe; at DPR 1
  // its box equals its attributes, so every call probes.
  if (
    canvas.width !== canvas.offsetWidth ||
    canvas.height !== canvas.offsetHeight
  )
    return { independent: true, probed: false }

  // Equal is the ambiguous case. Only an `auto`-sized box collapses when the
  // attributes go away, and finding that out costs the bitmap.
  const probed = probeCssSize(canvas)
  return { independent: probed.width > 0 && probed.height > 0, probed: true }
}

/**
 * Pins the canvas's logical CSS size, unless something else already owns it.
 *
 * @returns whether deciding that discarded the canvas bitmap. A caller that
 * skips work when nothing resized must still repaint when this is true.
 */
function applyLogicalCanvasStyle(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): boolean {
  if (!(width > 0) || !(height > 0)) return false

  const { independent, probed } = readSizeOwnership(
    canvas,
    canvas.getBoundingClientRect(),
    width,
    height
  )
  if (independent) return probed

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
  return probed
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
  canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
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
