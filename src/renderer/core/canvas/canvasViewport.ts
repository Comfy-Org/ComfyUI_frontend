interface CanvasViewport {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly dpr: number
  readonly physicalWidth: number
  readonly physicalHeight: number
  readonly generation: number
}

interface CanvasViewportConsumer {
  setViewportSize(width: number, height: number): void
}

let currentGeneration = 0
const appliedViewportByCanvas = new WeakMap<HTMLCanvasElement, CanvasViewport>()

function normalizeDpr(rawDpr: number): number {
  return rawDpr > 0 && Number.isFinite(rawDpr) ? Math.max(rawDpr, 1) : 1
}

function measureViewport(
  cssWidth: number,
  cssHeight: number,
  rawDpr: number,
  prevGeneration?: number
): CanvasViewport {
  // Keep at least one backing pixel per CSS pixel. DPR values below one are
  // valid browser inputs, but using them directly makes the canvas blurry.
  const dpr = normalizeDpr(rawDpr)
  return Object.freeze({
    cssWidth,
    cssHeight,
    dpr,
    physicalWidth: Math.round(cssWidth * dpr),
    physicalHeight: Math.round(cssHeight * dpr),
    generation: (prevGeneration ?? currentGeneration) + 1
  })
}

function measureViewportFromElement(
  element: HTMLCanvasElement,
  rawDpr?: number,
  prevGeneration?: number
): CanvasViewport {
  const initialRect = element.getBoundingClientRect()
  if (initialRect.width === 0 || initialRect.height === 0) {
    return measureViewport(
      initialRect.width,
      initialRect.height,
      rawDpr ?? window.devicePixelRatio,
      prevGeneration
    )
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
      rawDpr ?? window.devicePixelRatio,
      prevGeneration
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
  }
  const width = cssRect.width || previousViewport?.cssWidth || initialRect.width
  const height =
    cssRect.height || previousViewport?.cssHeight || initialRect.height
  return measureViewport(
    width,
    height,
    rawDpr ?? window.devicePixelRatio,
    prevGeneration
  )
}

function applyViewport(
  viewport: CanvasViewport,
  fg: HTMLCanvasElement,
  bg: HTMLCanvasElement,
  consumer?: CanvasViewportConsumer
): CanvasViewport {
  const previousForegroundViewport = appliedViewportByCanvas.get(fg)
  const foregroundChanged =
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
    const backgroundChanged =
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
  consumer?.setViewportSize(viewport.cssWidth, viewport.cssHeight)

  currentGeneration = viewport.generation
  return viewport
}

export {
  normalizeDpr,
  measureViewport,
  measureViewportFromElement,
  applyViewport
}
