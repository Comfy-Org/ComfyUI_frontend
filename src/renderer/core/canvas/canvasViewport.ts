interface CanvasViewport {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly dpr: number
  readonly physicalWidth: number
  readonly physicalHeight: number
  readonly generation: number
}

let currentGeneration = 0

function measureViewport(
  cssWidth: number,
  cssHeight: number,
  rawDpr: number,
  prevGeneration?: number
): CanvasViewport {
  // Preserve raw DPR so sub-1 displays (e.g. chromium-0.5x) keep their
  // native scale. Only fall back to 1 for invalid (<= 0 / NaN) values.
  const dpr = rawDpr > 0 ? rawDpr : 1
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
  const saved = { w: element.width, h: element.height }
  element.width = element.height = NaN
  const { width, height } = element.getBoundingClientRect()
  element.width = saved.w
  element.height = saved.h
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
  bg: HTMLCanvasElement
): CanvasViewport {
  fg.width = viewport.physicalWidth
  fg.height = viewport.physicalHeight
  bg.width = viewport.physicalWidth
  bg.height = viewport.physicalHeight

  fg.getContext('2d')?.scale(viewport.dpr, viewport.dpr)
  bg.getContext('2d')?.scale(viewport.dpr, viewport.dpr)

  currentGeneration = viewport.generation
  return viewport
}

export { measureViewport, measureViewportFromElement, applyViewport }
