// @ts-strict-ignore
import type { Point, Rect, Rect32 } from "./interfaces"
import type { CanvasMouseEvent } from "./types/events"
import { LiteGraph } from "./litegraph"
import { isInRect } from "./measure"

export interface DragAndScaleState {
  offset: Point
  scale: number
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
  element?: HTMLCanvasElement
  visible_area: Rect32
  _binded_mouse_callback
  dragging?: boolean
  viewport?: Rect

  onredraw?(das: DragAndScale): void
  /** @deprecated */
  onmouse?(e: unknown): boolean

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

  constructor(element?: HTMLCanvasElement, skip_events?: boolean) {
    this.state = {
      offset: new Float32Array([0, 0]),
      scale: 1,
    }
    this.max_scale = 10
    this.min_scale = 0.1
    this.onredraw = null
    this.enabled = true
    this.last_mouse = [0, 0]
    this.element = null
    this.visible_area = new Float32Array(4)

    if (element) {
      this.element = element
      if (!skip_events) {
        this.bindEvents(element)
      }
    }
  }

  /** @deprecated Has not been kept up to date */
  bindEvents(element: Node): void {
    this.last_mouse = new Float32Array(2)

    this._binded_mouse_callback = this.onMouse.bind(this)

    LiteGraph.pointerListenerAdd(element, "down", this._binded_mouse_callback)
    LiteGraph.pointerListenerAdd(element, "move", this._binded_mouse_callback)
    LiteGraph.pointerListenerAdd(element, "up", this._binded_mouse_callback)

    element.addEventListener("mousewheel", this._binded_mouse_callback, false)
    element.addEventListener("wheel", this._binded_mouse_callback, false)
  }

  computeVisibleArea(viewport: Rect): void {
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

  /** @deprecated Has not been kept up to date */
  onMouse(e: CanvasMouseEvent) {
    if (!this.enabled) {
      return
    }

    const canvas = this.element
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // FIXME: "canvasx" / y are not referenced anywhere - wrong case
    // @ts-expect-error Incorrect case
    e.canvasx = x
    // @ts-expect-error Incorrect case
    e.canvasy = y
    e.dragging = this.dragging

    const is_inside = !this.viewport || isInRect(x, y, this.viewport)

    let ignore = false
    if (this.onmouse) {
      ignore = this.onmouse(e)
    }

    if (e.type == LiteGraph.pointerevents_method + "down" && is_inside) {
      this.dragging = true
      LiteGraph.pointerListenerRemove(canvas, "move", this._binded_mouse_callback)
      LiteGraph.pointerListenerAdd(document, "move", this._binded_mouse_callback)
      LiteGraph.pointerListenerAdd(document, "up", this._binded_mouse_callback)
    } else if (e.type == LiteGraph.pointerevents_method + "move") {
      if (!ignore) {
        const deltax = x - this.last_mouse[0]
        const deltay = y - this.last_mouse[1]
        if (this.dragging) {
          this.mouseDrag(deltax, deltay)
        }
      }
    } else if (e.type == LiteGraph.pointerevents_method + "up") {
      this.dragging = false
      LiteGraph.pointerListenerRemove(document, "move", this._binded_mouse_callback)
      LiteGraph.pointerListenerRemove(document, "up", this._binded_mouse_callback)
      LiteGraph.pointerListenerAdd(canvas, "move", this._binded_mouse_callback)
    } else if (
      is_inside &&
      (e.type == "mousewheel" || e.type == "wheel" || e.type == "DOMMouseScroll")
    ) {
      // @ts-expect-error Deprecated
      e.eventType = "mousewheel"
      // @ts-expect-error Deprecated
      if (e.type == "wheel") e.wheel = -e.deltaY
      // @ts-expect-error Deprecated
      else e.wheel = e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60

      // from stack overflow
      // @ts-expect-error Deprecated
      e.delta = e.wheelDelta
        // @ts-expect-error Deprecated
        ? e.wheelDelta / 40
        : e.deltaY
          ? -e.deltaY / 3
          : 0
      // @ts-expect-error Deprecated
      this.changeDeltaScale(1.0 + e.delta * 0.05)
    }

    this.last_mouse[0] = x
    this.last_mouse[1] = y

    if (is_inside) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
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

  changeScale(value: number, zooming_center?: Point): void {
    if (value < this.min_scale) {
      value = this.min_scale
    } else if (value > this.max_scale) {
      value = this.max_scale
    }

    if (value == this.scale) return
    if (!this.element) return

    const rect = this.element.getBoundingClientRect()
    if (!rect) return

    zooming_center = zooming_center ?? [rect.width * 0.5, rect.height * 0.5]

    const normalizedCenter: Point = [
      zooming_center[0] - rect.x,
      zooming_center[1] - rect.y,
    ]
    const center = this.convertCanvasToOffset(normalizedCenter)
    this.scale = value
    if (Math.abs(this.scale - 1) < 0.01) this.scale = 1
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

  reset(): void {
    this.scale = 1
    this.offset[0] = 0
    this.offset[1] = 0
  }
}
