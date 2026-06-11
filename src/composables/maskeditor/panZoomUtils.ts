import type { Offset, Point } from '@/extensions/core/maskeditor/types'

const ZOOM_MIN = 0.2
const ZOOM_MAX = 10.0

interface FitViewParams {
  rootWidth: number
  rootHeight: number
  imageWidth: number
  imageHeight: number
  toolPanelWidth: number
  sidePanelWidth: number
}

interface FitViewResult {
  zoomRatio: number
  panOffset: Offset
  fittedWidth: number
  fittedHeight: number
}

export function calculateFitView(params: FitViewParams): FitViewResult {
  const {
    rootWidth,
    rootHeight,
    imageWidth,
    imageHeight,
    toolPanelWidth,
    sidePanelWidth
  } = params

  const availableWidth = rootWidth - sidePanelWidth - toolPanelWidth
  const availableHeight = rootHeight

  const zoomRatioWidth = availableWidth / imageWidth
  const zoomRatioHeight = availableHeight / imageHeight
  const zoomRatio = Math.min(zoomRatioWidth, zoomRatioHeight)

  const aspectRatio = imageWidth / imageHeight
  const panOffset: Offset = { x: toolPanelWidth, y: 0 }

  let fittedWidth: number
  let fittedHeight: number

  if (zoomRatioHeight > zoomRatioWidth) {
    fittedWidth = availableWidth
    fittedHeight = fittedWidth / aspectRatio
    panOffset.y = (availableHeight - fittedHeight) / 2
  } else {
    fittedHeight = availableHeight
    fittedWidth = fittedHeight * aspectRatio
    panOffset.x = (availableWidth - fittedWidth) / 2 + toolPanelWidth
  }

  return { zoomRatio, panOffset, fittedWidth, fittedHeight }
}

export function clampZoom(zoom: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
}

export function getWheelZoomFactor(deltaY: number): number {
  return deltaY < 0 ? 1.1 : 0.9
}

export function calculateZoomAroundPoint(
  currentZoom: number,
  zoomFactor: number,
  panOffset: Offset,
  focalX: number,
  focalY: number
): { zoomRatio: number; panOffset: Offset } {
  const newZoom = clampZoom(currentZoom * zoomFactor)
  const scaleFactor = newZoom / currentZoom

  return {
    zoomRatio: newZoom,
    panOffset: {
      x: panOffset.x + focalX - focalX * scaleFactor,
      y: panOffset.y + focalY - focalY * scaleFactor
    }
  }
}

export function calculateDragPan(
  mouseDownPoint: Point,
  currentPoint: Point,
  initialPan: Offset
): Offset {
  return {
    x: initialPan.x - (mouseDownPoint.x - currentPoint.x),
    y: initialPan.y - (mouseDownPoint.y - currentPoint.y)
  }
}

export function calculateSingleTouchPan(
  lastPoint: Point,
  currentPoint: Point,
  panOffset: Offset
): Offset {
  return {
    x: panOffset.x + (currentPoint.x - lastPoint.x),
    y: panOffset.y + (currentPoint.y - lastPoint.y)
  }
}

export function getDistanceBetweenPoints(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function getMidpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  }
}

export function getCursorPoint(clientPoint: Point, panOffset: Offset): Point {
  return {
    x: clientPoint.x - panOffset.x,
    y: clientPoint.y - panOffset.y
  }
}

export function isDoubleTap(
  currentTime: number,
  lastTapTime: number,
  delay: number
): boolean {
  return currentTime - lastTapTime < delay
}

export function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3)
}

export function interpolateView(
  startZoom: number,
  targetZoom: number,
  startPan: Offset,
  targetPan: Offset,
  easedProgress: number
): { zoomRatio: number; panOffset: Offset } {
  return {
    zoomRatio: startZoom + (targetZoom - startZoom) * easedProgress,
    panOffset: {
      x: startPan.x + (targetPan.x - startPan.x) * easedProgress,
      y: startPan.y + (targetPan.y - startPan.y) * easedProgress
    }
  }
}

export function calculatePanZoomStyles(
  imageWidth: number,
  imageHeight: number,
  zoomRatio: number,
  panOffset: Offset
): {
  rawWidth: number
  rawHeight: number
  containerLeft: string
  containerTop: string
  containerWidth: string
  containerHeight: string
} {
  const rawWidth = imageWidth * zoomRatio
  const rawHeight = imageHeight * zoomRatio
  return {
    rawWidth,
    rawHeight,
    containerLeft: `${panOffset.x}px`,
    containerTop: `${panOffset.y}px`,
    containerWidth: `${rawWidth}px`,
    containerHeight: `${rawHeight}px`
  }
}
