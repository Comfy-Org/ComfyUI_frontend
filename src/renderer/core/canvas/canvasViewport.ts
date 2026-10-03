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
const backingStoreResetByMeasurement = new WeakSet<HTMLCanvasElement>()
const autoSizedStyleByCanvas = new WeakMap<
  HTMLCanvasElement,
  { width?: string; height?: string }
>()

function applyParentSizedCanvasStyle(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
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
    backingStoreResetByMeasurement.add(element)
  }
  const width = cssRect.width || previousViewport?.cssWidth || initialRect.width
  const height =
    cssRect.height || previousViewport?.cssHeight || initialRect.height
  return measureViewport(width, height, rawDpr)
}

function applyViewport(
  viewport: CanvasViewport,
  fg: HTMLCanvasElement,
  bg: HTMLCanvasElement,
  consumer?: CanvasViewportConsumer
): CanvasViewport {
  const previousForegroundViewport = appliedViewportByCanvas.get(fg)
  const foregroundResetByMeasurement = backingStoreResetByMeasurement.delete(fg)
  const foregroundChanged =
    foregroundResetByMeasurement ||
    fg.width !== viewport.physicalWidth ||
    fg.height !== viewport.physicalHeight ||
    previousForegroundViewport?.dpr !== viewport.dpr
  if (
    fg.width !== viewport.physicalWidth ||
    previousForegroundViewport?.dpr !== viewport.dpr
  )
    fg.width = viewport.physicalWidth
  if (fg.height !== viewport.physicalHeight) fg.height = viewport.physicalHeight
  if (foregroundChanged) fg.getContext('2d')?.scale(viewport.dpr, viewport.dpr)
  if (bg !== fg) {
    const previousBackgroundViewport = appliedViewportByCanvas.get(bg)
    const backgroundResetByMeasurement =
      backingStoreResetByMeasurement.delete(bg)
    const backgroundChanged =
      backgroundResetByMeasurement ||
      bg.width !== viewport.physicalWidth ||
      bg.height !== viewport.physicalHeight ||
      previousBackgroundViewport?.dpr !== viewport.dpr
    if (
      bg.width !== viewport.physicalWidth ||
      previousBackgroundViewport?.dpr !== viewport.dpr
    )
      bg.width = viewport.physicalWidth
    if (bg.height !== viewport.physicalHeight)
      bg.height = viewport.physicalHeight
    if (backgroundChanged)
      bg.getContext('2d')?.scale(viewport.dpr, viewport.dpr)
  }

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
  applyParentSizedCanvasStyle,
  applyViewport
}
