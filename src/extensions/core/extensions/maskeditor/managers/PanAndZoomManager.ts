import type { MaskEditorDialog, Point, Offset } from '../types'
import { MessageBroker } from './MessageBroker'

export class PanAndZoomManager {
  maskEditor: MaskEditorDialog
  messageBroker: MessageBroker

  DOUBLE_TAP_DELAY: number = 300
  lastTwoFingerTap: number = 0

  isTouchZooming: boolean = false
  lastTouchZoomDistance: number = 0
  lastTouchMidPoint: Point = { x: 0, y: 0 }
  lastTouchPoint: Point = { x: 0, y: 0 }

  zoom_ratio: number = 1
  interpolatedZoomRatio: number = 1
  pan_offset: Offset = { x: 0, y: 0 }

  mouseDownPoint: Point | null = null
  initialPan: Offset = { x: 0, y: 0 }

  canvasContainer: HTMLElement | null = null
  maskCanvas: HTMLCanvasElement | null = null
  rgbCanvas: HTMLCanvasElement | null = null
  rootElement: HTMLElement | null = null

  image: HTMLImageElement | null = null
  imageRootWidth: number = 0
  imageRootHeight: number = 0

  cursorPoint: Point = { x: 0, y: 0 }
  penPointerIdList: number[] = []

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()

    this.addListeners()
    this.addPullTopics()
  }

  private addListeners() {
    this.messageBroker.subscribe(
      'initZoomPan',
      async (args: [HTMLImageElement, HTMLElement]) => {
        await this.initializeCanvasPanZoom(args[0], args[1])
      }
    )

    this.messageBroker.subscribe('panStart', async (event: PointerEvent) => {
      this.handlePanStart(event)
    })

    this.messageBroker.subscribe('panMove', async (event: PointerEvent) => {
      this.handlePanMove(event)
    })

    this.messageBroker.subscribe('zoom', async (event: WheelEvent) => {
      this.zoom(event)
    })

    this.messageBroker.subscribe('cursorPoint', async (point: Point) => {
      this.updateCursorPosition(point)
    })

    this.messageBroker.subscribe('pointerDown', async (event: PointerEvent) => {
      if (event.pointerType === 'pen')
        this.penPointerIdList.push(event.pointerId)
    })

    this.messageBroker.subscribe('pointerUp', async (event: PointerEvent) => {
      if (event.pointerType === 'pen') {
        const index = this.penPointerIdList.indexOf(event.pointerId)
        if (index > -1) this.penPointerIdList.splice(index, 1)
      }
    })

    this.messageBroker.subscribe(
      'handleTouchStart',
      async (event: TouchEvent) => {
        this.handleTouchStart(event)
      }
    )

    this.messageBroker.subscribe(
      'handleTouchMove',
      async (event: TouchEvent) => {
        this.handleTouchMove(event)
      }
    )

    this.messageBroker.subscribe(
      'handleTouchEnd',
      async (event: TouchEvent) => {
        this.handleTouchEnd(event)
      }
    )

    this.messageBroker.subscribe('resetZoom', async () => {
      if (this.interpolatedZoomRatio === 1) return
      await this.smoothResetView()
    })
  }

  private addPullTopics() {
    this.messageBroker.createPullTopic(
      'cursorPoint',
      async () => this.cursorPoint
    )
    this.messageBroker.createPullTopic('zoomRatio', async () => this.zoom_ratio)
    this.messageBroker.createPullTopic('panOffset', async () => this.pan_offset)
  }

  handleTouchStart(event: TouchEvent) {
    event.preventDefault()

    // for pen device, if drawing with pen, do not move the canvas
    if (this.penPointerIdList.length > 0) return

    this.messageBroker.publish('setBrushVisibility', false)
    if (event.touches.length === 2) {
      const currentTime = new Date().getTime()
      const tapTimeDiff = currentTime - this.lastTwoFingerTap

      if (tapTimeDiff < this.DOUBLE_TAP_DELAY) {
        // Double tap detected
        this.handleDoubleTap()
        this.lastTwoFingerTap = 0 // Reset to prevent triple-tap
      } else {
        this.lastTwoFingerTap = currentTime

        // Existing two-finger touch logic
        this.isTouchZooming = true
        this.lastTouchZoomDistance = this.getTouchDistance(event.touches)
        const midpoint = this.getTouchMidpoint(event.touches)
        this.lastTouchMidPoint = midpoint
      }
    } else if (event.touches.length === 1) {
      this.lastTouchPoint = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      }
    }
  }

  async handleTouchMove(event: TouchEvent) {
    event.preventDefault()

    // for pen device, if drawing with pen, do not move the canvas
    if (this.penPointerIdList.length > 0) return

    this.lastTwoFingerTap = 0
    if (this.isTouchZooming && event.touches.length === 2) {
      // Handle zooming
      const newDistance = this.getTouchDistance(event.touches)
      const zoomFactor = newDistance / this.lastTouchZoomDistance
      const oldZoom = this.zoom_ratio
      this.zoom_ratio = Math.max(
        0.2,
        Math.min(10.0, this.zoom_ratio * zoomFactor)
      )
      const newZoom = this.zoom_ratio

      // Calculate the midpoint of the two touches
      const midpoint = this.getTouchMidpoint(event.touches)

      // Handle panning - calculate the movement of the midpoint
      if (this.lastTouchMidPoint) {
        const deltaX = midpoint.x - this.lastTouchMidPoint.x
        const deltaY = midpoint.y - this.lastTouchMidPoint.y

        // Apply the pan
        this.pan_offset.x += deltaX
        this.pan_offset.y += deltaY
      }

      // Get touch position relative to the container
      if (this.maskCanvas === null) {
        this.maskCanvas = await this.messageBroker.pull('maskCanvas')
      }
      const rect = this.maskCanvas!.getBoundingClientRect()
      const touchX = midpoint.x - rect.left
      const touchY = midpoint.y - rect.top

      // Calculate new pan position based on zoom
      const scaleFactor = newZoom / oldZoom
      this.pan_offset.x += touchX - touchX * scaleFactor
      this.pan_offset.y += touchY - touchY * scaleFactor

      this.invalidatePanZoom()
      this.lastTouchZoomDistance = newDistance
      this.lastTouchMidPoint = midpoint
    } else if (event.touches.length === 1) {
      // Handle single touch pan
      this.handleSingleTouchPan(event.touches[0])
    }
  }

  handleTouchEnd(event: TouchEvent) {
    event.preventDefault()

    const lastTouch = event.touches[0]
    // if all touches are removed, lastTouch will be null
    if (lastTouch) {
      this.lastTouchPoint = {
        x: lastTouch.clientX,
        y: lastTouch.clientY
      }
    } else {
      this.isTouchZooming = false
      this.lastTouchMidPoint = { x: 0, y: 0 }
    }
  }

  private getTouchDistance(touches: TouchList) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getTouchMidpoint(touches: TouchList) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    }
  }

  private async handleSingleTouchPan(touch: Touch) {
    if (this.lastTouchPoint === null) {
      this.lastTouchPoint = { x: touch.clientX, y: touch.clientY }
      return
    }

    const deltaX = touch.clientX - this.lastTouchPoint.x
    const deltaY = touch.clientY - this.lastTouchPoint.y

    this.pan_offset.x += deltaX
    this.pan_offset.y += deltaY

    await this.invalidatePanZoom()

    this.lastTouchPoint = { x: touch.clientX, y: touch.clientY }
  }

  private updateCursorPosition(clientPoint: Point) {
    var cursorX = clientPoint.x - this.pan_offset.x
    var cursorY = clientPoint.y - this.pan_offset.y

    this.cursorPoint = { x: cursorX, y: cursorY }
  }

  //prob redundant
  handleDoubleTap() {
    this.messageBroker.publish('undo')
    // Add any additional logic needed after undo
  }

  async zoom(event: WheelEvent) {
    // Store original cursor position
    const cursorPoint = { x: event.clientX, y: event.clientY }

    // zoom canvas
    const oldZoom = this.zoom_ratio
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    this.zoom_ratio = Math.max(
      0.2,
      Math.min(10.0, this.zoom_ratio * zoomFactor)
    )
    const newZoom = this.zoom_ratio

    const maskCanvas = await this.messageBroker.pull('maskCanvas')

    // Get mouse position relative to the container
    const rect = maskCanvas.getBoundingClientRect()
    const mouseX = cursorPoint.x - rect.left
    const mouseY = cursorPoint.y - rect.top

    console.log(oldZoom, newZoom)
    // Calculate new pan position
    const scaleFactor = newZoom / oldZoom
    this.pan_offset.x += mouseX - mouseX * scaleFactor
    this.pan_offset.y += mouseY - mouseY * scaleFactor

    // Update pan and zoom immediately
    await this.invalidatePanZoom()

    const newImageWidth = maskCanvas.clientWidth

    const zoomRatio = newImageWidth / this.imageRootWidth

    this.interpolatedZoomRatio = zoomRatio

    this.messageBroker.publish('setZoomText', `${Math.round(zoomRatio * 100)}%`)

    // Update cursor position with new pan values
    this.updateCursorPosition(cursorPoint)

    // Update brush preview after pan/zoom is complete
    requestAnimationFrame(() => {
      this.messageBroker.publish('updateBrushPreview')
    })
  }

  private async smoothResetView(duration: number = 500) {
    // Store initial state
    const startZoom = this.zoom_ratio
    const startPan = { ...this.pan_offset }

    // Panel dimensions
    const sidePanelWidth = 220
    const toolPanelWidth = 64
    const topBarHeight = 44

    // Calculate available space
    const availableWidth =
      this.rootElement!.clientWidth - sidePanelWidth - toolPanelWidth
    const availableHeight = this.rootElement!.clientHeight - topBarHeight

    // Calculate target zoom
    const zoomRatioWidth = availableWidth / this.image!.width
    const zoomRatioHeight = availableHeight / this.image!.height
    const targetZoom = Math.min(zoomRatioWidth, zoomRatioHeight)

    // Calculate final dimensions
    const aspectRatio = this.image!.width / this.image!.height
    let finalWidth = 0
    let finalHeight = 0

    // Calculate target pan position
    const targetPan = { x: toolPanelWidth, y: topBarHeight }

    if (zoomRatioHeight > zoomRatioWidth) {
      finalWidth = availableWidth
      finalHeight = finalWidth / aspectRatio
      targetPan.y = (availableHeight - finalHeight) / 2 + topBarHeight
    } else {
      finalHeight = availableHeight
      finalWidth = finalHeight * aspectRatio
      targetPan.x = (availableWidth - finalWidth) / 2 + toolPanelWidth
    }

    const startTime = performance.now()
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Cubic easing out for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3)

      // Calculate intermediate zoom and pan values
      const currentZoom = startZoom + (targetZoom - startZoom) * eased

      this.zoom_ratio = currentZoom
      this.pan_offset.x = startPan.x + (targetPan.x - startPan.x) * eased
      this.pan_offset.y = startPan.y + (targetPan.y - startPan.y) * eased

      this.invalidatePanZoom()

      const interpolatedZoomRatio = startZoom + (1.0 - startZoom) * eased

      this.messageBroker.publish(
        'setZoomText',
        `${Math.round(interpolatedZoomRatio * 100)}%`
      )

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
    this.interpolatedZoomRatio = 1.0
  }

  async initializeCanvasPanZoom(
    image: HTMLImageElement,
    rootElement: HTMLElement
  ) {
    // Get side panel width
    let sidePanelWidth = 220
    const toolPanelWidth = 64
    let topBarHeight = 44

    this.rootElement = rootElement

    // Calculate available width accounting for both side panels
    let availableWidth =
      rootElement.clientWidth - sidePanelWidth - toolPanelWidth
    let availableHeight = rootElement.clientHeight - topBarHeight

    let zoomRatioWidth = availableWidth / image.width
    let zoomRatioHeight = availableHeight / image.height

    let aspectRatio = image.width / image.height

    let finalWidth = 0
    let finalHeight = 0

    let pan_offset: Offset = { x: toolPanelWidth, y: topBarHeight }

    if (zoomRatioHeight > zoomRatioWidth) {
      finalWidth = availableWidth
      finalHeight = finalWidth / aspectRatio
      pan_offset.y = (availableHeight - finalHeight) / 2 + topBarHeight
    } else {
      finalHeight = availableHeight
      finalWidth = finalHeight * aspectRatio
      pan_offset.x = (availableWidth - finalWidth) / 2 + toolPanelWidth
    }

    if (this.image === null) {
      this.image = image
    }

    this.imageRootWidth = finalWidth
    this.imageRootHeight = finalHeight

    this.zoom_ratio = Math.min(zoomRatioWidth, zoomRatioHeight)
    this.pan_offset = pan_offset

    this.penPointerIdList = []

    await this.invalidatePanZoom()
  }

  async invalidatePanZoom() {
    // Single validation check upfront
    if (
      !this.image?.width ||
      !this.image?.height ||
      !this.pan_offset ||
      !this.zoom_ratio
    ) {
      console.warn('Missing required properties for pan/zoom')
      return
    }

    // Now TypeScript knows these are non-null
    const raw_width = this.image.width * this.zoom_ratio
    const raw_height = this.image.height * this.zoom_ratio

    // Get canvas container
    this.canvasContainer ??=
      await this.messageBroker?.pull('getCanvasContainer')
    if (!this.canvasContainer) return

    // Apply styles
    Object.assign(this.canvasContainer.style, {
      width: `${raw_width}px`,
      height: `${raw_height}px`,
      left: `${this.pan_offset.x}px`,
      top: `${this.pan_offset.y}px`
    })

    this.rgbCanvas = await this.messageBroker.pull('rgbCanvas')
    if (this.rgbCanvas) {
      // Ensure the canvas has the proper dimensions
      if (
        this.rgbCanvas.width !== this.image.width ||
        this.rgbCanvas.height !== this.image.height
      ) {
        this.rgbCanvas.width = this.image.width
        this.rgbCanvas.height = this.image.height
      }

      // Make sure the style dimensions match the container
      this.rgbCanvas.style.width = `${raw_width}px`
      this.rgbCanvas.style.height = `${raw_height}px`
    }
  }

  private handlePanStart(event: PointerEvent) {
    this.messageBroker.pull('screenToCanvas', {
      x: event.offsetX,
      y: event.offsetY
    })
    this.mouseDownPoint = { x: event.clientX, y: event.clientY }
    this.messageBroker.publish('panCursor', true)
    this.initialPan = this.pan_offset
    return
  }

  private handlePanMove(event: PointerEvent) {
    if (this.mouseDownPoint === null) throw new Error('mouseDownPoint is null')

    let deltaX = this.mouseDownPoint.x - event.clientX
    let deltaY = this.mouseDownPoint.y - event.clientY

    let pan_x = this.initialPan.x - deltaX
    let pan_y = this.initialPan.y - deltaY

    this.pan_offset = { x: pan_x, y: pan_y }

    this.invalidatePanZoom()
  }
}
