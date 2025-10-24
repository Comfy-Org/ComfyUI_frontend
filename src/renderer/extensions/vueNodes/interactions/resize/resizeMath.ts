import type { Point, Size } from '@/renderer/core/layout/types'

export type ResizeHandleDirection = {
  horizontal: 'left' | 'right'
  vertical: 'top' | 'bottom'
}

function applyHandleDelta(
  startSize: Size,
  delta: Point,
  handle: ResizeHandleDirection
): Size {
  const horizontalMultiplier = handle.horizontal === 'right' ? 1 : -1
  const verticalMultiplier = handle.vertical === 'bottom' ? 1 : -1

  return {
    width: startSize.width + delta.x * horizontalMultiplier,
    height: startSize.height + delta.y * verticalMultiplier
  }
}

function clampToMinSize(size: Size, minSize: Size): Size {
  return {
    width: Math.max(size.width, minSize.width),
    height: Math.max(size.height, minSize.height)
  }
}

function snapSize(
  size: Size,
  minSize: Size,
  snapFn?: (size: Size) => Size
): Size {
  if (!snapFn) return size
  const snapped = snapFn(size)
  return {
    width: Math.max(minSize.width, snapped.width),
    height: Math.max(minSize.height, snapped.height)
  }
}

function computeAdjustedPosition(
  startPosition: Point,
  startSize: Size,
  nextSize: Size,
  handle: ResizeHandleDirection
): Point {
  const widthDelta = startSize.width - nextSize.width
  const heightDelta = startSize.height - nextSize.height

  return {
    x:
      handle.horizontal === 'left'
        ? startPosition.x + widthDelta
        : startPosition.x,
    y:
      handle.vertical === 'top'
        ? startPosition.y + heightDelta
        : startPosition.y
  }
}

/**
 * Computes the resulting size and position of a node given pointer movement
 * and handle orientation.
 */
export function computeResizeOutcome({
  startSize,
  startPosition,
  delta,
  minSize,
  handle,
  snapFn
}: {
  startSize: Size
  startPosition: Point
  delta: Point
  minSize: Size
  handle: ResizeHandleDirection
  snapFn?: (size: Size) => Size
}): { size: Size; position: Point } {
  const resized = applyHandleDelta(startSize, delta, handle)
  const clamped = clampToMinSize(resized, minSize)
  const snapped = snapSize(clamped, minSize, snapFn)
  const position = computeAdjustedPosition(
    startPosition,
    startSize,
    snapped,
    handle
  )

  return {
    size: snapped,
    position
  }
}

export function createResizeSession(config: {
  startSize: Size
  startPosition: Point
  minSize: Size
  handle: ResizeHandleDirection
}) {
  const startSize = { ...config.startSize }
  const startPosition = { ...config.startPosition }
  const minSize = { ...config.minSize }
  const handle = config.handle

  return (delta: Point, snapFn?: (size: Size) => Size) =>
    computeResizeOutcome({
      startSize,
      startPosition,
      minSize,
      handle,
      delta,
      snapFn
    })
}

export function toCanvasDelta(
  startPointer: Point,
  currentPointer: Point,
  scale: number
): Point {
  const safeScale = scale === 0 ? 1 : scale
  return {
    x: (currentPointer.x - startPointer.x) / safeScale,
    y: (currentPointer.y - startPointer.y) / safeScale
  }
}
