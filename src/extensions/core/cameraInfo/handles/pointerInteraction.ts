export type PointerPosition = Pick<PointerEvent, 'clientX' | 'clientY'>

export interface PointerInteractionHost<T extends string> {
  canvas: HTMLCanvasElement
  pickHandle(position: PointerPosition): T | null
  dragHandle(type: T, position: PointerPosition): void
  hoverChanged(type: T | null): void
  handleDragChanged(dragging: boolean): void
  freeDragEnabled(): boolean
  freeDrag(dx: number, dy: number): void
  wheelEnabled(): boolean
  wheel(deltaY: number): void
  idleCursor(): string
}

interface HandleDrag<T> {
  type: T
  pointerId: number
}

interface FreeDrag {
  pointerId: number
  lastX: number
  lastY: number
}

export class PointerInteraction<T extends string> {
  private handleDrag: HandleDrag<T> | null = null
  private freeDrag: FreeDrag | null = null
  private hovered: T | null = null
  private pendingRotation: { dx: number; dy: number } | null = null
  private pendingDolly: number | null = null
  private pendingDragPointer: PointerPosition | null = null
  private pendingHoverPointer: PointerPosition | null = null
  private inputFrame: number | null = null

  constructor(private readonly host: PointerInteractionHost<T>) {}

  get hoveredHandle(): T | null {
    return this.hovered
  }

  attach(): void {
    const canvas = this.host.canvas
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  detach(): void {
    const canvas = this.host.canvas
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerUp)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    canvas.removeEventListener('wheel', this.onWheel)
  }

  cancel(): void {
    this.cancelInputFrame()
    const wasDraggingHandle = this.handleDrag !== null
    this.handleDrag = null
    this.freeDrag = null
    if (wasDraggingHandle) this.host.handleDragChanged(false)
    this.setHovered(null)
    this.host.canvas.style.cursor = this.host.idleCursor()
  }

  private setHovered(type: T | null): void {
    if (this.hovered === type) return
    this.hovered = type
    this.host.hoverChanged(type)
    this.host.canvas.style.cursor = this.host.idleCursor()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return

    const type = this.host.pickHandle(event)
    if (type) {
      this.pendingHoverPointer = null
      this.setHovered(type)
      this.handleDrag = { type, pointerId: event.pointerId }
      this.host.handleDragChanged(true)
    } else if (this.host.freeDragEnabled()) {
      this.freeDrag = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY
      }
    } else {
      return
    }
    this.host.canvas.setPointerCapture(event.pointerId)
    this.host.canvas.style.cursor = 'grabbing'
    event.stopPropagation()
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.freeDrag) {
      if (event.pointerId !== this.freeDrag.pointerId) return
      const dx = event.clientX - this.freeDrag.lastX
      const dy = event.clientY - this.freeDrag.lastY
      this.freeDrag.lastX = event.clientX
      this.freeDrag.lastY = event.clientY
      this.pendingRotation = {
        dx: (this.pendingRotation?.dx ?? 0) + dx,
        dy: (this.pendingRotation?.dy ?? 0) + dy
      }
      this.scheduleInputFrame()
      return
    }

    if (!this.handleDrag) {
      this.pendingHoverPointer = {
        clientX: event.clientX,
        clientY: event.clientY
      }
      this.scheduleInputFrame()
      return
    }
    if (event.pointerId !== this.handleDrag.pointerId) return
    this.pendingDragPointer = { clientX: event.clientX, clientY: event.clientY }
    this.scheduleInputFrame()
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const active = this.freeDrag ?? this.handleDrag
    if (!active || event.pointerId !== active.pointerId) return
    this.flushInput()
    this.cancelInputFrame()
    if (this.host.canvas.hasPointerCapture(event.pointerId)) {
      this.host.canvas.releasePointerCapture(event.pointerId)
    }
    const wasDraggingHandle = this.handleDrag !== null
    this.freeDrag = null
    this.handleDrag = null
    if (wasDraggingHandle) this.host.handleDragChanged(false)
    this.host.canvas.style.cursor = this.host.idleCursor()
  }

  private readonly onPointerLeave = (): void => {
    if (this.handleDrag || this.freeDrag) return
    this.pendingHoverPointer = null
    this.setHovered(null)
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.host.wheelEnabled()) return
    event.preventDefault()
    event.stopPropagation()
    this.pendingDolly = (this.pendingDolly ?? 0) + event.deltaY
    this.scheduleInputFrame()
  }

  private scheduleInputFrame(): void {
    if (this.inputFrame !== null) return
    this.inputFrame = requestAnimationFrame(() => {
      this.inputFrame = null
      this.flushInput()
    })
  }

  private flushInput(): void {
    const rotation = this.pendingRotation
    const dolly = this.pendingDolly
    const dragPointer = this.pendingDragPointer
    const hoverPointer = this.pendingHoverPointer
    this.pendingRotation = null
    this.pendingDolly = null
    this.pendingDragPointer = null
    this.pendingHoverPointer = null

    if (dragPointer && this.handleDrag) {
      this.host.dragHandle(this.handleDrag.type, dragPointer)
    } else if (hoverPointer && !this.handleDrag) {
      this.setHovered(this.host.pickHandle(hoverPointer))
    }
    if (rotation) this.host.freeDrag(rotation.dx, rotation.dy)
    if (dolly !== null) this.host.wheel(dolly)
  }

  private cancelInputFrame(): void {
    if (this.inputFrame !== null) {
      cancelAnimationFrame(this.inputFrame)
      this.inputFrame = null
    }
    this.pendingRotation = null
    this.pendingDolly = null
    this.pendingDragPointer = null
    this.pendingHoverPointer = null
  }
}
