import { computed, onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'

import { createMonotoneInterpolator } from '@/components/curve/curveUtils'
import type { CurvePoint } from '@/components/curve/types'

interface UseCurveEditorOptions {
  svgRef: Ref<SVGSVGElement | null>
  modelValue: Ref<CurvePoint[]>
}

function insertSorted(
  points: CurvePoint[],
  point: CurvePoint
): [CurvePoint[], number] {
  let lo = 0
  let hi = points.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (points[mid][0] < point[0]) lo = mid + 1
    else hi = mid
  }
  const result = [...points.slice(0, lo), point, ...points.slice(lo)]
  return [result, lo]
}

export function useCurveEditor({ svgRef, modelValue }: UseCurveEditorOptions) {
  const dragIndex = ref(-1)
  let cleanupDrag: (() => void) | null = null

  const curvePath = computed(() => {
    const points = modelValue.value
    if (points.length < 2) return ''

    const interpolate = createMonotoneInterpolator(points)
    const xMin = points[0][0]
    const xMax = points[points.length - 1][0]
    const segments = 128
    const range = xMax - xMin
    const parts: string[] = []
    for (let i = 0; i <= segments; i++) {
      const x = xMin + range * (i / segments)
      const y = 1 - interpolate(x)
      parts.push(`${i === 0 ? 'M' : 'L'}${x},${y}`)
    }
    return parts.join('')
  })

  function svgCoords(e: PointerEvent): [number, number] {
    const svg = svgRef.value
    if (!svg) return [0, 0]

    const ctm = svg.getScreenCTM()
    if (!ctm) return [0, 0]

    const svgPt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      ctm.inverse()
    )
    return [
      Math.max(0, Math.min(1, svgPt.x)),
      Math.max(0, Math.min(1, 1 - svgPt.y))
    ]
  }

  function findNearestPoint(x: number, y: number): number {
    const threshold2 = 0.04 * 0.04
    let nearest = -1
    let minDist2 = threshold2
    for (let i = 0; i < modelValue.value.length; i++) {
      const dx = modelValue.value[i][0] - x
      const dy = modelValue.value[i][1] - y
      const dist2 = dx * dx + dy * dy
      if (dist2 < minDist2) {
        minDist2 = dist2
        nearest = i
      }
    }
    return nearest
  }

  function handleSvgPointerDown(e: PointerEvent) {
    if (e.button !== 0) return

    const [x, y] = svgCoords(e)

    const nearby = findNearestPoint(x, y)
    if (nearby >= 0) {
      startDrag(nearby, e)
      return
    }

    if (e.ctrlKey) return

    const newPoint: CurvePoint = [x, y]
    const [newPoints, insertIndex] = insertSorted(modelValue.value, newPoint)
    modelValue.value = newPoints

    startDrag(insertIndex, e)
  }

  function startDrag(index: number, e: PointerEvent) {
    cleanupDrag?.()

    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      if (modelValue.value.length > 2) {
        const newPoints = [...modelValue.value]
        newPoints.splice(index, 1)
        modelValue.value = newPoints
      }
      return
    }

    dragIndex.value = index
    const svg = svgRef.value
    if (!svg) return

    svg.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      if (dragIndex.value < 0) return
      const [x, y] = svgCoords(ev)
      const movedPoint: CurvePoint = [x, y]
      const remaining = modelValue.value.filter((_, i) => i !== dragIndex.value)
      const [newPoints, newIndex] = insertSorted(remaining, movedPoint)
      modelValue.value = newPoints
      dragIndex.value = newIndex
    }

    const endDrag = () => {
      if (dragIndex.value < 0) return
      dragIndex.value = -1
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerup', endDrag)
      svg.removeEventListener('lostpointercapture', endDrag)
      cleanupDrag = null
    }

    cleanupDrag = endDrag

    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerup', endDrag)
    svg.addEventListener('lostpointercapture', endDrag)
  }

  onBeforeUnmount(() => {
    cleanupDrag?.()
  })

  return {
    curvePath,
    handleSvgPointerDown,
    startDrag
  }
}
