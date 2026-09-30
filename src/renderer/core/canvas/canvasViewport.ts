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
  return rawDpr > 0 && Number.isFinite(rawDpr) ? rawDpr : 1
}

function measureViewport(
  cssWidth: number,
  cssHeight: number,
  rawDpr: number,
  prevGeneration?: number
): CanvasViewport {
  // Preserve raw DPR so sub-1 displays (e.g. chromium-0.5x) keep their
  // native scale. Only fall back to 1 for invalid values.
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
  const previousViewport = appliedViewportByCanvas.get(element)
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
  fg.width = viewport.physicalWidth
  fg.height = viewport.physicalHeight
  fg.getContext('2d')?.scale(viewport.dpr, viewport.dpr)
  if (bg !== fg) {
    bg.width = viewport.physicalWidth
    bg.height = viewport.physicalHeight
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
