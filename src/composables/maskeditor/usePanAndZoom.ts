import { ref, watch } from 'vue'

import type { Offset, Point } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

import {
  calculateDragPan,
  calculateFitView,
  calculatePanZoomStyles,
  calculateSingleTouchPan,
  calculateZoomAroundPoint,
  easeOutCubic,
  getCursorPoint,
  getDistanceBetweenPoints,
  getMidpoint,
  getWheelZoomFactor,
  interpolateView,
  isDoubleTap
} from './panZoomUtils'

export function usePanAndZoom() {
  const store = useMaskEditorStore()

  const DOUBLE_TAP_DELAY = 300

  const lastTwoFingerTap = ref(0)
  const isTouchZooming = ref(false)
  const lastTouchZoomDistance = ref(0)
  const lastTouchMidPoint = ref<Point>({ x: 0, y: 0 })
  const lastTouchPoint = ref<Point>({ x: 0, y: 0 })

  const zoom_ratio = ref(1)
  const interpolatedZoomRatio = ref(1)
  const pan_offset = ref<Offset>({ x: 0, y: 0 })

  const mouseDownPoint = ref<Point | null>(null)
  const initialPan = ref<Offset>({ x: 0, y: 0 })

  const canvasContainer = ref<HTMLElement | null>(null)
  const maskCanvas = ref<HTMLCanvasElement | null>(null)
  const rgbCanvas = ref<HTMLCanvasElement | null>(null)
  const rootElement = ref<HTMLElement | null>(null)

  const toolPanelElement = ref<HTMLElement | null>(null)
  const sidePanelElement = ref<HTMLElement | null>(null)

  const image = ref<HTMLImageElement | null>(null)
  const imageRootWidth = ref(0)
  const imageRootHeight = ref(0)

  const cursorPoint = ref<Point>({ x: 0, y: 0 })
  const penPointerIdList = ref<number[]>([])

  const updateCursorPosition = (clientPoint: Point): void => {
    const point = getCursorPoint(clientPoint, pan_offset.value)
    cursorPoint.value = point
    store.setCursorPoint(point)
  }

  const handleDoubleTap = (): void => {
    store.canvasHistory.undo()
  }

  const invalidatePanZoom = async (): Promise<void> => {
    if (
      !image.value?.width ||
      !image.value?.height ||
      !pan_offset.value ||
      !zoom_ratio.value
    ) {
      console.warn('Missing required properties for pan/zoom')
      return
    }

    const styles = calculatePanZoomStyles(
      image.value.width,
      image.value.height,
      zoom_ratio.value,
      pan_offset.value
    )

    if (!canvasContainer.value) {
      canvasContainer.value = store.canvasContainer
    }
    if (!canvasContainer.value) return

    Object.assign(canvasContainer.value.style, {
      width: styles.containerWidth,
      height: styles.containerHeight,
      left: styles.containerLeft,
      top: styles.containerTop
    })

    if (!rgbCanvas.value) {
      rgbCanvas.value = store.rgbCanvas
    }
    if (rgbCanvas.value) {
      if (
        rgbCanvas.value.width !== image.value.width ||
        rgbCanvas.value.height !== image.value.height
      ) {
        rgbCanvas.value.width = image.value.width
        rgbCanvas.value.height = image.value.height
      }

      rgbCanvas.value.style.width = styles.containerWidth
      rgbCanvas.value.style.height = styles.containerHeight
    }

    store.setPanOffset(pan_offset.value)
    store.setZoomRatio(zoom_ratio.value)
  }

  const handlePanStart = (event: PointerEvent): void => {
    mouseDownPoint.value = { x: event.clientX, y: event.clientY }

    store.isPanning = true
    initialPan.value = { ...pan_offset.value }
  }

  const handlePanMove = async (event: PointerEvent): Promise<void> => {
    if (mouseDownPoint.value === null) {
      throw new Error('mouseDownPoint is null')
    }

    pan_offset.value = calculateDragPan(
      mouseDownPoint.value,
      { x: event.clientX, y: event.clientY },
      initialPan.value
    )

    await invalidatePanZoom()
  }

  const handleSingleTouchPan = async (touch: Touch): Promise<void> => {
    if (lastTouchPoint.value === null) {
      lastTouchPoint.value = { x: touch.clientX, y: touch.clientY }
      return
    }

    pan_offset.value = calculateSingleTouchPan(
      lastTouchPoint.value,
      { x: touch.clientX, y: touch.clientY },
      pan_offset.value
    )

    await invalidatePanZoom()

    lastTouchPoint.value = { x: touch.clientX, y: touch.clientY }
  }

  const touchToPoint = (touch: Touch): Point => ({
    x: touch.clientX,
    y: touch.clientY
  })

  const handleTouchStart = (event: TouchEvent): void => {
    event.preventDefault()

    if (penPointerIdList.value.length > 0) return

    store.brushVisible = false

    if (event.touches.length === 2) {
      const currentTime = new Date().getTime()

      if (isDoubleTap(currentTime, lastTwoFingerTap.value, DOUBLE_TAP_DELAY)) {
        handleDoubleTap()
        lastTwoFingerTap.value = 0
      } else {
        lastTwoFingerTap.value = currentTime

        const p0 = touchToPoint(event.touches[0])
        const p1 = touchToPoint(event.touches[1])

        isTouchZooming.value = true
        lastTouchZoomDistance.value = getDistanceBetweenPoints(p0, p1)
        lastTouchMidPoint.value = getMidpoint(p0, p1)
      }
    } else if (event.touches.length === 1) {
      lastTouchPoint.value = touchToPoint(event.touches[0])
    }
  }

  const handleTouchMove = async (event: TouchEvent): Promise<void> => {
    event.preventDefault()

    if (penPointerIdList.value.length > 0) return

    lastTwoFingerTap.value = 0

    if (isTouchZooming.value && event.touches.length === 2) {
      const p0 = touchToPoint(event.touches[0])
      const p1 = touchToPoint(event.touches[1])

      const newDistance = getDistanceBetweenPoints(p0, p1)
      const pinchFactor = newDistance / lastTouchZoomDistance.value
      const midpoint = getMidpoint(p0, p1)

      // Apply midpoint drag
      const draggedPan: Offset = {
        x: pan_offset.value.x + midpoint.x - lastTouchMidPoint.value.x,
        y: pan_offset.value.y + midpoint.y - lastTouchMidPoint.value.y
      }

      if (!maskCanvas.value) {
        maskCanvas.value = store.maskCanvas
      }
      if (!maskCanvas.value) return

      const rect = maskCanvas.value.getBoundingClientRect()
      const focalX = midpoint.x - rect.left
      const focalY = midpoint.y - rect.top

      const result = calculateZoomAroundPoint(
        zoom_ratio.value,
        pinchFactor,
        draggedPan,
        focalX,
        focalY
      )

      zoom_ratio.value = result.zoomRatio
      pan_offset.value = result.panOffset

      await invalidatePanZoom()
      lastTouchZoomDistance.value = newDistance
      lastTouchMidPoint.value = midpoint
    } else if (event.touches.length === 1) {
      await handleSingleTouchPan(event.touches[0])
    }
  }

  const handleTouchEnd = (event: TouchEvent): void => {
    event.preventDefault()

    const lastTouch = event.touches[0]

    if (lastTouch) {
      lastTouchPoint.value = touchToPoint(lastTouch)
    } else {
      isTouchZooming.value = false
      lastTouchMidPoint.value = { x: 0, y: 0 }
    }
  }

  const zoom = async (event: WheelEvent): Promise<void> => {
    const cursorPosition = { x: event.clientX, y: event.clientY }

    if (!maskCanvas.value) {
      maskCanvas.value = store.maskCanvas
    }
    if (!maskCanvas.value) return

    const rect = maskCanvas.value.getBoundingClientRect()
    const focalX = cursorPosition.x - rect.left
    const focalY = cursorPosition.y - rect.top

    const result = calculateZoomAroundPoint(
      zoom_ratio.value,
      getWheelZoomFactor(event.deltaY),
      pan_offset.value,
      focalX,
      focalY
    )

    zoom_ratio.value = result.zoomRatio
    pan_offset.value = result.panOffset

    await invalidatePanZoom()

    const newImageWidth = maskCanvas.value.clientWidth
    const zoomRatio = newImageWidth / imageRootWidth.value

    interpolatedZoomRatio.value = zoomRatio
    store.displayZoomRatio = zoomRatio

    updateCursorPosition(cursorPosition)
  }

  const getPanelDimensions = (): {
    sidePanelWidth: number
    toolPanelWidth: number
  } => {
    const toolPanelWidth =
      toolPanelElement.value?.getBoundingClientRect().width || 64
    const sidePanelWidth =
      sidePanelElement.value?.getBoundingClientRect().width || 220

    return { sidePanelWidth, toolPanelWidth }
  }

  const smoothResetView = async (duration: number = 500): Promise<void> => {
    if (!image.value || !rootElement.value) return

    const startZoom = zoom_ratio.value
    const startPan = { ...pan_offset.value }

    const { sidePanelWidth, toolPanelWidth } = getPanelDimensions()

    const fitResult = calculateFitView({
      rootWidth: rootElement.value.clientWidth,
      rootHeight: rootElement.value.clientHeight,
      imageWidth: image.value.width,
      imageHeight: image.value.height,
      toolPanelWidth,
      sidePanelWidth
    })

    const startTime = performance.now()
    const animate = async (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)

      const frame = interpolateView(
        startZoom,
        fitResult.zoomRatio,
        startPan,
        fitResult.panOffset,
        eased
      )

      zoom_ratio.value = frame.zoomRatio
      pan_offset.value = frame.panOffset

      await invalidatePanZoom()

      const interpolatedRatio = startZoom + (1.0 - startZoom) * eased
      store.displayZoomRatio = interpolatedRatio

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
    interpolatedZoomRatio.value = 1.0
  }

  const initializeCanvasPanZoom = async (
    img: HTMLImageElement,
    root: HTMLElement,
    toolPanel?: HTMLElement | null,
    sidePanel?: HTMLElement | null
  ): Promise<void> => {
    rootElement.value = root
    toolPanelElement.value = toolPanel || null
    sidePanelElement.value = sidePanel || null

    const { sidePanelWidth, toolPanelWidth } = getPanelDimensions()

    const fitResult = calculateFitView({
      rootWidth: root.clientWidth,
      rootHeight: root.clientHeight,
      imageWidth: img.width,
      imageHeight: img.height,
      toolPanelWidth,
      sidePanelWidth
    })

    if (image.value === null) {
      image.value = img
    }

    imageRootWidth.value = fitResult.fittedWidth
    imageRootHeight.value = fitResult.fittedHeight

    zoom_ratio.value = fitResult.zoomRatio
    pan_offset.value = fitResult.panOffset

    penPointerIdList.value = []

    await invalidatePanZoom()
  }

  watch(
    () => store.resetZoomTrigger,
    async () => {
      if (interpolatedZoomRatio.value === 1) return
      await smoothResetView()
    }
  )

  const addPenPointerId = (pointerId: number): void => {
    if (!penPointerIdList.value.includes(pointerId)) {
      penPointerIdList.value.push(pointerId)
    }
  }

  const removePenPointerId = (pointerId: number): void => {
    const index = penPointerIdList.value.indexOf(pointerId)
    if (index !== -1) {
      penPointerIdList.value.splice(index, 1)
    }
  }

  return {
    initializeCanvasPanZoom,
    handlePanStart,
    handlePanMove,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    updateCursorPosition,
    zoom,
    invalidatePanZoom,
    addPenPointerId,
    removePenPointerId
  }
}
