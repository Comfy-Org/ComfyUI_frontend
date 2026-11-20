import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'
import {
  calculateDragPan,
  calculateZoomAroundPoint,
  getDistanceBetweenPoints,
  getMidpoint,
  getWheelZoomFactor
} from '@comfyorg/shared-frontend-utils/panZoomUtils'
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

const FIT_SCALE = 1
const MAX_SCALE = 10
const DOUBLE_CLICK_SCALE = 2
const PAN_BUTTONS = new Set([0, 1])

interface DragStart {
  point: Point2D
  offset: Point2D
}

function clientPoint(event: MouseEvent): Point2D {
  return { x: event.clientX, y: event.clientY }
}

/** Wheel, drag, pinch and double-click zoom for an image scaled from its fitted size. */
export function useImagePanZoom(target: Ref<HTMLElement | undefined>) {
  const scale = ref(FIT_SCALE)
  const offset = ref<Point2D>({ x: 0, y: 0 })
  const dragStart = ref<DragStart | null>(null)
  const pointers = new Map<number, Point2D>()
  let pinchDistance = 0

  const isZoomed = computed(() => scale.value > FIT_SCALE)
  const isPanning = computed(() => isZoomed.value && dragStart.value !== null)
  const transformStyle = computed(() => ({
    transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`,
    transformOrigin: '0 0'
  }))

  function reset() {
    scale.value = FIT_SCALE
    offset.value = { x: 0, y: 0 }
  }

  function toTargetPoint(point: Point2D): Point2D {
    const rect = target.value?.getBoundingClientRect()
    return { x: point.x - (rect?.left ?? 0), y: point.y - (rect?.top ?? 0) }
  }

  function zoomTo(targetScale: number, focal: Point2D) {
    const clamped = Math.min(MAX_SCALE, Math.max(FIT_SCALE, targetScale))
    if (clamped === FIT_SCALE) {
      reset()
      return
    }
    const local = toTargetPoint(focal)
    const next = calculateZoomAroundPoint(
      scale.value,
      clamped / scale.value,
      offset.value,
      local.x,
      local.y
    )
    scale.value = next.zoomRatio
    offset.value = next.panOffset
  }

  function handleWheel(event: WheelEvent) {
    if (event.deltaY === 0) return
    zoomTo(scale.value * getWheelZoomFactor(event.deltaY), clientPoint(event))
  }

  function handleDoubleClick(event: MouseEvent) {
    if (isZoomed.value) {
      reset()
      return
    }
    zoomTo(DOUBLE_CLICK_SCALE, clientPoint(event))
  }

  function pinchPoints(): [Point2D, Point2D] | null {
    const points = [...pointers.values()]
    return points.length === 2 ? [points[0], points[1]] : null
  }

  function handlePointerDown(event: PointerEvent) {
    if (!PAN_BUTTONS.has(event.button)) return
    target.value?.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, clientPoint(event))
    const pinch = pinchPoints()
    pinchDistance = pinch ? getDistanceBetweenPoints(...pinch) : 0
    dragStart.value = pinch
      ? null
      : { point: clientPoint(event), offset: offset.value }
  }

  function handlePointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, clientPoint(event))
    const pinch = pinchPoints()

    if (pinch) {
      const distance = getDistanceBetweenPoints(...pinch)
      if (pinchDistance > 0) {
        zoomTo((scale.value * distance) / pinchDistance, getMidpoint(...pinch))
      }
      pinchDistance = distance
      return
    }

    if (!isZoomed.value || !dragStart.value) return
    offset.value = calculateDragPan(
      dragStart.value.point,
      clientPoint(event),
      dragStart.value.offset
    )
  }

  function handlePointerUp(event: PointerEvent) {
    pointers.delete(event.pointerId)
    pinchDistance = 0
    dragStart.value = null
  }

  return {
    scale,
    offset,
    isZoomed,
    isPanning,
    transformStyle,
    reset,
    handleWheel,
    handleDoubleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  }
}
