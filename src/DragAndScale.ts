import type { Point, ReadOnlyRect, Rect } from "./interfaces"

import { EaseFunction, Rectangle } from "./litegraph"

export interface DragAndScaleState {
  /**
   * The offset from the top-left of the current canvas viewport to `[0, 0]` in graph space.
   * Or said another way, the inverse offset of the viewport.
   */
  offset: Point
  /** The scale of the graph. */
  scale: number
}

export type AnimationOptions = {
  /** Duration of the animation in milliseconds. */
  duration?: number
  /** Relative target zoom level. 1 means the view is fit exactly on the bounding box. */
  zoom?: number
  /** The animation easing function (curve) */
  easing?: EaseFunction
}

export class DragAndScale {
  /**
   * The state of this DragAndScale instance.
   *
   * Implemented as a POCO that can be proxied without side-effects.
   */
  state: DragAndScaleState

  /** Maximum scale (zoom in) */
  max_scale: number
  /** Minimum scale (zoom out) */
  min_scale: number
  enabled: boolean
  last_mouse: Point
  element: HTMLCanvasElement
  visible_area: Rectangle
  dragging?: boolean
  viewport?: Rect

  onredraw?(das: DragAndScale): void

  get offset(): Point {
    return this.state.offset
  }

  set offset(value: Point) {
    this.state.offset = value
  }

  get scale(): number {
    return this.state.scale
  }

  set scale(value: number) {
    this.state.scale = value
  }

  constructor(element: HTMLCanvasElement) {
    this.state = {
      offset: new Float32Array([0, 0]),
      scale: 1,
    }
    this.max_scale = 10
    this.min_scale = 0.1
    this.enabled = true
    this.last_mouse = [0, 0]
    this.visible_area = new Rectangle()

    this.element = element
  }

  computeVisibleArea(viewport: Rect | undefined): void {
    if (!this.element) {
      this.visible_area[0] = this.visible_area[1] = this.visible_area[2] = this.visible_area[3] = 0
      return
    }
    let width = this.element.width
    let height = this.element.height
    let startx = -this.offset[0]
    let starty = -this.offset[1]
    if (viewport) {
      startx += viewport[0] / this.scale
      starty += viewport[1] / this.scale
      width = viewport[2]
      height = viewport[3]
    }
    const endx = startx + width / this.scale
    const endy = starty + height / this.scale
    this.visible_area[0] = startx
    this.visible_area[1] = starty
    this.visible_area[2] = endx - startx
    this.visible_area[3] = endy - starty
  }

  toCanvasContext(ctx: CanvasRenderingContext2D): void {
    ctx.scale(this.scale, this.scale)
    ctx.translate(this.offset[0], this.offset[1])
  }

  convertOffsetToCanvas(pos: Point): Point {
    return [
      (pos[0] + this.offset[0]) * this.scale,
      (pos[1] + this.offset[1]) * this.scale,
    ]
  }

  convertCanvasToOffset(pos: Point, out?: Point): Point {
    out = out || [0, 0]
    out[0] = pos[0] / this.scale - this.offset[0]
    out[1] = pos[1] / this.scale - this.offset[1]
    return out
  }

  /** @deprecated Has not been kept up to date */
  mouseDrag(x: number, y: number): void {
    this.offset[0] += x / this.scale
    this.offset[1] += y / this.scale

    this.onredraw?.(this)
  }

  changeScale(value: number, zooming_center?: Point, roundToScaleOne = true): void {
    if (value < this.min_scale) {
      value = this.min_scale
    } else if (value > this.max_scale) {
      value = this.max_scale
    }
    if (value == this.scale) return

    const rect = this.element.getBoundingClientRect()
    if (!rect) return

    zooming_center = zooming_center ?? [rect.width * 0.5, rect.height * 0.5]

    const normalizedCenter: Point = [
      zooming_center[0] - rect.x,
      zooming_center[1] - rect.y,
    ]
    const center = this.convertCanvasToOffset(normalizedCenter)
    this.scale = value
    if (roundToScaleOne && Math.abs(this.scale - 1) < 0.01) this.scale = 1
    const new_center = this.convertCanvasToOffset(normalizedCenter)
    const delta_offset = [
      new_center[0] - center[0],
      new_center[1] - center[1],
    ]

    this.offset[0] += delta_offset[0]
    this.offset[1] += delta_offset[1]

    this.onredraw?.(this)
  }

  changeDeltaScale(value: number, zooming_center?: Point): void {
    this.changeScale(this.scale * value, zooming_center)
  }

  /**
   * Fits the view to the specified bounds.
   * @param bounds The bounds to fit the view to, defined by a rectangle.
   */
  fitToBounds(bounds: ReadOnlyRect, { zoom = 0.75 }: { zoom?: number } = {}): void {
    const cw = this.element.width / window.devicePixelRatio
    const ch = this.element.height / window.devicePixelRatio
    let targetScale = this.scale

    if (zoom > 0) {
      const targetScaleX = (zoom * cw) / Math.max(bounds[2], 300)
      const targetScaleY = (zoom * ch) / Math.max(bounds[3], 300)

      // Choose the smaller scale to ensure the node fits into the viewport
      // Ensure we don't go over the max scale
      targetScale = Math.min(targetScaleX, targetScaleY, this.max_scale)
    }

    const scaledWidth = cw / targetScale
    const scaledHeight = ch / targetScale

    // Calculate the target position to center the bounds in the viewport
    const targetX = -bounds[0] - (bounds[2] * 0.5) + (scaledWidth * 0.5)
    const targetY = -bounds[1] - (bounds[3] * 0.5) + (scaledHeight * 0.5)

    // Apply the changes immediately
    this.offset[0] = targetX
    this.offset[1] = targetY
    this.scale = targetScale
  }

  /**
   * Starts an animation to fit the view around the specified selection of nodes.
   * @param bounds The bounds to animate the view to, defined by a rectangle.
   */
  animateToBounds(
    bounds: ReadOnlyRect,
    setDirty: () => void,
    {
      duration = 350,
      zoom = 0.75,
      easing = EaseFunction.EASE_IN_OUT_QUAD,
    }: AnimationOptions = {},
  ) {
    if (!(duration > 0)) throw new RangeError("Duration must be greater than 0")

    const easeFunctions = {
      linear: (t: number) => t,
      easeInQuad: (t: number) => t * t,
      easeOutQuad: (t: number) => t * (2 - t),
      easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    }
    const easeFunction = easeFunctions[easing] ?? easeFunctions.linear

    const startTimestamp = performance.now()
    const cw = this.element.width / window.devicePixelRatio
    const ch = this.element.height / window.devicePixelRatio
    const startX = this.offset[0]
    const startY = this.offset[1]
    const startX2 = startX - (cw / this.scale)
    const startY2 = startY - (ch / this.scale)
    const startScale = this.scale
    let targetScale = startScale

    if (zoom > 0) {
      const targetScaleX = (zoom * cw) / Math.max(bounds[2], 300)
      const targetScaleY = (zoom * ch) / Math.max(bounds[3], 300)

      // Choose the smaller scale to ensure the node fits into the viewport
      // Ensure we don't go over the max scale
      targetScale = Math.min(targetScaleX, targetScaleY, this.max_scale)
    }
    const scaledWidth = cw / targetScale
    const scaledHeight = ch / targetScale

    const targetX = -bounds[0] - (bounds[2] * 0.5) + (scaledWidth * 0.5)
    const targetY = -bounds[1] - (bounds[3] * 0.5) + (scaledHeight * 0.5)
    const targetX2 = targetX - scaledWidth
    const targetY2 = targetY - scaledHeight

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTimestamp
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeFunction(progress)

      const currentX = startX + ((targetX - startX) * easedProgress)
      const currentY = startY + ((targetY - startY) * easedProgress)
      this.offset[0] = currentX
      this.offset[1] = currentY

      if (zoom > 0) {
        const currentX2 = startX2 + ((targetX2 - startX2) * easedProgress)
        const currentY2 = startY2 + ((targetY2 - startY2) * easedProgress)
        const currentWidth = Math.abs(currentX2 - currentX)
        const currentHeight = Math.abs(currentY2 - currentY)

        this.scale = Math.min(cw / currentWidth, ch / currentHeight)
      }

      setDirty()

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      } else {
        cancelAnimationFrame(animationId)
      }
    }
    let animationId = requestAnimationFrame(animate)
  }

  reset(): void {
    this.scale = 1
    this.offset[0] = 0
    this.offset[1] = 0
  }
}
