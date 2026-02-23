import { computed, onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'

import { createMonotoneInterpolator } from '@/components/curve/curveUtils'
import type { CurvePoint } from '@/lib/litegraph/src/types/widgets'

interface UseCurveEditorOptions {
  svgRef: Ref<SVGSVGElement | null>
  modelValue: Ref<CurvePoint[]>
}

export function useCurveEditor({ svgRef, modelValue }: UseCurveEditorOptions) {
  const dragIndex = ref(-1)
  let cleanupDrag: (() => void) | null = null

  const sortedPoints = computed(() => {
    const points = modelValue.value
    if (!Array.isArray(points)) return []
    return [...points].sort((a, b) => a[0] - b[0])
  })

  const curvePath = computed(() => {
    const points = sortedPoints.value
    if (points.length < 2) return ''

    const interpolate = createMonotoneInterpolator(points)
    const xMin = points[0][0]
    const xMax = points[points.length - 1][0]
    const segments = 128
    const parts: string[] = []
    for (let i = 0; i <= segments; i++) {
      const x = xMin + (xMax - xMin) * (i / segments)
      const y = 1 - interpolate(x)
      parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(4)},${y.toFixed(4)}`)
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
    const threshold = 0.04
    let nearest = -1
    let minDist = threshold
    for (let i = 0; i < modelValue.value.length; i++) {
      const [px, py] = modelValue.value[i]
      const dist = Math.hypot(px - x, py - y)
      if (dist < minDist) {
        minDist = dist
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

    const newPoints: CurvePoint[] = [...modelValue.value, [x, y]]
    modelValue.value = newPoints

    const newIndex = newPoints.length - 1
    startDrag(newIndex, e)
  }

  function sortByX(points: CurvePoint[]): CurvePoint[] {
    return [...points].sort((a, b) => a[0] - b[0])
  }

  function startDrag(index: number, e: PointerEvent) {
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      if (modelValue.value.length > 2) {
        const newPoints = [...modelValue.value]
        newPoints.splice(index, 1)
        modelValue.value = sortByX(newPoints)
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
      const newPoints = [...modelValue.value]
      newPoints[dragIndex.value] = [x, y]
      modelValue.value = newPoints
    }

    const endDrag = () => {
      if (dragIndex.value < 0) return
      dragIndex.value = -1
      modelValue.value = sortByX(modelValue.value)
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
