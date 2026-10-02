/** How far the stage is zoomed and panned from fitting its frame. */
export interface ZoomView {
  /** 1 fits the frame. */
  readonly scale: number
  /** The pan, in screen pixels, applied before the scale from the top left. */
  readonly x: number
  readonly y: number
}

interface Point {
  readonly x: number
  readonly y: number
}

interface Size {
  readonly width: number
  readonly height: number
}

export const FIT: ZoomView = { scale: 1, x: 0, y: 0 }
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
const STEP = 1.25
/** How much of the frame the zoomed stage always keeps covering. */
const KEEP = 0.25

const clampScale = (scale: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

/** The view panned so the stage never leaves the frame entirely. */
export function keepInFrame(view: ZoomView, frame: Size): ZoomView {
  const { width, height } = frame
  return {
    scale: view.scale,
    x: clamp(view.x, width * KEEP - width * view.scale, width * (1 - KEEP)),
    y: clamp(view.y, height * KEEP - height * view.scale, height * (1 - KEEP))
  }
}

/**
 * The view scaled by `factor` around `at`, a point in the frame's own
 * pixels, so whatever sits under it stays put.
 */
export function zoomAt(
  view: ZoomView,
  factor: number,
  at: Point,
  frame: Size
): ZoomView {
  const scale = clampScale(view.scale * factor)
  const ratio = scale / view.scale
  return keepInFrame(
    {
      scale,
      x: at.x - (at.x - view.x) * ratio,
      y: at.y - (at.y - view.y) * ratio
    },
    frame
  )
}

/** One step in or out, around the frame's centre. */
export function stepZoom(
  view: ZoomView,
  direction: 1 | -1,
  frame: Size
): ZoomView {
  return zoomAt(
    view,
    direction > 0 ? STEP : 1 / STEP,
    { x: frame.width / 2, y: frame.height / 2 },
    frame
  )
}

/** The view moved by a drag of `dx`, `dy` screen pixels. */
export function panBy(
  view: ZoomView,
  dx: number,
  dy: number,
  frame: Size
): ZoomView {
  return keepInFrame({ ...view, x: view.x + dx, y: view.y + dy }, frame)
}

/** The zoom factor for a ctrl or pinch wheel event's vertical delta. */
export function wheelFactor(deltaY: number): number {
  return Math.exp(clamp(-deltaY, -50, 50) * 0.01)
}

/** What the zoom control reads, as a whole percentage of fitting. */
export const zoomPercent = (view: ZoomView) => Math.round(view.scale * 100)

/** The CSS transform that draws `view`, from the frame's top left. */
export const zoomTransform = (view: ZoomView) =>
  `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
