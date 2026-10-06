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
const sizeOwnershipByCanvas = new WeakMap<
  HTMLCanvasElement,
  { signature: string; ownership: SizeOwnership }
>()

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

interface SizeOwnership {
  readonly independentWidth: boolean
  readonly independentHeight: boolean
  readonly discardedBitmap: boolean
}

function readContentBox(canvas: HTMLCanvasElement): Size {
  const style = getComputedStyle(canvas)
  const horizontalInsets =
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth)
  const verticalInsets =
    Number.parseFloat(style.paddingTop) +
    Number.parseFloat(style.paddingBottom) +
    Number.parseFloat(style.borderTopWidth) +
    Number.parseFloat(style.borderBottomWidth)
  return {
    width: canvas.offsetWidth - (horizontalInsets || 0),
    height: canvas.offsetHeight - (verticalInsets || 0)
  }
}

function isAxisSizedElsewhere(
  rectSize: number,
  requestedSize: number,
  backingSize: number,
  layoutSize: number,
  hasInlineSize: boolean
): boolean | undefined {
  if (!(rectSize > 0 && Math.abs(rectSize - requestedSize) < 1)) return false
  if (hasInlineSize || backingSize !== layoutSize) return true
  return undefined
}

function readSizeOwnership(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): SizeOwnership {
  const rect = canvas.getBoundingClientRect()
  const layout = readContentBox(canvas)
  const independentWidth = isAxisSizedElsewhere(
    rect.width,
    width,
    canvas.width,
    layout.width,
    Boolean(canvas.style.width)
  )
  const independentHeight = isAxisSizedElsewhere(
    rect.height,
    height,
    canvas.height,
    layout.height,
    Boolean(canvas.style.height)
  )
  if (independentWidth !== undefined && independentHeight !== undefined)
    return { independentWidth, independentHeight, discardedBitmap: false }

  const signature = [
    width,
    height,
    rect.width,
    rect.height,
    layout.width,
    layout.height,
    canvas.width,
    canvas.height,
    canvas.style.cssText,
    canvas.className
  ].join('|')
  const cached = sizeOwnershipByCanvas.get(canvas)
  if (cached?.signature === signature)
    return { ...cached.ownership, discardedBitmap: false }

  const probed = probeCssSize(canvas)
  const ownership = {
    independentWidth: independentWidth ?? probed.width > 0,
    independentHeight: independentHeight ?? probed.height > 0,
    discardedBitmap: true
  }
  sizeOwnershipByCanvas.set(canvas, { signature, ownership })
  return ownership
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

  const { independentWidth, independentHeight, discardedBitmap } =
    readSizeOwnership(canvas, width, height)
  const { style } = canvas
  const previousStyle = autoSizedStyleByCanvas.get(canvas) ?? {}
  const nextStyle: { width?: string; height?: string } = { ...previousStyle }
  if (
    !independentWidth &&
    (!style.width || style.width === previousStyle.width)
  ) {
    style.width = `${width}px`
    nextStyle.width = style.width
  }
  if (
    !independentHeight &&
    (!style.height || style.height === previousStyle.height)
  ) {
    style.height = `${height}px`
    nextStyle.height = style.height
  }
  autoSizedStyleByCanvas.set(canvas, nextStyle)
  return discardedBitmap
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
